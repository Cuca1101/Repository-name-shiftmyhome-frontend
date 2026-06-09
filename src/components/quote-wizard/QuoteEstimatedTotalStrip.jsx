import QuotePromoPriceReduction from './QuotePromoPriceReduction'

/**
 * Compact estimated total for desktop quote sidebar (step 3).
 * Do not calculate pricing in UI components. Use shared pricing engine only.
 * @param {{
 *   breakdown: { estimatedTotal?: number } | null,
 *   pricingSettings?: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   promoCode?: string | null,
 *   priceWithoutPromo?: number | null,
 *   className?: string,
 *   note?: string,
 * }} props
 */
export default function QuoteEstimatedTotalStrip({
  breakdown,
  pricingSettings = null,
  promoCode = '',
  priceWithoutPromo = null,
  className = '',
  note = 'Updates as you add details. Final price confirmed by ShiftMyHome.',
}) {
  const estimatedTotal = breakdown?.estimatedTotal
  if (estimatedTotal == null || !Number.isFinite(estimatedTotal)) return null

  return (
    <div
      className={`min-w-0 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-3 ring-1 ring-emerald-100/80 ${className}`.trim()}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        Estimated total
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-emerald-700">
        £{estimatedTotal.toFixed(2)}
      </p>
      <QuotePromoPriceReduction
        promoCode={promoCode}
        pricingSettings={pricingSettings}
        priceWithPromo={estimatedTotal}
        priceWithoutPromo={priceWithoutPromo}
        className="mt-2"
        size="sm"
        showPromoCode
      />
      {note ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">{note}</p>
      ) : null}
    </div>
  )
}
