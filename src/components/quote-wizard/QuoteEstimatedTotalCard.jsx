/**
 * Step 4 estimated total reassurance card (shared mobile + desktop).
 * Do not calculate pricing in UI components. Use shared pricing engine only.
 * @param {{ breakdown: { estimatedTotal?: number } | null, className?: string }} props
 */
export default function QuoteEstimatedTotalCard({ breakdown, className = '' }) {
  const estimatedTotal = breakdown?.estimatedTotal
  const totalFormatted =
    estimatedTotal != null && Number.isFinite(estimatedTotal)
      ? `£${estimatedTotal.toFixed(2)}`
      : '—'

  const card =
    'min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 border-emerald-100/90 bg-gradient-to-br from-emerald-50/40 to-white p-4 shadow-sm md:border-slate-200 md:p-6 md:shadow-card'

  return (
    <div
      className={`${card} ${className}`.trim()}
      aria-labelledby="quote-estimated-total-heading"
    >
      <p
        id="quote-estimated-total-heading"
        className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
      >
        Estimated total
      </p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700 md:text-3xl">
        {breakdown ? totalFormatted : 'Calculating…'}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-slate-700 md:text-sm">
        Your estimate is based on the details provided. If anything doesn&apos;t look right, or
        you&apos;d like to discuss the move before booking, please call us and we&apos;ll be happy
        to help. If everything looks good, you can confirm your booking securely below.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-xs">
        If your inventory or access details change later, we may adjust the final price before your
        move — we&apos;ll always confirm any changes with you first.
      </p>
    </div>
  )
}
