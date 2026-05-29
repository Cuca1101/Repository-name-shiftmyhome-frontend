/**
 * Extra items charge — uses shared pricing engine rates (volume + heavy handling only).
 * Do not calculate pricing in UI components; use this module only.
 */
import { sumInventoryVolume } from './pricingCalculator'
import { resolveVolumePricingMultiplier } from './volumePricingMultiplier'

const money = (n) => Math.round(n * 100) / 100

/**
 * @typedef {Object} ExtraItemsChargeResult
 * @property {number} estimatedAmount
 * @property {number} totalVolumeM3
 * @property {{ label: string, amount: number }[]} breakdownLines
 * @property {{ name: string, quantity: number, lineVolumeM3: number, lineAmountGbp: number }[]} itemLines
 * @property {number} volumeMultiplier
 * @property {string} volumeBandLabel
 */

/**
 * Price additional inventory only (no distance, access, minimum job, or surcharges).
 *
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 * @returns {ExtraItemsChargeResult}
 */
export function calculateExtraItemsCharge(settings, lineItems) {
  const s = settings || {}
  const items = lineItems || []
  const totalVolumeM3 = sumInventoryVolume(items)
  const rate = Number(s.pricePerCubicMetre) || 0
  const baseVolumePrice = money(totalVolumeM3 * rate)

  const volScale = resolveVolumePricingMultiplier(s, totalVolumeM3)
  const multiplier = Number(volScale.multiplier) || 1
  const scaledVolumePrice = money(baseVolumePrice * multiplier)

  let heavyCount = 0
  for (const row of items) {
    const wt = String(row.weightType || '').toLowerCase()
    if (wt === 'heavy') heavyCount += Math.max(0, Number(row.quantity) || 0)
  }
  const heavyRate = Number(s.heavyItemHandlingCharge) || 0
  const heavyTotal = money(heavyCount * heavyRate)

  /** @type {{ label: string, amount: number }[]} */
  const breakdownLines = []

  if (totalVolumeM3 > 0 && rate > 0) {
    breakdownLines.push({
      label: `Additional volume (${money(totalVolumeM3)} m³ × £${rate.toFixed(2)}/m³)`,
      amount: baseVolumePrice,
    })
  }
  if (multiplier !== 1 && Math.abs(scaledVolumePrice - baseVolumePrice) > 0.001) {
    breakdownLines.push({
      label: `Volume band (${volScale.bandLabel}) ×${multiplier}`,
      amount: money(scaledVolumePrice - baseVolumePrice),
    })
  }
  if (heavyTotal > 0) {
    breakdownLines.push({
      label: `Heavy item handling (${heavyCount} item${heavyCount === 1 ? '' : 's'})`,
      amount: heavyTotal,
    })
  }

  const estimatedAmount = money(scaledVolumePrice + heavyTotal)

  const itemLines = items.map((row) => {
    const qty = Math.max(0, Number(row.quantity) || 0)
    const volUnit = Number(row.volumePerUnitM3) || 0
    const mult = Number(row.handlingMultiplier) > 0 ? Number(row.handlingMultiplier) : 1
    const lineVolumeM3 = money(qty * volUnit * mult)
    const share = totalVolumeM3 > 0 ? lineVolumeM3 / totalVolumeM3 : 0
    const lineAmountGbp = money(share * scaledVolumePrice)
    return {
      name: String(row.name || 'Item'),
      quantity: qty,
      lineVolumeM3,
      lineAmountGbp,
    }
  })

  return {
    estimatedAmount,
    totalVolumeM3,
    breakdownLines,
    itemLines,
    volumeMultiplier: multiplier,
    volumeBandLabel: volScale.bandLabel,
  }
}
