import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveFinancials } from './quoteJobAdminModel'
import { resolveMarketplacePayoutPresentation } from './marketplacePayoutDisplay'

/** @param {Record<string, unknown>} q */
import { sumJobAdjustmentsGbp } from './jobAdjustments'

export function quoteAdjustmentsSumGbp(q) {
  const o = mergedAdminWorkflowForQuote(q)
  return sumJobAdjustmentsGbp(o.adjustments || [])
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
  return resolveMarketplacePayoutPresentation(q)
}
