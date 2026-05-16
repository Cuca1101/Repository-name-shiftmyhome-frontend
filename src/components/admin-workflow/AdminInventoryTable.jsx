import { useMemo } from 'react'

function BoxIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 16-6 3V5l6-3v14ZM9 19V8l6-3v11M9 19 3 16V2l6 3M9 19l6-3" />
    </svg>
  )
}

function SofaIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 14v3a1 1 0 0 0 1 1h2M4 14H3a1 1 0 0 1-1-1v-1a3 3 0 0 1 5.83-1M4 14l2-6h8l2 6M20 14v3a1 1 0 0 1-1 1h-2M20 14h1a1 1 0 0 0 1-1v-1a3 3 0 0 0-5.83-1M9 18h6" />
    </svg>
  )
}

function HeavyIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M8 13h8M6 20h12l-1-7H7l-1 7ZM9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1v2" />
    </svg>
  )
}

function FragileIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
    </svg>
  )
}

/**
 * @param {{ name: string, qty: number | string, volume: string, sizeType: string }} row
 */
function rowIcon(row) {
  const blob = `${String(row.name)} ${String(row.sizeType)}`.toLowerCase()
  if (/fragile|glass|mirror|art|tv\b/.test(blob)) return <FragileIcon className="h-4 w-4 text-amber-600" />
  if (/heavy|piano|safe|american fridge/.test(blob)) return <HeavyIcon className="h-4 w-4 text-rose-600" />
  if (/sofa|bed|mattress|wardrobe|table|desk|chair|chest/.test(blob)) return <SofaIcon className="h-4 w-4 text-violet-600" />
  return <BoxIcon className="h-4 w-4 text-slate-500" />
}

/**
 * @param {{ name: string, qty: number | string, volume: string, sizeType: string }[]} rows
 */
function inventorySummary(rows) {
  let qty = 0
  let volSum = 0
  let volParsed = false
  for (const r of rows) {
    const qn = Number(r.qty)
    if (Number.isFinite(qn)) qty += qn
    else qty += 1
    const vm = String(r.volume || '')
    const m = vm.match(/([\d,.]+)\s*m³/i)
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (Number.isFinite(v)) {
        volSum += v * (Number.isFinite(qn) && qn > 0 ? qn : 1)
        volParsed = true
      }
    }
  }
  return {
    itemCount: rows.length,
    qtyTotal: qty,
    volumeLabel: volParsed ? `${Math.round(volSum * 100) / 100} m³` : '—',
  }
}

/**
 * Removals-style inventory: summary strip + responsive table (desktop) + cards (mobile).
 * @param {{
 *   rows: { name: string, qty: number | string, volume: string, sizeType: string }[],
 *   emptyLabel?: string,
 * }} props
 */
export default function AdminInventoryTable({ rows = [], emptyLabel = 'No inventory items to display.' }) {
  const summary = useMemo(() => inventorySummary(rows), [rows])

  if (!rows.length) {
    return <p className="text-sm text-slate-600">{emptyLabel}</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total line items</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.itemCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total quantity</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.qtyTotal}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total volume (parsed)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{summary.volumeLabel}</p>
        </div>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200/80">
                {rowIcon(r)}
              </div>
              <p className="min-w-0 flex-1 font-semibold leading-snug text-slate-900">{r.name}</p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="font-semibold text-slate-500">Qty</dt>
                <dd className="mt-0.5 tabular-nums font-medium text-slate-900">{r.qty}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Volume</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{r.volume}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-semibold text-slate-500">Size / type</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-800" title={String(r.sizeType)}>
                  {r.sizeType}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03] md:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 pl-5">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3 pr-5">Size / type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className={`text-slate-800 transition-colors hover:bg-brand-50/40 ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
              >
                <td className="px-4 py-3 pl-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200/80">
                      {rowIcon(r)}
                    </div>
                    <span className="font-medium text-slate-900">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-800">{r.qty}</td>
                <td className="px-4 py-3 text-slate-800">{r.volume}</td>
                <td className="px-4 py-3 pr-5 text-slate-600">{r.sizeType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
