/**
 * Read-only mobile debug rows — uses standardDisplayRows from shared pricing engine.
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} pricingBreakdown
 */
export function collectMobilePriceDebugRows(pricingBreakdown) {
  if (!pricingBreakdown) return []
  if (Array.isArray(pricingBreakdown.standardDisplayRows) && pricingBreakdown.standardDisplayRows.length) {
    return pricingBreakdown.standardDisplayRows
  }
  return []
}
