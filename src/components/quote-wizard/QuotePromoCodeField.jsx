import { useMemo } from 'react'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { findPromoMatch } from '../../lib/pricingCalculator'
import { quoteMobileInput } from '../../lib/quoteMobileUiClasses'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'

/**
 * Promo code entry — Step 2 (after email) or legacy Step 3 card layout.
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (next: Record<string, unknown>) => void,
 *   pricingSettings: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   breakdown?: import('../../lib/pricingCalculator.js').QuoteBreakdown | null,
 *   priceWithoutPromo?: number | null,
 *   variant?: 'mobile' | 'desktop',
 *   embedded?: boolean,
 * }} props
 */
export default function QuotePromoCodeField({
  data,
  onChange,
  pricingSettings,
  breakdown = null,
  priceWithoutPromo = null,
  variant = 'desktop',
  embedded = false,
}) {
  const enabled = Boolean(pricingSettings?.promoCodesEnabled)
  const codes = pricingSettings?.promoCodes
  if (!enabled || !Array.isArray(codes) || codes.length === 0) return null

  const isMobile = variant === 'mobile'
  const promoRaw = String(data.promoCode || '').trim()
  const promoMatch = useMemo(
    () => (promoRaw ? findPromoMatch(codes, promoRaw) : null),
    [codes, promoRaw],
  )

  const desktopInput =
    'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const cardInput =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const inputCls = embedded ? (isMobile ? quoteMobileInput : desktopInput) : cardInput

  const labelCls = embedded
    ? isMobile
      ? 'mb-1 block text-xs font-medium text-slate-700'
      : 'mb-1.5 block text-sm font-medium text-slate-700'
    : 'sr-only'

  const field = (
    <>
      <label className={embedded ? 'mt-2 block md:mt-0' : 'mt-3 block'}>
        <span className={labelCls}>Promo code (optional)</span>
        <input
          type="text"
          autoComplete="off"
          value={String(data.promoCode || '')}
          onChange={(e) => applyWizardPatch(onChange, { promoCode: e.target.value })}
          className={`${inputCls}${embedded && !isMobile ? ' mt-1.5' : ''}`}
          placeholder="Enter code"
        />
      </label>

      <QuotePromoPriceReduction
        promoCode={data.promoCode}
        pricingSettings={pricingSettings}
        priceWithPromo={breakdown?.estimatedTotal}
        priceWithoutPromo={priceWithoutPromo}
        className={embedded ? 'mt-2' : 'mt-3'}
        messageStyle={embedded ? 'accepted' : 'priceRange'}
      />

      {promoRaw && !promoMatch ? (
        <p className={`text-xs font-medium text-amber-800 ${embedded ? 'mt-1.5' : 'mt-2'}`} role="status">
          This code was not recognised — check spelling and try again.
        </p>
      ) : null}
    </>
  )

  if (embedded) {
    return field
  }

  const card = isMobile
    ? 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">Promo code</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
        Optional. If your code is valid, a discount is applied to your quote.
      </p>
      {field}
    </div>
  )
}
