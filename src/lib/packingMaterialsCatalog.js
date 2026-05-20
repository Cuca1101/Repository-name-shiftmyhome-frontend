/**
 * Packing materials catalogue — shared by admin, quote Step 3, and pricing calculator.
 * Per-item prices come from Admin → Pricing Engine when per-item mode is enabled.
 */

/** @typedef {import('./pricingCalculator.js').PricingSettings} PricingSettings */

/**
 * @typedef {Object} PackingMaterialCatalogItem
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} adminHelper
 * @property {string} unit
 * @property {string} unitPlural
 * @property {string} priceKey — key on PricingSettings
 * @property {string} [legacyPriceKey] — fallback price key when loading old settings
 */

/** @type {PackingMaterialCatalogItem[]} */
export const PACKING_MATERIALS_CATALOG = [
  {
    id: 'smallBoxes',
    label: 'Small moving box',
    description: 'Suitable for books, tools, and heavier compact items.',
    adminHelper: 'Suitable for books, tools, and heavier compact items.',
    unit: 'box',
    unitPlural: 'boxes',
    priceKey: 'packingMaterialPriceSmallBoxes',
  },
  {
    id: 'mediumBoxes',
    label: 'Medium moving box',
    description: 'Suitable for clothes, kitchen items, toys, and general household packing.',
    adminHelper: 'Suitable for clothes, kitchen items, toys, and general household packing.',
    unit: 'box',
    unitPlural: 'boxes',
    priceKey: 'packingMaterialPriceMediumBoxes',
    legacyPriceKey: 'packingMaterialPriceBoxes',
  },
  {
    id: 'largeBoxes',
    label: 'Large moving box',
    description: 'Suitable for bedding, pillows, and lightweight bulky items.',
    adminHelper: 'Suitable for bedding, pillows, and lightweight bulky items.',
    unit: 'box',
    unitPlural: 'boxes',
    priceKey: 'packingMaterialPriceLargeBoxes',
  },
  {
    id: 'extraLargeBoxes',
    label: 'Extra large moving box',
    description: 'Suitable for duvets and oversized lightweight items.',
    adminHelper: 'Suitable for duvets and oversized lightweight items.',
    unit: 'box',
    unitPlural: 'boxes',
    priceKey: 'packingMaterialPriceExtraLargeBoxes',
  },
  {
    id: 'bubble',
    label: 'Bubble wrap (10m roll)',
    description:
      'Helps protect fragile items, mirrors, TVs, glass, and delicate furniture.',
    adminHelper:
      '10 metre roll for fragile items, TVs, mirrors, glass, ornaments, and furniture protection.',
    unit: 'roll',
    unitPlural: 'rolls',
    priceKey: 'packingMaterialPriceBubble',
  },
  {
    id: 'paper',
    label: 'Packing paper (50-sheet pack)',
    description: 'Useful for wrapping plates, glasses, ornaments, and kitchenware.',
    adminHelper:
      '50-sheet pack for plates, glasses, kitchenware, ornaments, and fragile items.',
    unit: 'pack',
    unitPlural: 'packs',
    priceKey: 'packingMaterialPricePaper',
  },
  {
    id: 'tape',
    label: 'Packing tape (roll)',
    description: 'Strong tape for sealing boxes securely.',
    adminHelper: 'Strong packing tape roll for securely sealing boxes.',
    unit: 'roll',
    unitPlural: 'rolls',
    priceKey: 'packingMaterialPriceTape',
  },
  {
    id: 'mattress',
    label: 'Mattress cover',
    description: 'Helps keep mattresses clean and protected during transport.',
    adminHelper: 'Protective mattress cover for transport and storage.',
    unit: 'cover',
    unitPlural: 'covers',
    priceKey: 'packingMaterialPriceMattress',
  },
]

const BOX_IDS = ['smallBoxes', 'mediumBoxes', 'largeBoxes', 'extraLargeBoxes']

/**
 * @returns {Record<string, number>}
 */
export function emptyPackingMaterialQuantities() {
  /** @type {Record<string, number>} */
  const q = { boxes: 0, bubble: 0, paper: 0, tape: 0, mattress: 0 }
  for (const id of BOX_IDS) q[id] = 0
  return q
}

/**
 * Map legacy `boxes` / `packingApproxBoxes` into mediumBoxes when needed.
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, number>}
 */
export function normalizePackingMaterialQuantities(raw) {
  const q = emptyPackingMaterialQuantities()
  if (!raw || typeof raw !== 'object') return q

  for (const item of PACKING_MATERIALS_CATALOG) {
    const v = Number(/** @type {Record<string, unknown>} */ (raw)[item.id])
    if (Number.isFinite(v) && v > 0) q[item.id] = Math.round(v)
  }

  const legacyBoxes = Math.max(0, Number(/** @type {Record<string, unknown>} */ (raw).boxes) || 0)
  if (legacyBoxes > 0 && sumBoxQuantities(q) === 0) {
    q.mediumBoxes = legacyBoxes
  }

  q.boxes = sumBoxQuantities(q)
  return q
}

