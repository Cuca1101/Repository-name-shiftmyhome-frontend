const STORAGE_KEY_V1 = 'smh_marketplace_pricing_defaults_v1'
const STORAGE_KEY = 'smh_marketplace_pricing_defaults_v2'

/**
 * @typedef {'percentage' | 'fixed'} MarketplaceDeductionType
 */

/**
 * @typedef {{
 *   deductionType: MarketplaceDeductionType,
 *   deductionValue: number,
 *   defaultPlatformMarginPercent: number,
 *   useDefaultMarginEstimates: boolean,
 *   autoMarketplace: {
 *     enabled: boolean,
 *     delayMinutes: number,
 *     minJobValueGbp: number | null,
 *     maxDistanceMiles: number | null,
 *     serviceFilters: string[],
 *     excludeSameDayUrgent: boolean,
 *   },
 * }} MarketplacePricingDefaults
 */

function defaultAutoMarketplace() {
  return {
    enabled: false,
    delayMinutes: 10,
    minJobValueGbp: null,
    maxDistanceMiles: null,
    serviceFilters: [],
    excludeSameDayUrgent: false,
  }
}

function defaultDefaults() {
  return {
    deductionType: /** @type {MarketplaceDeductionType} */ ('percentage'),
    deductionValue: 25,
    defaultPlatformMarginPercent: 20,
    useDefaultMarginEstimates: true,
    autoMarketplace: defaultAutoMarketplace(),
  }
}

/**
 * @param {unknown} raw
 * @returns {MarketplacePricingDefaults}
 */
function normalizeParsed(raw) {
  const base = defaultDefaults()
  if (!raw || typeof raw !== 'object') return base
  const p = /** @type {Record<string, unknown>} */ (raw)

  const deductionType = p.deductionType === 'fixed' ? 'fixed' : 'percentage'
  const deductionValue = Number(p.deductionValue)
  const defaultPlatformMarginPercent = Number(p.defaultPlatformMarginPercent)
  const am = p.autoMarketplace && typeof p.autoMarketplace === 'object' ? p.autoMarketplace : {}
  const amObj = /** @type {Record<string, unknown>} */ (am)

  const delayMinutes = Number(amObj.delayMinutes)
  const minJobValueGbp = Number(amObj.minJobValueGbp)
  const maxDistanceMiles = Number(amObj.maxDistanceMiles)
  const serviceFilters = Array.isArray(amObj.serviceFilters)
    ? amObj.serviceFilters.map((s) => String(s).trim()).filter(Boolean)
    : typeof amObj.serviceFilters === 'string'
      ? String(amObj.serviceFilters)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  return {
    deductionType,
    deductionValue:
      Number.isFinite(deductionValue) && deductionValue >= 0 ? deductionValue : base.deductionValue,
    defaultPlatformMarginPercent:
      Number.isFinite(defaultPlatformMarginPercent) &&
      defaultPlatformMarginPercent >= 0 &&
      defaultPlatformMarginPercent <= 100
        ? defaultPlatformMarginPercent
        : base.defaultPlatformMarginPercent,
    useDefaultMarginEstimates: p.useDefaultMarginEstimates !== false,
    autoMarketplace: {
      enabled: Boolean(amObj.enabled),
      delayMinutes: [5, 10, 15, 30].includes(delayMinutes) ? delayMinutes : 10,
      minJobValueGbp:
        Number.isFinite(minJobValueGbp) && minJobValueGbp > 0 ? minJobValueGbp : null,
      maxDistanceMiles:
        Number.isFinite(maxDistanceMiles) && maxDistanceMiles > 0 ? maxDistanceMiles : null,
      serviceFilters,
      excludeSameDayUrgent: Boolean(amObj.excludeSameDayUrgent),
    },
  }
}

/** @returns {MarketplacePricingDefaults} */
export function loadMarketplacePricingDefaults() {
  if (typeof localStorage === 'undefined') return defaultDefaults()
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY)
    if (rawV2) return normalizeParsed(JSON.parse(rawV2))

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1)
    if (rawV1) {
      const migrated = normalizeParsed(JSON.parse(rawV1))
      saveMarketplacePricingDefaults(migrated)
      return migrated
    }
    return defaultDefaults()
  } catch {
    return defaultDefaults()
  }
}

/** @param {MarketplacePricingDefaults} next */
export function saveMarketplacePricingDefaults(next) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeParsed(next)))
  } catch {
    /* ignore */
  }
}

/** @returns {number} */
export function loadDefaultPlatformMarginPercent() {
  return loadMarketplacePricingDefaults().defaultPlatformMarginPercent
}

/** @returns {boolean} */
export function useDefaultMarginEstimatesEnabled() {
  return loadMarketplacePricingDefaults().useDefaultMarginEstimates
}
