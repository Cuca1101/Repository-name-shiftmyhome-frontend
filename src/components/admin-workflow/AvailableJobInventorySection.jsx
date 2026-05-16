import { useMemo } from 'react'
import {
  buildAvailableJobInventoryDisplayRows,
  summarizeAvailableJobInventory,
} from '../../lib/availableJobInventoryDisplay'

const cardShell = 'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

/**
 * Inventory block for Available Job Details only — table + summary cards.
 * @param {{ quote: Record<string, unknown> }} props
 */
export default function AvailableJobInventorySection({ quote }) {
  const rows = useMemo(() => buildAvailableJobInventoryDisplayRows(quote), [quote])
  const summary = useMemo(() => summarizeAvailableJobInventory(rows), [rows])

  return (
    <section className={cardShell}>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <InventoryIcon />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Inventory</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">Items & cubic capacity</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 sm:text-right">Display only — stored quote data is unchanged.</p>
      </div>

      <div className="bg-slate-50/40 p-5 sm:p-6">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
            No inventory line items could be parsed for this job. Check Notes or raw debug if the customer pasted a
            free-text list.
          </p>
        ) : (
          <>
            <SummaryStrip summary={summary} />
            <InventoryTable rows={rows} />
          </>
        )}
      </div>
    </section>
  )
}

function InventoryIcon() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
      <BoxStackIcon className="h-5 w-5" />
    </div>
  )
}

/** @param {{ summary: { itemCount: number, qtyTotal: number, volumeLabel: string } }} props */
function SummaryStrip({ summary }) {
  const cards = [
    { label: 'Total items', value: summary.itemCount },
    { label: 'Total quantity', value: summary.qtyTotal },
    { label: 'Total volume', value: summary.volumeLabel },
  ]

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-900/[0.03]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

/** @param {{ rows: { name: string, qty: number | string, volume: string, sizeType: string }[] }} props */
function InventoryTable({ rows }) {
  return (
    <>
      <ul className="space-y-2.5 md:hidden">
        {rows.map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02]"
          >
            <p className="font-semibold leading-snug text-slate-900">{r.name}</p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
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
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3.5">Item</th>
              <th className="w-20 px-4 py-3.5 text-right">Qty</th>
              <th className="w-28 px-4 py-3.5 text-right">Volume</th>
              <th className="px-5 py-3.5">Size / type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className={`transition-colors hover:bg-brand-50/30 ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
              >
                <td className="px-5 py-3.5 font-medium leading-snug text-slate-900">{r.name}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-800">{r.qty}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-800">{r.volume}</td>
                <td className="px-5 py-3.5 text-slate-600">{r.sizeType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function BoxStackIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 16-6 3V5l6-3v14ZM9 19V8l6-3v11M9 19 3 16V2l6 3M9 19l6-3" />
    </svg>
  )
}
