import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveFinancials } from './quoteJobAdminModel'
import { numOrNull } from './jobPayoutAccounting'
import { sumJobAdjustmentsGbp } from './jobAdjustments'
import { resolveMarketplaceDeductionRuleBase } from './jobAcceptedPaymentDisplay'
import {
  computeMarketplacePayoutFromCustomerTotal,
  computePlatformProfitFromPayout,
  formatMarketplaceDeductionLabel,
} from './marketplacePayoutMath'

export const PAYOUT_ESTIMATE_WARNING = 'Payout not saved — estimated from settings.'
export const PAYOUT_FIXED_FROM_AVAILABLE_LABEL = 'Payout fixed from Available Jobs'

/**
 * Saved driver/marketplace payout — never re-apply platform deduction to this amount.
 * @param {Record<string, unknown>} q
 */
export function resolveMarketplaceSavedPayout(q) {
  const driver = numOrNull(q.driver_payout_amount)
  if (driver != null) {
    return { amount: driver, kind: 'saved_driver' }
  }

  const merged = mergedAdminWorkflowForQuote(q)
  const fromMerge =
    merged.marketplacePayoutGbp != null && Number.isFinite(Number(merged.marketplacePayoutGbp))
      ? Number(merged.marketplacePayoutGbp)
      : null
  if (fromMerge != null) {
    return { amount: fromMerge, kind: 'saved_marketplace' }
  }

  const fromQuote = numOrNull(q.marketplace_payout_price)
  if (fromQuote != null) {
    return { amount: fromQuote, kind: 'saved_marketplace' }
  }

  return null
}

/**
 * @param {Record<string, unknown>} q
 */
export function isPayoutFixedFromAvailableJobs(q) {
  const merged = mergedAdminWorkflowForQuote(q)
  const snap = merged.marketplaceDeductionSnapshot
  if (snap && typeof snap === 'object' && snap.source === 'available_jobs') {
    return resolveMarketplaceSavedPayout(q) != null
  }
  return false
}

/**
 * Read-only marketplace money for admin cards (does not mutate quotes).
 * Uses saved payout when present; estimates at most once from customer total + deduction rule.
 * @param {Record<string, unknown>} q
 */
export function resolveMarketplacePayoutPresentation(q) {
  const merged = mergedAdminWorkflowForQuote(q)
  const fin = resolveFinancials(q, sumJobAdjustmentsGbp(merged.adjustments || []))
  const customerTotal = fin.customerTotal
  const saved = resolveMarketplaceSavedPayout(q)
  const payoutFixedFromAvailableJobs = isPayoutFixedFromAvailableJobs(q)

  let marketplacePayout = saved?.amount ?? null
  let payoutIsSaved = saved != null
  let payoutIsEstimated = false
  let payoutMissing = false
  let payoutWarning = null

  if (marketplacePayout == null && customerTotal != null && customerTotal > 0) {
    const rule = resolveMarketplaceDeductionRuleBase(q)
    if (rule.deductionType && rule.deductionValue != null) {
      const calc = computeMarketplacePayoutFromCustomerTotal(
        customerTotal,
        rule.deductionType,
        rule.deductionValue,
      )
      if (calc) {
        marketplacePayout = calc.marketplacePayout
        payoutIsEstimated = true
        payoutWarning = PAYOUT_ESTIMATE_WARNING
      }
    }
  }

  if (marketplacePayout == null) {
    payoutMissing = true
    payoutWarning =
      customerTotal == null
        ? `${PAYOUT_ESTIMATE_WARNING} Customer total unavailable.`
        : PAYOUT_ESTIMATE_WARNING
  }

  let platformProfit = numOrNull(q.platform_profit_amount)
  if (!Number.isFinite(platformProfit) && customerTotal != null && marketplacePayout != null) {
    platformProfit = computePlatformProfitFromPayout(customerTotal, marketplacePayout)
  }

  let deductionLabel = '—'
  if (merged.marketplacePayoutManualOverride || q.driver_payout_manual_override) {
    deductionLabel = 'Custom payout'
  } else if (merged.marketplaceDeductionSnapshot && typeof merged.marketplaceDeductionSnapshot === 'object') {
    const snap = /** @type {{ type?: string, value?: number }} */ (merged.marketplaceDeductionSnapshot)
    const t = snap.type === 'fixed' ? 'fixed' : 'percentage'
    deductionLabel = formatMarketplaceDeductionLabel(t, Number(snap.value))
  } else if (q.marketplace_deduction_type != null && q.marketplace_deduction_value != null) {
    const t = String(q.marketplace_deduction_type) === 'fixed' ? 'fixed' : 'percentage'
    deductionLabel = formatMarketplaceDeductionLabel(t, Number(q.marketplace_deduction_value))
  } else if (payoutIsEstimated) {
    const rule = resolveMarketplaceDeductionRuleBase(q)
    deductionLabel = rule.label
  }

  return {
    customerTotal,
    marketplacePayout,
    platformProfit,
    deductionLabel,
    paymentStatus: String(q.payment_status || '—'),
    remainingBalance: fin.remaining,
    paid: fin.paid,
    payoutIsSaved,
    payoutIsEstimated,
    payoutMissing,
    payoutWarning,
    payoutFixedFromAvailableJobs,
    payoutFixedLabel: PAYOUT_FIXED_FROM_AVAILABLE_LABEL,
  }
}
