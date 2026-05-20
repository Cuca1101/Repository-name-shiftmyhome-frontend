import { collectBreakdownDisplayLines } from '../../lib/pricingBreakdownDisplay'

/**
 * Compact breakdown list — same data on mobile and desktop (no separate calculator).
 * @param {{ breakdown: import('../../lib/pricingCalculator.js').PriceBreakdown | null, className?: string, dense?: boolean }} props
 */
export default function QuoteBreakdownLines({ breakdown, className = '', dense = false }) {
  const rows = collectBreakdownDisplayLines(breakdown)
  if (!rows.length) return null

  const liClass = dense
    ? 'flex min-w-0 items-start justify-between gap-2 text-[11px] leading-snug'
    : 'flex min-w-0 items-start justify-between gap-2 text-xs leading-relaxed sm:text-sm'

  return (
    <ul className={`min-w-0 list-none space-y-1 ${className}`.trim()}>
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className={liClass}>
          <span className="min-w-0 break-words text-slate-600">{row.label}</span>
          <span
            className={`shrink-0 tabular-nums font-medium ${
              row.isDiscount ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {row.isDiscount ? '−' : ''}£{Math.abs(row.amount).toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  )
}
