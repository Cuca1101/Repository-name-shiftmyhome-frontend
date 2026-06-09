import { findPromoMatch } from './pricingCalculator'

/** @param {number | null | undefined} amount */
export function formatPromoGbp(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

/**
 * @param {{
 *   promoCode?: string | null,
 *   pricingSettings?: import('./pricingCalculator.js').PricingSettings | null,
 *   priceWithPromo?: number | null,
 *   priceWithoutPromo?: number | null,
 * }} params
 * @returns {{
 *   priceBefore: number,
 *   priceWithPromo: number,
 *   savingsAmount: number,
 *   discountPercent: number,
 *   promoLabel: string,
 * } | null}
 */
export function resolvePromoPriceReduction({
  promoCode,
  pricingSettings,
  priceWithPromo,
  priceWithoutPromo,
}) {
  const enabled = Boolean(pricingSettings?.promoCodesEnabled)
  const codes = pricingSettings?.promoCodes
  if (!enabled || !Array.isArray(codes) || codes.length === 0) return null

  const promoRaw = String(promoCode || '').trim()
  if (!promoRaw) return null

  const match = findPromoMatch(codes, promoRaw)
  if (!match) return null

  const withPromo = Number(priceWithPromo)
  const withoutPromo = Number(priceWithoutPromo)
  if (!Number.isFinite(withPromo) || !Number.isFinite(withoutPromo)) return null
  if (withoutPromo <= withPromo) return null

  const savingsAmount = Math.round((withoutPromo - withPromo) * 100) / 100
  const configuredPct = Math.min(100, Math.max(0, Number(match.discountValue) || 0))
  const discountPercent =
    match.discountType === 'fixed'
      ? withoutPromo > 0
        ? Math.round((savingsAmount / withoutPromo) * 1000) / 10
        : 0
      : configuredPct

  return {
    priceBefore: withoutPromo,
    priceWithPromo: withPromo,
    savingsAmount,
    discountPercent,
    promoLabel: String(match.code || promoRaw).trim().toUpperCase(),
  }
}
