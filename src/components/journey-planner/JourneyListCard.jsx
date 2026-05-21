import { Link } from 'react-router-dom'
import { formatJourneyDurationHhMm } from '../../lib/journeyPlannerModel'
import { formatJourneyMoney, journeyFinanceFromRow, journeyAssignedDriverLabel } from '../../lib/journeyPlannerDisplay'
import JourneyDispatchStatusBadge from './JourneyDispatchStatusBadge'

/**
 * @param {{
 *   journey: Record<string, unknown>,
 *   driverLabel?: string,
 *   busy?: boolean,
 *   onWithdraw?: () => void,
 *   onDeleteDraft?: () => void,
 * }} props
 */
export default function JourneyListCard({ journey, driverLabel = '', busy = false, onWithdraw, onDeleteDraft }) {
  const id = String(journey.id || '')
  const ref = journey.journey_ref != null ? String(journey.journey_ref) : id.slice(0, 8)
  const title =
    (journey.summary_title != null && String(journey.summary_title).trim()) ||
    (journey.title != null && String(journey.title).trim()) ||
    'Journey'
  const jobs =
    journey.jobs_count != null && Number.isFinite(Number(journey.jobs_count)) ? Number(journey.jobs_count) : 0
  const stopsCount = jobs > 0 ? jobs * 2 : '—'
  const miles =
    journey.total_miles != null && Number.isFinite(Number(journey.total_miles))
      ? `${Number(journey.total_miles).toFixed(1)} mi`
      : '—'
  const durSec =
    journey.total_duration_seconds != null && Number.isFinite(Number(journey.total_duration_seconds))
      ? Math.round(Number(journey.total_duration_seconds))
      : null
  const durLabel = durSec != null && durSec > 0 ? formatJourneyDurationHhMm(durSec) : '—'
  const created =
    journey.created_at != null
      ? new Date(String(journey.created_at)).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—'

  const { customerTotal, payout, platformProfit, marginPct } = journeyFinanceFromRow(journey)
  const driverDisplay = driverLabel || journeyAssignedDriverLabel(journey, [])
  const listed = String(journey.marketplace_visibility || '') === 'visible_in_marketplace'
  const editHref = `/admin/journey-planner?journey=${encodeURIComponent(id)}`
  const viewHref = `/admin/journey-planner/view/${encodeURIComponent(id)}`

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight text-slate-900">{ref}</span>
            <JourneyDispatchStatusBadge journey={journey} quotes={driverDisplay ? [{ assigned_driver_name: driverDisplay }] : []} />
            <span className="text-xs text-slate-500">Created {created}</span>
          </div>
          <h3 className="text-base font-semibold leading-snug text-slate-900">{title}</h3>
          {driverDisplay ? (
            <p className="text-xs font-semibold text-emerald-800">
              <span className="font-medium text-slate-500">Driver:</span> {driverDisplay}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Jobs / stops</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {jobs} jobs · {stopsCount} stops
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Distance</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{miles}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Duration</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{durLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Customer total</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatJourneyMoney(customerTotal)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Partner payout</dt>
              <dd className="mt-0.5 font-medium text-emerald-800">{formatJourneyMoney(payout)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Platform profit</dt>
              <dd className="mt-0.5 font-medium text-violet-900">{formatJourneyMoney(platformProfit)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Margin</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:max-w-[11rem] lg:flex-col">
          <Link
            to={viewHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-brand-500"
          >
            Open journey
          </Link>
          <Link
            to={editHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Edit journey
          </Link>
          {!listed ? (
            <Link
              to={editHref}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Publish
            </Link>
          ) : null}
          {listed && onWithdraw ? (
            <button
              type="button"
              disabled={busy}
              onClick={onWithdraw}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-50 disabled:opacity-50"
            >
              {busy ? '…' : 'Withdraw'}
            </button>
          ) : null}
          {!listed && onDeleteDraft ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDeleteDraft}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {busy ? '…' : 'Delete draft'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
