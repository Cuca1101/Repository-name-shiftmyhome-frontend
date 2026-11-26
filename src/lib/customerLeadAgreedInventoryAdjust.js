/**
 * When an admin has set an agreed price on a Customer Lead, inventory add/remove
 * moves that agreed price by the engine total delta (not raw volume £).
 */
import { getFlattenedCatalogEntries, getCatalogItem } from '../components/quote-wizard/inventoryCatalog.js'
import { calculateQuote } from './pricingCalculator'
import { buildQuoteEngineInput } from './buildQuoteEngineInput'
import { wizardStateFromCustomerLeadData } from './quoteRecoveryResume'
import { resolveServiceLabel } from './normalizeServiceType'

function round2(value) {
  return Math.round(Number(value) * 100) / 100
}

const VOLUME_KEYS = ['m3', 'volumePerUnitM3', 'volume_m3', 'cubic_metres_per_unit', 'defaultM3']

/** @type {Map<string, { id: string, name: string, m3: number, weightType?: string, mult?: number }> | null} */
let catalogByNameCache = null

function catalogItemByName(name) {
  const key = String(name || '')
    .trim()
    .toLowerCase()
  if (!key) return null
  if (!catalogByNameCache) {
    catalogByNameCache = new Map()
    for (const entry of getFlattenedCatalogEntries()) {
      const item = entry?.item
      if (!item?.name) continue
      const n = String(item.name).trim().toLowerCase()
      if (!catalogByNameCache.has(n)) catalogByNameCache.set(n, item)
    }
  }
  return catalogByNameCache.get(key) || null
}

/**
 * Prefer stored m³; if missing, use catalogue id/name so remove/add still moves price.
 * @param {Record<string, unknown>} line
 * @returns {number}
 */
export function resolveInventoryLineVolumeM3(line) {
  for (const key of VOLUME_KEYS) {
    if (line?.[key] == null || line[key] === '') continue
    const value = Number(line[key])
    if (Number.isFinite(value) && value >= 0) return value
  }
  if (!line?.isCustom && line?.catalogId != null) {
    const found = getCatalogItem(String(line.catalogId))
    const m3 = Number(found?.item?.m3)
    if (Number.isFinite(m3) && m3 >= 0) return m3
  }
  if (!line?.isCustom) {
    const found = catalogItemByName(line?.name)
    const m3 = Number(found?.m3)
    if (Number.isFinite(m3) && m3 >= 0) return m3
  }
  return 0
}

/**
 * @param {Record<string, unknown>} line
 */
function resolveInventoryLineWeightType(line) {
  const stored = String(line?.weightType || line?.weight_type || '').trim()
  if (stored) return stored
  if (!line?.isCustom && line?.catalogId != null) {
    const found = getCatalogItem(String(line.catalogId))
    if (found?.item?.weightType) return found.item.weightType
  }
  if (!line?.isCustom) {
    const found = catalogItemByName(line?.name)
    if (found?.weightType) return found.weightType
  }
  return 'std'
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lines
 */
export function inventoryLinesToEngineItems(lines) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const volumePerUnitM3 = resolveInventoryLineVolumeM3(line)
    const weightType = resolveInventoryLineWeightType(line)
    const catalog =
      !line?.isCustom && line?.catalogId != null ? getCatalogItem(String(line.catalogId))?.item : null
    const byName = !line?.isCustom && !catalog ? catalogItemByName(line?.name) : null
    const mult = Number(line.mult) > 0 ? Number(line.mult) : Number(catalog?.mult || byName?.mult) || 1
    return {
      name: line.name,
      quantity: Number(line.quantity) || 0,
      volumePerUnitM3,
      handlingMultiplier: mult,
      weightType,
      heavyFee: line.heavyFee,
      appliesHeavyHandlingFee: line.heavyFee,
      handlingFeeOverride: line.handlingFeeOverride ?? null,
      specialStairFeePerFloor: line.specialStairFeePerFloor ?? null,
      isCustom: line.isCustom,
    }
  })
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lines
 */
