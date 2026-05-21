import {
  loadDefaultPlatformMarginPercent,
  useDefaultMarginEstimatesEnabled,
} from './marketplacePricingDefaultsStore'
import {
  buildPayoutAccountingPatch,
  driverPayoutFromMargin,
  platformProfitFromMargin,
  quoteHasSavedPayoutFields,
} from './jobPayoutAccounting'
import { quoteCustomerTotalGbp } from './marketplaceQuoteFinance'
import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'

export { quoteHasSavedPayoutFields }

/**
 * @param {Record<string, unknown>} q
 * @param {number} [marginPct]
 */
export function estimatePayoutFromDefaultMargin(q, marginPct) {
  const customerTotal = quoteCustomerTotalGbp(q)
  const m = marginPct ?? loadDefaultPlatformMarginPercent()
  if (customerTotal == null || !Number.isFinite(m)) return null
  const platformProfit = platformProfitFromMargin(customerTotal, m)
  const driverPayout = driverPayoutFromMargin(customerTotal, m, 0)
  return {
    customerTotal,
    platformMarginPercent: m,
    platformProfit,
    driverPayout,
    isEstimate: true,
  }
}

/**
 * Persist default margin payout fields only when nothing was saved manually.
 * @param {string} quoteId
 * @param {Record<string, unknown>} q
 */
export async function applyDefaultPlatformMarginPayoutEstimate(quoteId, q) {
  const id = String(quoteId || '').trim()
  if (!id || quoteHasSavedPayoutFields(q)) return { applied: false }

  const est = estimatePayoutFromDefaultMargin(q)
  if (!est) return { applied: false }

  const patch = buildPayoutAccountingPatch({
    platformMarginPercent: est.platformMarginPercent,
    driverPayoutAmount: est.driverPayout,
    partnerPayoutAmount: null,
    driverPayoutManualOverride: false,
    partnerPayoutManualOverride: false,
    customerTotalForProfit: est.customerTotal,
    partnerPayoutForCalc: 0,
    skipAutoDriver: false,
  })

  await updateQuoteWorkflowAssignmentSilent(id, patch)
  return { applied: true, estimate: est }
}

/**
 * @param {Record<string, unknown>} q
 */
export function shouldUseDefaultMarginEstimate(q) {
  if (!useDefaultMarginEstimatesEnabled()) return false
  return !quoteHasSavedPayoutFields(q)
}
