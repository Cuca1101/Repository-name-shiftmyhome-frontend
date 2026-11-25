/**
 * Boxes the customer orders from us are also goods on the van.
 * Purchase price stays a packing-material line. Volume uses the same
 * per-box sizes as the inventory catalogue so the existing volume tariff applies.
 */

import { normalizePackingMaterialQuantities } from './packingMaterialsCatalog.js'

export const SUPPLIED_BOXES_NOTE = 'Boxes supplied by us'

/** @type {Record<string, { name: string, m3: number, weightType: string, mult: number }>} */
const SUPPLIED_BOX_SPECS = {
  smallBoxes: { name: 'Small moving box', m3: 0.05, weightType: 'small', mult: 1 },
  mediumBoxes: { name: 'Medium moving box', m3: 0.1, weightType: 'small', mult: 1 },
  largeBoxes: { name: 'Large moving box', m3: 0.2, weightType: 'medium', mult: 1 },
  extraLargeBoxes: { name: 'Extra large moving box', m3: 0.3, weightType: 'medium', mult: 1 },
}

/**
 * @param {string} materialId
 */
export function suppliedBoxLineId(materialId) {
  return `supplied-box:${materialId}`
}

/**
 * @param {string} materialId
 */
export function suppliedBoxDisplayName(materialId) {
  const spec = SUPPLIED_BOX_SPECS[materialId]
  if (!spec) return SUPPLIED_BOXES_NOTE
  return `${spec.name} (${SUPPLIED_BOXES_NOTE})`
}

/**
 * @param {Record<string, unknown> | null | undefined} line
 */
export function isSuppliedBoxLine(line) {
  if (!line || typeof line !== 'object') return false
  if (line.suppliedByUs) return true
  const id = String(line.lineId || '')
  if (id.startsWith('supplied-box:')) return true
  return String(line.name || '').includes(SUPPLIED_BOXES_NOTE)
}

/**
 * @param {unknown} lines
 * @param {Record<string, unknown> | null | undefined} quantities
 */
export function syncSuppliedBoxesIntoInventory(lines, quantities) {
  const kept = (Array.isArray(lines) ? lines : []).filter((line) => !isSuppliedBoxLine(line))
  const qty = normalizePackingMaterialQuantities(quantities || {})
  const supplied = []
  for (const [materialId, spec] of Object.entries(SUPPLIED_BOX_SPECS)) {
    const count = Math.max(0, Math.round(Number(qty[materialId]) || 0))
    if (count <= 0) continue
    supplied.push({
      lineId: suppliedBoxLineId(materialId),
      catalogId: null,
      name: suppliedBoxDisplayName(materialId),
      quantity: count,
      m3: spec.m3,
      volumePerUnitM3: spec.m3,
      weightType: spec.weightType,
      mult: spec.mult,
      heavyFee: false,
      isCustom: false,
      suppliedByUs: true,
      suppliedMaterialId: materialId,
    })
  }
  return [...kept, ...supplied]
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lineItems
 * @param {Record<string, unknown> | null | undefined} quantities
 */
export function mergeSuppliedBoxesIntoEngineItems(lineItems, quantities) {
  const kept = (Array.isArray(lineItems) ? lineItems : []).filter((item) => !isSuppliedBoxLine(item))
  const supplied = syncSuppliedBoxesIntoInventory([], quantities).map((line) => ({
    name: line.name,
    quantity: line.quantity,
    volumePerUnitM3: line.m3,
    handlingMultiplier: line.mult,
    weightType: line.weightType,
    heavyFee: false,
    appliesHeavyHandlingFee: false,
    isCustom: false,
    suppliedByUs: true,
  }))
  return [...kept, ...supplied]
}
