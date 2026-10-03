/**
 * Shared “Quote reference” block used in the quote sidebar and step forms.
 * @param {{ quoteRef?: string, className?: string, hint?: boolean }} props
 */
export default function QuoteReferenceCard({ quoteRef, className = '', hint = false }) {
  const ref = String(quoteRef || '').trim()
  if (!ref) return null

  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${className}`.trim()}
      aria-label={`Booking reference ${ref}`}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Quote reference</p>
      <p className="mt-0.5 font-mono text-sm font-bold text-brand-800">{ref}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">Keep this handy when you speak to us.</p> : null}
    </div>
  )
}
