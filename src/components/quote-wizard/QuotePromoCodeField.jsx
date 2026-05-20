/**
 * Step 3 promo code entry — only when admin has enabled codes.
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (next: Record<string, unknown>) => void,
 *   pricingSettings: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   variant?: 'mobile' | 'desktop',
 * }} props
 */
export default function QuotePromoCodeField({ data, onChange, pricingSettings, variant = 'desktop' }) {
  const enabled = Boolean(pricingSettings?.promoCodesEnabled)
  const codes = pricingSettings?.promoCodes
  if (!enabled || !Array.isArray(codes) || codes.length === 0) return null

  const isMobile = variant === 'mobile'
  const input =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const card = isMobile
    ? 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">Promo code</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
        Optional. If your code is valid, a discount is applied on the review step.
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Promo code</span>
        <input
          type="text"
          autoComplete="off"
          value={String(data.promoCode || '')}
          onChange={(e) => onChange({ ...data, promoCode: e.target.value })}
          className={input}
          placeholder="Enter code"
        />
      </label>
    </div>
  )
}
