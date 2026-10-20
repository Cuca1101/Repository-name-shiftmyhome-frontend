import { useState } from 'react'
import { ChevronDown, Package } from 'lucide-react'
import { buildMoveSummaryExtras } from '../../lib/moveSummaryDisplay'

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'

/**
 * Step 3 extras, shown with the same summary as Step 2.
 * Edit opens the existing extras form underneath.
 */
export default function QuoteReviewExtrasCard({ data, children, editable = true }) {
  const [editing, setEditing] = useState(false)
  const extras = buildMoveSummaryExtras(data)

  if (!editable) return children

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
          <Package className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
          Extras
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">{extras.length} selected</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            aria-expanded={editing}
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? 'Close' : 'Edit'}
            <ChevronDown className={`h-4 w-4 transition ${editing ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      {extras.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {extras.map((extra) => (
            <li key={extra.key} className="flex items-start justify-between gap-3">
              <span className="font-medium text-slate-800">{extra.title}</span>
              <span className="text-right text-slate-600">{extra.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None selected</p>
      )}
      {editing ? (
        <div className="mt-3 space-y-4 border-t border-slate-100 pt-3">{children}</div>
      ) : null}
    </section>
  )
}
