import { Link } from 'react-router-dom'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatMoveArrivalSummary, formatVolumeAndCrew } from '../../lib/quoteJobAdminModel'
import { dispatchWorkflowBadge } from '../../lib/jobDispatchTimeline'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'
import { liftReadable } from '../../lib/adminJobQuoteDetailsViewModel'
import TruncatedAddressText from './TruncatedAddressText'
import JobDispatchRouteMap from './JobDispatchRouteMap'
import JobDispatchOpsTimeline from './JobDispatchOpsTimeline'
import JobLocationHistoryPanel from './JobLocationHistoryPanel'
import JobDriverAssignmentPanel from './JobDriverAssignmentPanel'
import JobAdjustmentsPanel from './JobAdjustmentsPanel'
import GenerateJobSheetButton from './GenerateJobSheetButton'
import JobStatusBadge from './JobStatusBadge'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   vm: Record<string, unknown> | null,
 *   fin: { customerTotal: number|null, paid: number, remaining: number|null } | null,
 *   overrides: Record<string, unknown>,
 *   linkedJob?: Record<string, unknown> | null,
 *   assignment?: { status?: string, updated_at?: string } | null,
 *   workflow?: { workflow_status?: string, workflow_at?: string } | null,
 *   statusHistory?: Array<{ status: string, created_at: string }>,
 *   adjustments: import('../../lib/jobAdjustments.js').JobAdjustmentRow[],
 *   onAdjustmentsChange: (next: import('../../lib/jobAdjustments.js').JobAdjustmentRow[]) => void,
 *   adjSum: number,
 *   terminal: boolean,
 *   backHref: string,
 *   backLabel: string,
 *   notesDraft?: string,
 *   onMarkComplete: () => void,
 *   onMarkCompleteWithIssues: () => void,
 *   onCancelJob: () => void,
 *   onReload?: () => void | Promise<void>,
 *   onNotify?: (msg: string) => void,
 * }} props
 */
