const STORAGE_KEY = 'smh_marketplace_pricing_defaults_v1'

/**
 * @typedef {'percentage' | 'fixed'} MarketplaceDeductionType
 */

/**
 * @typedef {{
 *   deductionType: MarketplaceDeductionType,
 *   deductionValue: number,
 * }} MarketplacePricingDefaults
 */

function defaultDefaults() {
  return {
    deductionType: /** @type {MarketplaceDeductionType} */ ('percentage'),
    deductionValue: 25,
  }
}

/** @returns {MarketplacePricingDefaults} */
export function loadMarketplacePricingDefaults() {
  if (typeof localStorage === 'undefined') return defaultDefaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDefaults()
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return defaultDefaults()
    const deductionType = p.deductionType === 'fixed' ? 'fixed' : 'percentage'
    const deductionValue = Number(p.deductionValue)
    return {
      deductionType,
      deductionValue: Number.isFinite(deductionValue) && deductionValue >= 0 ? deductionValue : defaultDefaults().deductionValue,
    }
  } catch {
    return defaultDefaults()
  }
}

/** @param {MarketplacePricingDefaults} next */
export function saveMarketplacePricingDefaults(next) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