export function heavyCountFromInventoryLines(lines) {
  let count = 0
  for (const line of Array.isArray(lines) ? lines : []) {
    if (resolveInventoryLineWeightType(line) === 'heavy') count += Number(line.quantity) || 0
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

/**
 * @param {Record<string, unknown>} line
 */
function inventoryLineKey(line) {
  if (line?.catalogId != null && String(line.catalogId).trim() !== '') {
    return `c:${String(line.catalogId)}`
  }
  const name = String(line?.name || '')
    .trim()
    .toLowerCase()
  if (name) return `n:${name}`
  return `id:${String(line?.lineId || '')}`
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} lines
 */
function aggregateInventoryByKey(lines) {
  /** @type {Map<string, { name: string, quantity: number }>} */
  const map = new Map()
  for (const line of Array.isArray(lines) ? lines : []) {
    const name = String(line?.name || '').trim()
    if (!name) continue
    const key = inventoryLineKey(line)
    const quantity = Math.max(0, Math.round(Number(line?.quantity) || 0))
    const prev = map.get(key)
    if (prev) map.set(key, { name: prev.name, quantity: prev.quantity + quantity })
    else map.set(key, { name, quantity })
  }
  return map
}

/**
 * Compare saved inventory to the in-progress edit list.
 * @param {Array<Record<string, unknown>> | null | undefined} previous
 * @param {Array<Record<string, unknown>> | null | undefined} next
 * @returns {{
 *   added: Array<{ name: string, quantity: number }>,
 *   removed: Array<{ name: string, quantity: number }>,
 * }}
 */
export function diffInventorySelection(previous, next) {
  const before = aggregateInventoryByKey(previous)
  const after = aggregateInventoryByKey(next)
  /** @type {Array<{ name: string, quantity: number }>} */
  const added = []
  /** @type {Array<{ name: string, quantity: number }>} */
  const removed = []
  const keys = new Set([...before.keys(), ...after.keys()])
  for (const key of keys) {
    const was = before.get(key)?.quantity || 0
    const now = after.get(key)?.quantity || 0
    const name = after.get(key)?.name || before.get(key)?.name || ''
    if (now > was) added.push({ name, quantity: now - was })
    else if (was > now) removed.push({ name, quantity: was - now })
  }
  added.sort((a, b) => a.name.localeCompare(b.name))
  removed.sort((a, b) => a.name.localeCompare(b.name))
  return { added, removed }
}

/**
 * Live price preview while editing inventory on a Customer Lead.
 * @param {{
 *   pricingSettings: Record<string, unknown> | null | undefined,
 *   lead: Record<string, unknown>,
 *   previousInventoryLines: Array<Record<string, unknown>>,
 *   nextInventoryLines: Array<Record<string, unknown>>,
 * }} params
 */
export function previewLeadInventoryPriceChange({
  pricingSettings,
  lead,
  previousInventoryLines,
  nextInventoryLines,
}) {
  const beforeTotal = engineTotalForLeadWithInventory(
    pricingSettings,
    lead,
    previousInventoryLines,
  )
  const afterTotal = engineTotalForLeadWithInventory(pricingSettings, lead, nextInventoryLines)
  const calculatedDelta =
    beforeTotal != null && afterTotal != null ? round2(afterTotal - beforeTotal) : null

  const agreedRaw = lead?.agreed_price
  const hasAgreed = agreedRaw != null && String(agreedRaw).trim() !== ''
  const agreed = hasAgreed ? Number(agreedRaw) : null
  const agreedAdjust =
    hasAgreed && Number.isFinite(agreed) && agreed >= 0 && beforeTotal != null && afterTotal != null
      ? applyInventoryDeltaToAgreedPrice({
          agreedPrice: agreed,
          beforeTotal,
          afterTotal,
        })
      : null

  const checkoutBefore =
    hasAgreed && Number.isFinite(agreed) && agreed >= 0
      ? round2(agreed)
      : beforeTotal != null
        ? round2(beforeTotal)
        : null
  const checkoutAfter = agreedAdjust
    ? agreedAdjust.agreed_price
    : hasAgreed && Number.isFinite(agreed) && agreed >= 0
      ? round2(agreed)
      : afterTotal != null
        ? round2(afterTotal)
        : null
  const checkoutDelta =
    checkoutBefore != null && checkoutAfter != null ? round2(checkoutAfter - checkoutBefore) : null

  return {
    calculatedBefore: beforeTotal,
    calculatedAfter: afterTotal,
    calculatedDelta,
    checkoutBefore,
    checkoutAfter,
    checkoutDelta,
    usesAgreed: hasAgreed && Number.isFinite(agreed) && agreed >= 0,
  }
}
