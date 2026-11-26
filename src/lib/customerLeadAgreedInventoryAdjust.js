/**
 * When an admin has set an agreed price on a Customer Lead, inventory add/remove
 * moves that agreed price by the engine total delta (not raw volume £).
 */
import { calculateQuote } from './pricingCalculator'
import { buildQuoteEngineInput } from './buildQuoteEngineInput'
import { wizardStateFromCustomerLeadData } from './quoteRecoveryResume'
import { resolveServiceLabel } from './normalizeServiceType'

function round2(value) {
  return Math.round(Number(value) * 100) / 100
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lines
 */
export function inventoryLinesToEngineItems(lines) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    name: line.name,
    quantity: Number(line.quantity) || 0,
    volumePerUnitM3: line.m3,
    handlingMultiplier: line.mult ?? 1,
    weightType: line.weightType,
    heavyFee: line.heavyFee,
    appliesHeavyHandlingFee: line.heavyFee,
    handlingFeeOverride: line.handlingFeeOverride ?? null,
    specialStairFeePerFloor: line.specialStairFeePerFloor ?? null,
    isCustom: line.isCustom,
  }))
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lines
 */
export function heavyCountFromInventoryLines(lines) {
  let count = 0
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line.weightType === 'heavy') count += Number(line.quantity) || 0
  }
  return count
}

/**
 * @param {{
 *   agreedPrice: number,
 *   beforeTotal: number,
 *   afterTotal: number,
 * }} params
 * @returns {{
 *   agreed_price: number,
 *   calculated_total: number,
 *   estimated_total: number,
 *   delta: number,
 * } | null}
 */
export function applyInventoryDeltaToAgreedPrice({ agreedPrice, beforeTotal, afterTotal }) {
  const agreed = Number(agreedPrice)
  const before = Number(beforeTotal)
  const after = Number(afterTotal)
  if (!Number.isFinite(agreed) || agreed < 0) return null
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  const delta = round2(after - before)
  if (Math.abs(delta) < 0.009) return null
  const nextAgreed = Math.max(0, round2(agreed + delta))
  const nextCalculated = round2(after)
  return {
    agreed_price: nextAgreed,
    calculated_total: nextCalculated,
    estimated_total: nextCalculated,
    delta,
  }
}

/**
 * @param {Record<string, unknown>} pricingSettings
 * @param {Record<string, unknown>} lead
 * @param {Array<Record<string, unknown>>} inventoryLines
 * @returns {number | null}
 */
export function engineTotalForLeadWithInventory(pricingSettings, lead, inventoryLines) {
  if (!pricingSettings || !lead) return null
  const wizard = {
    ...wizardStateFromCustomerLeadData(lead.wizard_data),
    inventoryLines: Array.isArray(inventoryLines) ? inventoryLines : [],
  }
  const serviceType =
    resolveServiceLabel(lead.service_type) ||
    resolveServiceLabel(wizard.serviceType) ||
    'House Removals'
  const lineItems = inventoryLinesToEngineItems(inventoryLines)
  const hasInventory = lineItems.some((line) => Number(line.quantity) > 0)
  const hasDistance = Number(wizard.distanceMiles) > 0
  if (!hasInventory && !hasDistance) return null

  const breakdown = calculateQuote(
    pricingSettings,
    buildQuoteEngineInput({
      serviceType,
      wizard,
      lineItems,
      heavyItemCount: heavyCountFromInventoryLines(inventoryLines),
    }),
  )
  const total = breakdown?.estimatedTotal
  if (total == null || !Number.isFinite(Number(total))) return null
  return round2(total)
}

/**
 * @param {{
 *   pricingSettings: Record<string, unknown>,
 *   lead: Record<string, unknown>,
 *   previousInventoryLines: Array<Record<string, unknown>>,
 *   nextInventoryLines: Array<Record<string, unknown>>,
 * }} params
 */
export function adjustAgreedPriceForInventoryChange({
  pricingSettings,
  lead,
  previousInventoryLines,
  nextInventoryLines,
}) {
  const agreedRaw = lead?.agreed_price
  if (agreedRaw == null || String(agreedRaw).trim() === '') return null
  const agreed = Number(agreedRaw)
  if (!Number.isFinite(agreed) || agreed < 0) return null

  const beforeTotal = engineTotalForLeadWithInventory(
    pricingSettings,
    lead,
    previousInventoryLines,
  )
  const afterTotal = engineTotalForLeadWithInventory(pricingSettings, lead, nextInventoryLines)
  if (beforeTotal == null || afterTotal == null) return null

  return applyInventoryDeltaToAgreedPrice({
    agreedPrice: agreed,
    beforeTotal,
    afterTotal,
  })
}
