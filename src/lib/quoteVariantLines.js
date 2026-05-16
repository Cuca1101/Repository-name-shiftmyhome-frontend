/**
 * Build synthetic line items for pricing when the customer uses a tailored form
 * (not the full inventory library).
 */

const FURNITURE_M3 = {
  sofa: { compact: 1.0, standard: 1.4, large: 2.0 },
  bed: { compact: 0.6, standard: 1.0, large: 1.4 },
  table: { compact: 0.3, standard: 0.6, large: 1.0 },
  appliances: { compact: 0.5, standard: 0.8, large: 1.0 },
  other: { compact: 0.4, standard: 0.7, large: 1.2 },
}

const WEIGHT_MULT = { light: 0.9, medium: 1, heavy: 1.15 }

const OFFICE_M3 = { small: 8, medium: 18, large: 32 }

const CLEARANCE_M3 = { house: 14, garage: 5, garden: 7 }

/**
 * @returns {import('./pricingCalculator.js').QuoteLineItem[]}
 */
export function linesForFurnitureDelivery(itemType, size, weight) {
  const cat = FURNITURE_M3[itemType] ? itemType : 'other'
  const s = FURNITURE_M3[cat][size] ?? 0.7
  const mult = WEIGHT_MULT[weight] ?? 1
  const vol = s * mult
  return [
    {
      name: `Furniture (${itemType})`,
      quantity: 1,
      volumePerUnitM3: vol,
      weightType: weight === 'heavy' ? 'heavy' : 'large',
      handlingMultiplier: 1,
      isCustom: true,
    },
  ]
}

/**
 * @returns {import('./pricingCalculator.js').QuoteLineItem[]}
 */
export function linesForOfficeMove(officeSize) {
  const m3 = OFFICE_M3[officeSize] ?? 12
  return [
    {
      name: 'Office contents (estimate)',
      quantity: 1,
      volumePerUnitM3: m3,
      weightType: 'medium',
      handlingMultiplier: 1,
      isCustom: true,
    },
  ]
}

/**
 * @returns {import('./pricingCalculator.js').QuoteLineItem[]}
 */
export function linesForClearance(clearanceType) {
  const m3 = CLEARANCE_M3[clearanceType] ?? 8
  return [
    {
      name: `Clearance (${clearanceType})`,
      quantity: 1,
      volumePerUnitM3: m3,
      weightType: 'large',
      handlingMultiplier: 1,
      isCustom: true,
    },
  ]
}

/**
 * @returns {import('./pricingCalculator.js').QuoteLineItem[]}
 */
export function linesForManWithVan(itemCount) {
  const n = Math.max(0, Math.min(200, Math.floor(Number(itemCount) || 0)))
  if (n === 0) {
    return [
      {
        name: 'Load (please add item count)',
        quantity: 1,
        volumePerUnitM3: 0.2,
        weightType: 'medium',
        handlingMultiplier: 1,
        isCustom: true,
      },
    ]
  }
  return [
    {
      name: 'Items (estimate)',
      quantity: n,
      volumePerUnitM3: 0.25,
      weightType: 'medium',
      handlingMultiplier: 1,
      isCustom: true,
    },
  ]
}

/**
 * @returns {import('./pricingCalculator.js').QuoteLineItem[]}
 */
export function linesForStudentMove(inventoryNote) {
  const base = 1.2
  const extra = Math.min(3, (inventoryNote || '').length / 400)
  const m3 = base + extra
  return [
    {
      name: 'Student move (small load estimate)',
      quantity: 1,
      volumePerUnitM3: m3,
      weightType: 'medium',
      handlingMultiplier: 1,
      isCustom: true,
    },
  ]
}
