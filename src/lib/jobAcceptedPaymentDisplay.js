import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveFinancials } from './quoteJobAdminModel'
import { quoteAdjustmentsSumGbp } from './marketplaceQuoteFinance'
import { numOrNull } from './jobPayoutAccounting'
import { loadMarketplacePricingDefaults } from './marketplacePricingDefaultsStore'
import {
  computeMarketplacePayoutFromCustomerTotal,
  computePlatformProfitFromPayout,
  formatMarketplaceDeductionLabel,
} from './marketplacePayoutMath'

const ESTIMATE_WARNING = 'Driver payout not saved — estimated from platform settings.'

/**
 * @param {Record<string, unknown>} q
 */
function resolveSavedDriverPayout(q) {
  const merged = mergedAdminWorkflowForQuote(q)
  const driverRecorded = numOrNull(q.driver_payout_amount)
  if (driverRecorded != null) {
    return { amount: driverRecorded, kind: 'saved_driver' }
  }

  const marketplaceSaved =
    merged.marketplacePayoutGbp != null && Number.isFinite(Number(merged.marketplacePayoutGbp))
      ? Number(merged.marketplacePayoutGbp)
      : numOrNull(q.marketplace_payout_price)
  if (marketplaceSaved != null) {
    return { amount: marketplaceSaved, kind: 'saved_marketplace' }
  }

  return null
}

/**
 * Deduction rule from snapshot / quote / global settings (ignores manual override flag).
 * @param {Record<string, unknown>} q
 */
export function resolveMarketplaceDeductionRuleBase(q) {
  const o = mergedAdminWorkflowForQuote(q)

  if (o.marketplaceDeductionSnapshot && typeof o.marketplaceDeductionSnapshot === 'object') {
    const snap = /** @type {{ type?: string, value?: number }} */ (o.marketplaceDeductionSnapshot)
    const deductionType = snap.type === 'fixed' ? 'fixed' : 'percentage'
    const deductionValue = Number(snap.value)
    return {
      deductionType,
      deductionValue,
      label: formatMarketplaceDeductionLabel(deductionType, deductionValue),
      source: 'snapshot',
      settingsApplied: true,
    }
  }

  if (q.marketplace_deduction_type != null && q.marketplace_deduction_value != null) {
    const deductionType = String(q.marketplace_deduction_type) === 'fixed' ? 'fixed' : 'percentage'
    const deductionValue = Number(q.marketplace_deduction_value)
    return {
      deductionType,
      deductionValue,
      label: formatMarketplaceDeductionLabel(deductionType, deductionValue),
      source: 'quote',
      settingsApplied: true,
    }
  }

  const d = loadMarketplacePricingDefaults()
  return {
    deductionType: d.deductionType,
    deductionValue: d.deductionValue,
    label: formatMarketplaceDeductionLabel(d.deductionType, d.deductionValue),
    source: 'settings',
    settingsApplied: true,
  }
}

/**
 * Marketplace platform deduction rule for admin display (read-only).
 * @param {Record<string, unknown>} q
 */
export function resolveMarketplaceDeductionRule(q) {
  const o = mergedAdminWorkflowForQuote(q)
  if (o.marketplacePayoutManualOverride || Boolean(q.driver_payout_manual_override)) {
    return {
      deductionType: null,
      deductionValue: null,
      label: 'Custom payout (manual override)',
      source: 'custom',
      settingsApplied: false,
    }
  }
  return resolveMarketplaceDeductionRuleBase(q)
}

/** @param {Record<string, unknown>} q */
export function isJobAcceptedManualPayoutOverride(q) {
  const o = mergedAdminWorkflowForQuote(q)
  return Boolean(o.marketplacePayoutManualOverride || q.driver_payout_manual_override)
}

/** Shown when admin has confirmed a manual driver payout (no reset to default). */
export const MANUAL_PAYOUT_CONFIRMED_LABEL = 'Manual payout confirmed'

/**
 * Default driver payout from marketplace deduction settings (not manual override).
 * @param {Record<string, unknown>} q
 */
export function computeJobAcceptedDefaultPayout(q) {
  const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
  const customerTotal = fin.customerTotal
  if (customerTotal == null || customerTotal <= 0) return null

  const rule = resolveMarketplaceDeductionRuleBase(q)
  if (!rule.deductionType || rule.deductionValue == null) return null

  const calc = computeMarketplacePayoutFromCustomerTotal(
    customerTotal,
    rule.deductionType,
    rule.deductionValue,
  )
  if (!calc) return null

  return {
    customerTotal,
    driverPayout: calc.marketplacePayout,
    platformFee: calc.platformProfit,
    deductionLabel: calc.deductionLabel,
  }
}

/** @param {'snapshot' | 'quote' | 'settings' | 'custom'} source */
function deductionSourceCaption(source) {
  switch (source) {
    case 'snapshot':
      return 'Saved deduction snapshot on job'
    case 'quote':
      return 'Deduction saved on quote'
    case 'settings':
      return 'Current marketplace pricing settings'
    case 'custom':
      return 'Manual payout override'
    default:
      return '—'
  }
}

/**
 * Admin display-only payment breakdown for Job Accepted (does not mutate totals).
 * @param {Record<string, unknown>} q
 */
export function resolveJobAcceptedPaymentBreakdown(q) {
  const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
  const customerTotal = fin.customerTotal
  const paid = fin.paid
  const remaining = fin.remaining
  const deductionRule = resolveMarketplaceDeductionRule(q)
  const defaultPayout = computeJobAcceptedDefaultPayout(q)
  const manualPayoutOverride = isJobAcceptedManualPayoutOverride(q)
  const payoutOverrideNote = String(q.payout_notes || '').trim()
  const saved = resolveSavedDriverPayout(q)

  const base = {
    customerTotal,
    paid,
    remaining,
    defaultDriverPayout: defaultPayout?.driverPayout ?? null,
    defaultPlatformFee: defaultPayout?.platformFee ?? null,
    manualPayoutOverride,
    payoutOverrideNote,
    deductionLabel: deductionRule.label,
    deductionSource: deductionRule.source,
    deductionSourceCaption: deductionSourceCaption(deductionRule.source),
    marketplaceSettingsApplied: deductionRule.settingsApplied,
  }

  if (saved && customerTotal != null) {
    const driverPayout = saved.amount
    const platformFee = computePlatformProfitFromPayout(customerTotal, driverPayout)

    return {
      ...base,
      driverPayout,
      platformFee: platformFee ?? numOrNull(q.platform_profit_amount),
      payoutIsSaved: true,
      payoutIsEstimated: false,
      payoutMissing: false,
      warning: manualPayoutOverride ? null : null,
    }
  }

  if (defaultPayout) {
    return {
      ...base,
      driverPayout: defaultPayout.driverPayout,
      platformFee: defaultPayout.platformFee,
      payoutIsSaved: false,
      payoutIsEstimated: true,
      payoutMissing: false,
      warning: ESTIMATE_WARNING,
    }
  }

  return {
    ...base,
    driverPayout: null,
    platformFee: numOrNull(q.platform_profit_amount),
    payoutIsSaved: false,
    payoutIsEstimated: false,
    payoutMissing: true,
    warning:
      customerTotal == null
        ? `${ESTIMATE_WARNING} Customer total unavailable.`
        : ESTIMATE_WARNING,
  }
}

/**
 * @param {number | null | undefined} n
 */
export function formatJobAcceptedMoney(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '—'
  return `£${Number(n).toFixed(2)}`
}
