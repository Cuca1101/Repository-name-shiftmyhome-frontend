/**
 * @param {{
 *   data: { label: string, value: number, secondary?: number }[],
 *   valueLabel?: string,
 *   secondaryLabel?: string,
 *   formatValue?: (n: number) => string,
 * }} props
 */
export default function AdminMiniBarChart({
  data,
  valueLabel = 'Value',
  secondaryLabel,
  formatValue = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v.toFixed(0)}`),
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No data in this period.</p>
  }

  const max = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1)

  return (
    <div className="space-y-3">
      {secondaryLabel ? (
        <div className="flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-600" aria-hidden />
            {valueLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-violet-400" aria-hidden />
            {secondaryLabel}
          </span>
        </div>
      ) : null}
      <ul className="space-y-2">
        {data.map((row) => (
          <li key={row.label} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="font-medium text-slate-600">{row.label}</span>
            <div className="flex h-5 min-w-0 gap-0.5 overflow-hidden rounded-md bg-slate-100">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                title={`${valueLabel}: ${formatValue(row.value)}`}
              />
              {row.secondary != null ? (
                <div
                  className="h-full bg-violet-400 transition-all"
                  style={{ width: `${Math.max(2, (row.secondary / max) * 100)}%` }}
                  title={`${secondaryLabel}: ${formatValue(row.secondary)}`}
                />
              ) : null}
            </div>
            <span className="shrink-0 tabular-nums font-semibold text-slate-800">{formatValue(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
