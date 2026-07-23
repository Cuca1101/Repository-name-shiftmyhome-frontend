import { SERVICE_PAGES } from '../constants/servicePages'

/**
 * Homepage / service card "From £..." prices only — never used by the quote calculator.
 * Source of truth: pricing settings `displayPriceByService` (Admin: Homepage display price).
 * Never read `basePriceByService` (Admin: Minimum service threshold) here.
 */

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
  if (!map || !Object.prototype.hasOwnProperty.call(map, serviceType)) return null
  const v = map[serviceType]
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  return null
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @param {string} serviceType
 * @returns {string | null}
 */
export function formatServiceCardDisplayPrice(settings, serviceType) {
  const amount = resolveServiceCardDisplayPrice(settings, serviceType)
  return amount != null ? `£${Math.round(amount)}` : null
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @returns {Record<string, string | null>}
 */
export function buildServiceCardPriceBySlug(settings) {
  const out = /** @type {Record<string, string | null>} */ ({})
  for (const s of SERVICE_PAGES) {
    out[s.slug] = formatServiceCardDisplayPrice(settings, s.serviceType)
  }
  return out
}
