import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveFinancials } from './quoteJobAdminModel'
import { loadMarketplacePricingDefaults } from './marketplacePricingDefaultsStore'
import {
  computeMarketplacePayoutFromCustomerTotal,
  computePlatformProfitFromPayout,
  formatMarketplaceDeductionLabel,
} from './marketplacePayoutMath'

/** @param {Record<string, unknown>} q */
export function quoteAdjustmentsSumGbp(q) {
  const o = mergedAdminWorkflowForQuote(q)
  return (o.adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0)
}

/** @param {Record<string, unknown>} q */
export function quoteCustomerTotalGbp(q) {
  const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
  return fin.customerTotal
}

/**
 * Display-only finance for marketplace admin cards (never mutates quote payment fields).
 * @param {Record<string, unknown>} q
 */
export function getMarketplaceFinancePresentation(q) {
  const o = mergedAdminWorkflowForQuote(q)
  const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
  const customerTotal = fin.customerTotal
  const payout =
    o.marketplacePayoutGbp != null && Number.isFinite(Number(o.marketplacePayoutGbp))
      ? Number(o.marketplacePayoutGbp)
      : q.marketplace_payout_price != null && q.marketplace_payout_price !== ''
        ? Number(q.marketplace_payout_price)
        : null

  let profit =
    q.platform_profit_amount != null && q.platform_profit_amount !== ''
      ? Number(q.platform_profit_amount)
      : null
  if (!Number.isFinite(profit) && customerTotal != null && payout != null) {
    profit = computePlatformProfitFromPayout(customerTotal, payout)
  }

  /** @type {string} */
  let deductionLabel = '—'
  if (o.marketplacePayoutManualOverride) {
    deductionLabel = 'Custom payout'
  } else if (o.marketplaceDeductionSnapshot && typeof o.marketplaceDeductionSnapshot === 'object') {
    const snap = /** @type {{ type?: string, value?: number }} */ (o.marketplaceDeductionSnapshot)
    const t = snap.type === 'fixed' ? 'fixed' : 'percentage'
    deductionLabel = formatMarketplaceDeductionLabel(t, Number(snap.value))
  } else if (q.marketplace_deduction_type != null && q.marketplace_deduction_value != null) {
    const t = String(q.marketplace_deduction_type) === 'fixed' ? 'fixed' : 'percentage'
    deductionLabel = formatMarketplaceDeductionLabel(t, Number(q.marketplace_deduction_value))
  } else {
    const d = loadMarketplacePricingDefaults()
    deductionLabel = formatMarketplaceDeductionLabel(d.deductionType, d.deductionValue)
  }

  return {
    customerTotal,
    marketplacePayout: payout,
    platformProfit: profit,
    deductionLabel,
    paymentStatus: String(q.payment_status || '—'),
    remainingBalance: fin.remaining,
    paid: fin.paid,
  }
}
