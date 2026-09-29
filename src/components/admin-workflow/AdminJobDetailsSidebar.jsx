import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatMarketplaceStatusSummary } from '../../lib/marketplaceListingStatus'
import { buildJobOperationsTimeline, formatTimelineEventTime } from '../../lib/buildJobOpsTimeline'

/**
 * @param {{ t?: string | null, label: string, detail?: string, isLast: boolean }} props
 */
function TimelineItem({ t, label, detail, isLast }) {
  return (
    <li className="relative flex gap-2.5">
      <div className="flex flex-col items-center pt-0.5">
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-white bg-brand-500 shadow-[0_0_0_2px_rgba(14,165,233,0.2)]" />
        {!isLast ? (
          <span className="mt-0.5 min-h-[1.5rem] w-px grow bg-slate-200" aria-hidden />
        ) : null}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-3'}`}>
        <p className="text-xs font-semibold leading-snug text-slate-900">{label}</p>
        {t ? (
          <p className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-500">{formatTimelineEventTime({ t, label, detail: detail || '', sortMs: 0 })}</p>
        ) : null}
        {detail ? (
          <p className="mt-1 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-relaxed text-slate-600">{detail}</p>
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
  const timeline = buildJobOperationsTimeline(q, overrides).slice(-6)

  const btnPrimary =
    'flex min-h-[40px] w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40'
  const btnSecondary =
    'flex min-h-[36px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
  const btnSuccess =
    'flex min-h-[36px] w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/90 disabled:cursor-not-allowed disabled:opacity-40'
  const btnDanger =
    'flex min-h-[36px] w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40'

  const pack =
    q?.service_package_snapshot && typeof q.service_package_snapshot === 'object'
      ? q.service_package_snapshot
      : q?.wizard_data?.step3?.servicePackage && typeof q.wizard_data.step3.servicePackage === 'object'
        ? q.wizard_data.step3.servicePackage
        : null

  return (
    <aside className="space-y-4 lg:sticky lg:top-4">
      {pack ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Service package</h3>
          </div>
          <div className="space-y-1.5 p-3 text-xs text-slate-700">
            <p className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {pack.display_name || pack.service_package || 'Standard'}
            </p>
            <p>Forgotten items: {pack.forgotten_item_allowance ?? 0} / {pack.forgotten_volume_m3 ?? 0} m³</p>
            <p>Used: {pack.used_forgotten_items ?? 0} items · {pack.used_forgotten_volume_m3 ?? 0} m³</p>
            <p>Waiting included: {pack.included_waiting_minutes ?? 0} min</p>
            <p>Wrapping: {pack.included_wrapping_items ?? 0} · Dismantle/reassembly: {pack.included_dismantle_items ?? 0}</p>
            <p className="text-[11px] text-slate-500">
              Items beyond this allowance need an extra charge or admin approval before loading.
            </p>
          </div>
        </section>
      ) : null}
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-900/5 bg-slate-900/[0.03] px-3.5 py-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dispatch controls</h3>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <button type="button" disabled={terminal} onClick={onOpenReassignDriver} className={btnPrimary}>
            Assign / reassign driver
          </button>
          <button type="button" disabled={terminal} onClick={onOpenReassignPartner} className={btnSecondary}>
            Assign / reassign partner
          </button>
          <button type="button" disabled={terminal} onClick={onMarkComplete} className={btnSuccess}>
            Mark completed
          </button>
          <button type="button" disabled={terminal} onClick={onCancelJob} className={btnDanger}>
            Cancel job
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3.5 py-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Job meta</h3>
        </div>
        <dl className="divide-y divide-slate-100 px-3.5 py-1 text-xs">
          <div className="flex justify-between gap-2 py-2.5">
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-mono text-right font-bold text-slate-900">{String(q.quote_ref || q.id)}</dd>
          </div>
          <div className="flex justify-between gap-2 py-2.5">
            <dt className="text-slate-500">Move date</dt>
            <dd className="text-right font-semibold text-slate-900">{q.move_date ? formatDateUK(q.move_date) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-2 py-2.5">
            <dt className="text-slate-500">Payment</dt>
            <dd className="text-right font-semibold capitalize text-slate-900">
              {String(q.payment_status || '—').replace(/_/g, ' ')}
            </dd>
          </div>
          <div className="flex justify-between gap-2 py-2.5">
            <dt className="text-slate-500">Marketplace</dt>
            <dd className="max-w-[10rem] text-right font-medium leading-snug text-slate-700">
              {formatMarketplaceStatusSummary(q)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3.5 py-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent activity</h3>
        </div>
        <div className="p-3">
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-500">No activity yet.</p>
          ) : (
            <ul>
              {timeline.map((e, i) => (
                <TimelineItem
                  key={`${e.label}-${i}`}
                  t={e.t}
                  label={e.label}
                  detail={e.detail}
                  isLast={i === timeline.length - 1}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  )
}
