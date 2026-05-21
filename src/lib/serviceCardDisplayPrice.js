import { SERVICE_PAGES } from '../constants/servicePages'

/**
 * Homepage / service card "From £..." prices only — never used by the quote calculator.
 */

/** Marketing defaults when admin display price is unset (not quote base prices). */
export function getDefaultServiceCardDisplayPrices() {
  return {
    'House Removals': 79,
    'Man with Van': 65,
    'Furniture Delivery': 60,
  }
}

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function sanitizeDisplayPriceByService(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = /** @type {Record<string, number>} */ ({})
  for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (raw))) {
    const n = Number(v)
    if (typeof k === 'string' && k.length && Number.isFinite(n) && n > 0) {
      out[k] = n
    }
  }
  return out
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @param {string} serviceType
 * @returns {number | null}
 */
export function resolveServiceCardDisplayPrice(settings, serviceType) {
  const map = settings?.displayPriceByService
  if (map && Object.prototype.hasOwnProperty.call(map, serviceType)) {
    const v = map[serviceType]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
    return null
  }
  const fallback = getDefaultServiceCardDisplayPrices()[serviceType]
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) return fallback
  return null
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @returns {Record<string, string | null>}
 */
export function buildServiceCardPriceBySlug(settings) {
  const out = /** @type {Record<string, string | null>} */ ({})
  for (const s of SERVICE_PAGES) {
    const amount = resolveServiceCardDisplayPrice(settings, s.serviceType)
    out[s.slug] = amount != null ? `£${Math.round(amount)}` : null
  }
  return out
}
