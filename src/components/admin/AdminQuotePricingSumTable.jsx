/**
 * Clear Linie | Sumă audit table for quote pricing (Available Jobs + Customer Leads).
 * @param {{
 *   rows: {
 *     label: string,
 *     amount: number | null,
 *     valueText?: string,
 *     isDiscount?: boolean,
 *     isSubtotal?: boolean,
 *     isTotal?: boolean,
 *     isPackage?: boolean,
 *   }[],
 *   emptyMessage?: string,
 *   packageBadge?: string | null,
 * }} props
 */
export default function AdminQuotePricingSumTable({
  rows,
  emptyMessage = 'No pricing breakdown available.',
  packageBadge = null,
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <p className="text-sm text-slate-600">{emptyMessage}</p>
  }

  const badge = packageBadge || rows.find((r) => r.isPackage)?.valueText || null

  return (
    <div className="space-y-3">
      {badge ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Service package
          </span>
          <span className="inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-900">
            {badge}
          </span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full min-w-0 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Linie</th>
              <th className="px-3 py-2.5 text-right font-semibold">Sumă</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isSub = Boolean(row.isSubtotal)
              const isTot = Boolean(row.isTotal)
              const isPkg = Boolean(row.isPackage)
              const isDisc = Boolean(row.isDiscount) || Number(row.amount) < 0
              const rowCls = isTot
                ? 'border-t-2 border-slate-300 bg-emerald-50/70 font-bold text-slate-900'
                : isSub
                  ? 'border-t border-slate-200 bg-slate-50 font-semibold text-slate-900'
                  : isPkg
                    ? 'border-t border-brand-100 bg-brand-50/40 font-semibold text-brand-950'
                    : 'border-t border-slate-100 text-slate-800'

              let amountText = '—'
              if (row.valueText != null && String(row.valueText).trim()) {
                amountText = String(row.valueText).trim()
              } else if (row.amount != null && Number.isFinite(Number(row.amount))) {
                const amount = Number(row.amount)
                amountText = isDisc ? `−£${Math.abs(amount).toFixed(2)}` : `£${amount.toFixed(2)}`
              }

              const amountCls = isTot
                ? 'text-emerald-800'
                : isDisc
                  ? 'text-emerald-700'
                  : isPkg
                    ? 'text-brand-900'
                    : 'text-slate-900'

              return (
                <tr key={`${row.label}-${i}`} className={rowCls}>
                  <td className="min-w-0 break-words px-3 py-2.5">{row.label}</td>
                  <td className={`shrink-0 px-3 py-2.5 text-right tabular-nums ${amountCls}`}>
                    {amountText}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
