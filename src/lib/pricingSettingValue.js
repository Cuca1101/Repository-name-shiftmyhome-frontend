/**
 * Resolve pricing setting values from merged admin settings.
 * Fallback numbers live in defaultPricingSettings.js only — never hardcoded here.
 *
 * Do not calculate pricing in UI components. Use shared pricing engine only.
 */
import { getDefaultPricingSettings } from './defaultPricingSettings'

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @param {keyof ReturnType<typeof getDefaultPricingSettings> | string} key
 * @param {{ allowZero?: boolean }} [opts]
 */
export function resolvePricingNumber(settings, key, opts = {}) {
  const { allowZero = true } = opts
  const raw = settings?.[key]
  const value = Number(raw)
  if (Number.isFinite(value) && (allowZero || value > 0)) return value
  const fallback = Number(getDefaultPricingSettings()[key])
  if (Number.isFinite(fallback) && (allowZero || fallback > 0)) return fallback
  return 0
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 */
export function resolveDepositAmountGbp(settings) {
  const n = resolvePricingNumber(settings, 'depositAmount', { allowZero: false })
  return Math.round(n * 100) / 100
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 */
export function resolveFallbackSpeedMph(settings) {
  const primary = resolvePricingNumber(settings, 'fallbackSpeedMph', { allowZero: false })
  if (primary > 0) return primary
  const legacy = resolvePricingNumber(settings, 'averageSpeedMph', { allowZero: false })
  return legacy > 0 ? legacy : resolvePricingNumber(settings, 'fallbackSpeedMph')
}