export default function JobDispatchControlPanel({
  q,
  vm,
  fin,
  overrides,
  linkedJob = null,
  assignment = null,
  workflow = null,
  statusHistory = [],
  adjustments,
  onAdjustmentsChange,
  adjSum,
  terminal,
  backHref,
  backLabel,
  notesDraft = '',
  onMarkComplete,
  onMarkCompleteWithIssues,
  onCancelJob,
  onReload,
  onNotify,
}) {
  const badge = dispatchWorkflowBadge(q, linkedJob)
  const ref = String(q.quote_ref || q.id || '—')
  const service = String(q.service || q.service_type || vm?.serviceLabel || '—')
  const volCrew = formatVolumeAndCrew(q)
  const moveDate = q.move_date ? formatDateUK(q.move_date) : '—'
  const arrival = formatMoveArrivalSummary(q, vm?.kvFlat || {})
  const collection = resolveQuoteCollectionAddress(q, linkedJob)
  const delivery = resolveQuoteDeliveryAddress(q, linkedJob)

  const btn =
    'inline-flex min-h-[32px] items-center justify-center rounded-md px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'
  const btnPrimary = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`
  const btnSecondary = `${btn} border border-slate-600 bg-slate-800 text-white hover:bg-slate-700`
  const btnGhost = `${btn} border border-slate-500/60 text-slate-100 hover:bg-slate-800`
  const btnDanger = `${btn} border border-red-400/50 text-red-100 hover:bg-red-950/40`

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Top control bar */}
      <div className="border-b border-slate-700 bg-slate-900 px-3 py-2 text-white sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link to={backHref} className="text-[11px] font-medium text-slate-300 hover:text-white hover:underline">
            ← {backLabel}
          </Link>
          <span className="hidden text-slate-600 sm:inline" aria-hidden>
            |
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{service}</p>
            <p className="font-mono text-[10px] text-slate-400">{ref}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
            <span className="rounded bg-slate-800 px-2 py-0.5">{volCrew}</span>
            <span className="rounded bg-slate-800 px-2 py-0.5">{moveDate}</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 tabular-nums">
              Paid {money(fin?.paid)} · Bal {fin?.remaining != null ? money(fin.remaining) : '—'}
            </span>
          </div>
          <JobStatusBadge label={badge.label} tone={badge.tone} />
          <div className="flex w-full flex-wrap gap-1.5 sm:ml-auto sm:w-auto">
            <button type="button" disabled={terminal} onClick={onMarkComplete} className={btnPrimary}>
              Complete
            </button>
            <button type="button" disabled={terminal} onClick={onMarkCompleteWithIssues} className={btnSecondary}>
              Complete with issues
            </button>
            <button type="button" disabled={terminal} onClick={onCancelJob} className={btnDanger}>
              Cancel job
            </button>
            <GenerateJobSheetButton
              quote={q}
              internalNotes={notesDraft}
              variant="secondary"
              className={`${btnGhost} !min-h-[32px] !rounded-md !px-2.5 !py-1 !text-[11px]`}
              onSuccess={(msg) => onNotify?.(msg)}
              onError={(msg) => onNotify?.(msg)}
            />
          </div>
        </div>
      </div>

      {/* Assignment row */}
      <JobDriverAssignmentPanel
        quote={q}
        linkedJob={linkedJob}
        onApplied={onReload}
        layout="dispatch"
        disabled={terminal}
      />

      {/* Map + timeline grid */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_11rem] xl:grid-cols-[minmax(0,1fr)_12.5rem]">
        <div className="min-w-0">
          <JobDispatchRouteMap q={q} job={linkedJob} />

          <div className="grid divide-y border-t border-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
            <DispatchStopBlock
              kind="pickup"
              address={collection}
              floor={vm?.pickupFloor}
              lift={vm?.pickupLiftRaw}
              propertyType={vm?.pickupType}
              customerName={q.full_name}
              phone={q.phone}
              scheduled={moveDate !== '—' ? `${moveDate}${arrival && arrival !== '—' ? ` · ${arrival}` : ''}` : arrival}
            />
            <DispatchStopBlock
              kind="delivery"
              address={delivery}
              floor={vm?.deliveryFloor}
              lift={vm?.deliveryLiftRaw}
              propertyType={vm?.deliveryType}
              customerName={q.full_name}
              phone={q.phone}
              scheduled={moveDate !== '—' ? `${moveDate}${arrival && arrival !== '—' ? ` · ${arrival}` : ''}` : arrival}
            />
          </div>
        </div>

        <JobDispatchOpsTimeline
          q={q}
          overrides={overrides}
          linkedJob={linkedJob}
          assignment={assignment}
          workflow={workflow}
          statusHistory={statusHistory}
        />
      </div>

      <JobLocationHistoryPanel
        quote={q}
        linkedJob={linkedJob}
        mapboxToken={String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()}
      />

      {/* Adjustments — visually separate */}
      <div className="border-t border-amber-200/60 bg-amber-50/30 p-3 sm:p-4" data-job-adjustments>
        <JobAdjustmentsPanel
          adjustments={adjustments}
          onAdjustmentsChange={onAdjustmentsChange}
          fin={fin}
          disabled={terminal}
          onNotify={onNotify}
          embedded
        />
      </div>
    </div>
  )
}

/**
 * @param {{
 *   kind: 'pickup' | 'delivery',
 *   address: string,
 *   floor?: string,
 *   lift?: string,
 *   propertyType?: string,
 *   customerName?: unknown,
 *   phone?: unknown,
 *   scheduled?: string,
 * }} props
 */
function DispatchStopBlock({ kind, address, floor, lift, propertyType, customerName, phone, scheduled }) {
  const isPickup = kind === 'pickup'
  const title = isPickup ? 'Pickup' : 'Delivery'
  const accent = isPickup ? 'text-emerald-800' : 'text-sky-800'
  const access = [propertyType, floor ? `Floor ${floor}` : '', liftReadable(lift)]
    .filter((x) => x && x !== '—')
    .join(' · ')

  return (
    <div className="p-2.5 sm:p-3">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>{title}</p>
      <div className="mt-1">
        <TruncatedAddressText address={address} maxLen={120} className="text-xs font-medium" />
      </div>
      {access ? <p className="mt-0.5 text-[10px] text-slate-600">{access}</p> : null}
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <dt className="font-semibold text-slate-500">Customer</dt>
          <dd className="truncate text-slate-900">{String(customerName || '—')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Phone</dt>
          <dd className="truncate text-slate-900">
            {phone ? (
              <a href={`tel:${String(phone).replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
                {String(phone)}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">Scheduled</dt>
          <dd className="text-slate-800">{scheduled && scheduled !== '—' ? scheduled : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
