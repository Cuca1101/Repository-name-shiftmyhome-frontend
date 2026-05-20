/**
 * Flatten price breakdown for UI lists (desktop sidebar, mobile summary, emails).
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} b
 * @returns {{ label: string, amount: number, isDiscount?: boolean }[]}
 */
export function collectBreakdownDisplayLines(b) {
  if (!b) return []
  const baseLabel =
    b.basePriceUsesPerManPricing &&
    b.crewSizeUsedInPricing != null &&
    b.basePricePerManUnit != null
      ? `Base (${b.crewSizeUsedInPricing} × £${b.basePricePerManUnit.toFixed(2)} per man)`
      : 'Base'
  /** @type {{ label: string, amount: number, isDiscount?: boolean }[]} */
  const rows = [
    { label: baseLabel, amount: b.basePrice },
    { label: 'Distance', amount: b.distancePrice },
    { label: `Volume (${b.totalCubicMetres.toFixed(2)} m³)`, amount: b.volumePrice },
  ]
  for (const l of b.accessLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.extrasLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.surchargeLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.discountLines || []) {
    rows.push({ label: l.label, amount: l.amount, isDiscount: true })
  }
  if (b.minimumApplied > 0) {
    rows.push({ label: 'Minimum job price adjustment', amount: b.minimumApplied })
  }
  return rows
}
