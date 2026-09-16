/**
 * Inventory volume & specialist heavy-fee rules for the shared pricing engine.
 * Physical m³ is never inflated by handling multipliers for capacity or price.
 */

const money = (n) => Math.round(n * 100) / 100

/**
 * Raw physical volume (van capacity + priced m³). Ignores handlingMultiplier.
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function sumInventoryVolumeRaw(lineItems) {
  let total = 0
  for (const row of lineItems || []) {
    const q = Number(row.quantity) || 0
    const v = Number(row.volumePerUnitM3) || 0
    total += q * v
  }
  return money(total)
}

/**
 * @deprecated Use sumInventoryVolumeRaw — multipliers no longer inflate billed volume.
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function sumInventoryVolume(lineItems) {
  return sumInventoryVolumeRaw(lineItems)
}

/**
 * Count units that require a 2-person crew for safe handling (weightType heavy).
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function countHeavyItemsForCrew(lineItems) {
  let n = 0
  for (const row of lineItems || []) {
    if (String(row.weightType || '').toLowerCase() === 'heavy') {
      n += Math.max(0, Number(row.quantity) || 0)
    }
  }
  return n
}

/**
 * Specialist / exceptional heavy surcharge only.
 * Ordinary appliances (fridge freezer ×1.15, washing machine, etc.) do NOT qualify.
 *
 * Explicit flags win; otherwise legacy heavy + multiplier ≥ 1.2 (American fridge, piano, …).
 * @param {import('./pricingCalculator.js').QuoteLineItem | Record<string, unknown>} row
 */
export function lineItemAppliesHeavyHandlingFee(row) {
  if (!row || typeof row !== 'object') return false
  if (row.appliesHeavyHandlingFee === true || row.heavyFee === true) return true
  if (row.appliesHeavyHandlingFee === false || row.heavyFee === false) return false
  const wt = String(row.weightType || '').toLowerCase()
  if (wt !== 'heavy') return false
  const mult = Number(row.handlingMultiplier) > 0 ? Number(row.handlingMultiplier) : 1
  // Legacy specialist threshold (American fridge, piano, treadmill, …).
  return mult >= 1.2
}

/**
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function countSpecialistHeavyItems(lineItems) {
  let n = 0
  for (const row of lineItems || []) {
    if (lineItemAppliesHeavyHandlingFee(row)) {
      n += Math.max(0, Number(row.quantity) || 0)
    }
  }
  return n
}
