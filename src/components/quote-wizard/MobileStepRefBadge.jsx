/**
 * Mobile-only inline step header reference — "REF: SMH-2026-325567"
 * @param {{ quoteRef?: string, className?: string }} props
 */
export default function MobileStepRefBadge({ quoteRef, className = '' }) {
  const ref = String(quoteRef || '').trim()
  if (!ref) return null

  return (
    <span
      className={`quote-step-ref-badge md:hidden inline-flex max-w-none shrink-0 items-center whitespace-nowrap rounded-md border border-blue-200/90 bg-blue-50/90 px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-tight ${className}`}
      aria-label={`Booking reference ${ref}`}
    >
      <span className="font-semibold text-blue-600">REF:</span>
      <span className="ml-1 font-bold text-blue-900">{ref}</span>
    </span>
  )
}