/**
 * @param {Record<string, number>} q
 */
export function sumBoxQuantities(q) {
  return BOX_IDS.reduce((s, id) => s + (Number(q[id]) || 0), 0)
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Record<string, number>}
 */
export function parsePackingMaterialQuantities(data) {
  if (data?.packingMaterialsQuantities && typeof data.packingMaterialsQuantities === 'object') {
    return normalizePackingMaterialQuantities(
      /** @type {Record<string, unknown>} */ (data.packingMaterialsQuantities),
    )
  }

  const q = emptyPackingMaterialQuantities()
  const approx = Math.max(0, Number(data?.packingApproxBoxes) || 0)
  if (approx > 0) {
    q.mediumBoxes = approx
    q.boxes = approx
  }

  const text = String(data?.packingMaterialsDetail || data?.packingWhat || '').trim()
  if (text) {
    for (const line of text.split('\n')) {
      const m = line.match(/^(.+?):\s*(\d+)/i)
      if (!m) continue
      const label = m[1].toLowerCase()
      const n = parseInt(m[2], 10) || 0
      if (n <= 0) continue

      if (label.includes('extra large') || label.includes('extra-large')) q.extraLargeBoxes = n
      else if (label.includes('small')) q.smallBoxes = n
      else if (label.includes('medium')) q.mediumBoxes = n
      else if (label.includes('large') && !label.includes('extra')) q.largeBoxes = n
      else if (label.includes('bubble')) q.bubble = n
      else if (label.includes('paper')) q.paper = n
      else if (label.includes('tape')) q.tape = n
      else if (label.includes('mattress')) q.mattress = n
      else if (label.includes('box')) {
        if (!q.mediumBoxes) q.mediumBoxes = n
        q.boxes = n
      }
    }
    q.boxes = sumBoxQuantities(q) || q.boxes
  }

  return normalizePackingMaterialQuantities(q)
}

/**
 * @param {Record<string, number>} quantities
 */
export function buildPackingWhatFromQuantities(quantities) {
  const q = normalizePackingMaterialQuantities(quantities)
  return PACKING_MATERIALS_CATALOG.filter((m) => (q[m.id] || 0) > 0)
    .map((m) => {
      const n = q[m.id]
      const unitLabel = n === 1 ? m.unit : m.unitPlural
      return `${m.label}: ${n} ${unitLabel}`
    })
    .join('\n')
}

/**
 * Unit price for one catalogue item from admin settings (with legacy fallback).
 * @param {PricingSettings | null | undefined} settings
 * @param {PackingMaterialCatalogItem} item
 */
export function getPackingMaterialUnitPrice(settings, item) {
  if (!settings) return 0
  const primary = Number(/** @type {Record<string, unknown>} */ (settings)[item.priceKey])
  if (Number.isFinite(primary) && primary > 0) return primary
  if (item.legacyPriceKey) {
    const legacy = Number(/** @type {Record<string, unknown>} */ (settings)[item.legacyPriceKey])
    if (Number.isFinite(legacy) && legacy > 0) return legacy
  }
  return 0
}

/**
 * @param {PricingSettings | null | undefined} settings
 * @returns {Record<string, number>}
 */
export function resolvePackingMaterialUnitPrices(settings) {
  /** @type {Record<string, number>} */
  const out = {}
  for (const item of PACKING_MATERIALS_CATALOG) {
    out[item.id] = getPackingMaterialUnitPrice(settings, item)
  }
  out.boxes = out.mediumBoxes
  return out
}

/**
 * @param {PricingSettings | null | undefined} settings
 */
export function isPackingMaterialPerItemPricingActive(settings) {
  if (!settings || !settings.packingMaterialPerItemEnabled) return false
  const prices = resolvePackingMaterialUnitPrices(settings)
  return Object.values(prices).some((v) => v > 0)
}

/**
 * @param {typeof PACKING_MATERIALS_CATALOG[number]} material
 * @param {PricingSettings | null | undefined} settings
 */
export function formatPackingMaterialPriceHint(material, settings) {
  if (!isPackingMaterialPerItemPricingActive(settings)) return null
  const rate = getPackingMaterialUnitPrice(settings, material)
  if (!(rate > 0)) return null
  const unit =
    material.id === 'bubble'
      ? '10m roll'
      : material.id === 'paper'
        ? '50-sheet pack'
        : material.unit
  return `£${rate.toFixed(2)} per ${unit}`
}
