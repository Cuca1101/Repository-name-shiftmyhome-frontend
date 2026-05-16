import { useMemo } from 'react'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import { formatMarketplaceStatusSummary } from '../../lib/marketplaceListingStatus'

/**
 * @param {{ t?: string | null, label: string, detail?: string }} e
 */
function TimelineItem({ e, isLast }) {
  return (
    <li className="relative flex gap-3 pl-0.5">
      <div className="flex flex-col items-center pt-0.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-brand-500 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]" />
        {!isLast ? <span className="mt-1 min-h-[2.25rem] w-px grow bg-gradient-to-b from-slate-200 to-slate-100" aria-hidden /> : null}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-5'}`}>
        <p className="text-[13px] font-semibold leading-snug text-slate-900">{e.label}</p>
        {e.t ? (
          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500">{formatDateTimeUK(e.t)}</p>
        ) : null}
        {e.detail ? (
          <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50/90 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
            {e.detail}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * @param {{
 *   quote: Record<string, unknown>,
 *   overrides: Record<string, unknown>,
 *   terminal: boolean,
 *   onOpenReassignDriver: () => void,
 *   onOpenReassignPartner: () => void,
 *   onMarkComplete: () => void,
 *   onCancelJob: () => void,
 * }} props
 */
export default function AdminJobDetailsSidebar({
  quote: q,
  overrides,
  terminal,
  onOpenReassignDriver,
  onOpenReassignPartner,
  onMarkComplete,
  onCancelJob,
}) {
  const timeline = useMemo(() => {
    /** @type {{ t?: string | null, label: string, detail?: string }[]} */
    const events = []
    if (q.created_at) events.push({ t: String(q.created_at), label: 'Job / quote created', detail: 'Lead entered the system' })
    if (q.paid_at) {
      events.push({
        t: String(q.paid_at),
        label: 'Payment activity',
        detail: `Status: ${String(q.payment_status || '—').replace(/_/g, ' ')}`,
      })
    }
    if (q.updated_at && String(q.updated_at) !== String(q.created_at)) {
      events.push({ t: String(q.updated_at), label: 'Record last updated', detail: '' })
    }
    if (String(q.status || '').trim()) {
      events.push({ t: null, label: 'Current workflow status', detail: String(q.status) })
    }
    const mv = String(overrides?.marketplaceVisibility || '')
    if (mv === 'visible_in_marketplace') {
      events.push({ t: null, label: 'Marketplace', detail: 'Visible to partners' })
    } else if (mv === 'assigned') {
      events.push({ t: null, label: 'Marketplace', detail: 'Accepted / assigned via marketplace' })
    }
    const log = String(overrides?.adminNotesLog || '').trim()
    if (log) {
      const lines = log.split('\n').filter((x) => x.trim())
      const tail = lines.slice(-12)
      for (const line of tail) {
        events.push({ t: null, label: 'Ops log', detail: line.trim() })
      }
    }
    return events
  }, [q, overrides?.marketplaceVisibility, overrides?.adminNotesLog])

  const btnBase =
    'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition'

  return (
    <aside className="space-y-5 lg:sticky lg:top-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Job meta</h3>
        </div>
        <dl className="space-y-3 p-4 text-sm">
          <div className="flex justify-between gap-3 border-b border-slate-50 pb-3">
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-mono text-right font-bold text-slate-900">{String(q.quote_ref || q.id)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-50 pb-3">
            <dt className="text-slate-500">Move date</dt>
            <dd className="text-right font-semibold text-slate-900">{q.move_date ? formatDateUK(q.move_date) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-50 pb-3">
            <dt className="text-slate-500">Payment</dt>
            <dd className="text-right font-semibold capitalize text-slate-900">
              {String(q.payment_status || '—').replace(/_/g, ' ')}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-50 pb-3">
            <dt className="text-slate-500">Marketplace</dt>
            <dd className="max-w-[11rem] text-right text-xs font-medium leading-snug text-slate-700">
              {formatMarketplaceStatusSummary(q)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Source</dt>
            <dd className="text-right text-xs font-medium text-slate-600">{String(q.source || '—')}</dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick actions</h3>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            disabled={terminal}
            onClick={onOpenReassignDriver}
            className={`${btnBase} border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Assign / reassign driver
          </button>
          <button
            type="button"
            disabled={terminal}
            onClick={onOpenReassignPartner}
            className={`${btnBase} border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Assign / reassign partner
          </button>
          <button
            type="button"
            disabled
            title="Duplicate job is not available yet."
            className={`${btnBase} border-slate-200 bg-white text-slate-800 disabled:cursor-not-allowed disabled:opacity-45`}
          >
            Duplicate job
          </button>
          <button
            type="button"
            disabled={terminal}
            onClick={onMarkComplete}
            className={`${btnBase} border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/90 disabled:opacity-40`}
          >
            Mark completed
          </button>
          <button
            type="button"
            disabled={terminal}
            onClick={onCancelJob}
            className={`${btnBase} border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100/80 disabled:opacity-40`}
          >
            Cancel job
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Job history</h3>
        </div>
        <div className="p-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No timeline entries yet.</p>
          ) : (
            <ul className="space-y-0">
              {timeline.map((e, i) => (
                <TimelineItem key={`${e.label}-${i}`} e={e} isLast={i === timeline.length - 1} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  )
}
