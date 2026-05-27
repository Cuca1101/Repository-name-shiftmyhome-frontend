import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  locationChipFromAddress,
  quoteAccessSummary,
  quoteIsJobCancelled,
  quoteIsJobCompleted,
} from '../../lib/journeyPlannerDisplay'
import { jobAcceptedStatusBadge } from '../../lib/adminJobAcceptedStatus'
import { resolveJobAcceptedPaymentBreakdown } from '../../lib/jobAcceptedPaymentDisplay'
import { quotePassesActiveStrict } from '../../lib/adminJobListRules'
import JobStatusBadge from '../admin-workflow/JobStatusBadge'
import {
  buildJourneyStopExpandedDetails,
  buildJourneyStopInventoryView,
  buildJourneyStopWarningChips,
} from '../../lib/journeyStopInventoryDisplay'
import { liftReadable } from '../../lib/adminJobQuoteDetailsViewModel'

const btn =
  'rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40'

/**
 * @param {{
 *   stop: import('../../lib/journeyPlannerModel.js').JourneyStop,
 *   index: number,
 *   quote?: Record<string, unknown> | null,
 *   open: boolean,
 *   onToggle: () => void,
 *   mode?: 'timeline' | 'editor',
 *   isCurrent?: boolean,
 *   completed?: boolean,
 *   onRemoveJob?: (quoteId: string, meta: { jobRef: string, customerName: string }) => void,
 *   editorActions?: {
 *     onMoveUp?: () => void,
 *     onMoveDown?: () => void,
 *     onMoveTop?: () => void,
 *     onMoveBottom?: () => void,
 *     canMoveUp?: boolean,
 *     canMoveDown?: boolean,
 *     removingJob?: boolean,
 *   },
 *   dragHandle?: import('react').ReactNode,
 * }} props
 */
export default function JourneyStopCard({
  stop,
  index,
  quote = null,
  open,
  onToggle,
  mode = 'timeline',
  isCurrent = false,
  completed = false,
  onRemoveJob,
  editorActions,
  dragHandle,
}) {
  const isPickup = stop.kind === 'pickup'
  const loc = locationChipFromAddress(stop.address)
  const inventory = useMemo(() => buildJourneyStopInventoryView(quote), [quote])
  const warningChips = useMemo(
    () => buildJourneyStopWarningChips(quote, stop.kind),
    [quote, stop.kind],
  )
  const expanded = useMemo(
    () => buildJourneyStopExpandedDetails(quote, stop.kind),
    [quote, stop.kind],
  )

  const acceptedOrActive = quote ? quotePassesActiveStrict(quote) : false
  const jobHref = stop.quoteId
    ? acceptedOrActive
      ? `/admin/active-jobs/${encodeURIComponent(stop.quoteId)}`
      : `/admin/available-jobs/${encodeURIComponent(stop.quoteId)}`
    : null
  const canRemoveJob = isPickup && stop.quoteId && typeof onRemoveJob === 'function'
  const serviceMin =
    stop.serviceMinutes != null && Number(stop.serviceMinutes) > 0
      ? `${stop.serviceMinutes} min`
      : null
  const driverName = quote ? String(quote.assigned_driver_name || '').trim() : ''
  const vehicle = quote ? String(quote.assigned_vehicle_registration || quote.vehicle_registration || '').trim() : ''
  const access = quoteAccessSummary(quote)
  const cancelled = quoteIsJobCancelled(quote)
  const done = completed ?? quoteIsJobCompleted(quote)
  const dispatchBadge = quote && !done && !cancelled ? jobAcceptedStatusBadge(quote) : null
  const payoutBreakdown = quote && acceptedOrActive ? resolveJobAcceptedPaymentBreakdown(quote) : null
  const driverPayoutLabel =
    payoutBreakdown?.driverPayout != null && Number.isFinite(Number(payoutBreakdown.driverPayout))
      ? `£${Number(payoutBreakdown.driverPayout).toFixed(2)}`
      : null

  let accent = isPickup
    ? 'border-emerald-200/90 bg-emerald-50/40'
    : 'border-sky-200/90 bg-sky-50/35'
  if (done) {
    accent = 'border-emerald-100 bg-emerald-50/20 opacity-95'
  } else if (isCurrent) {
    accent = isPickup
      ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-brand-300/70'
      : 'border-sky-300 bg-sky-50/60 ring-1 ring-brand-300/70'
  }

  const typeBadge = cancelled
    ? 'bg-rose-600 text-white'
    : done
      ? 'bg-blue-600 text-white'
      : isPickup
        ? 'bg-emerald-600 text-white'
        : 'bg-sky-600 text-white'

  const vm = expanded.vm
  const floor =
    stop.kind === 'pickup' ? vm?.pickupFloor : vm?.deliveryFloor
  const liftRaw = stop.kind === 'pickup' ? vm?.pickupLiftRaw : vm?.deliveryLiftRaw
  const propertyType = stop.kind === 'pickup' ? vm?.pickupType : vm?.deliveryType

  return (
    <div className={`rounded-xl border shadow-sm transition-shadow ${accent}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-white/40 sm:gap-2.5 sm:px-2.5 sm:py-2"
        aria-expanded={open}
      >
        {mode === 'editor' ? (
          <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {index + 1}
            </span>
            {dragHandle}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            {mode === 'timeline' ? (
              <span className="text-[10px] font-bold tabular-nums text-slate-500">#{index + 1}</span>
            ) : null}
            <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${typeBadge}`}>
              {isPickup ? 'Pickup' : 'Delivery'}
            </span>
            {isCurrent ? (
              <span className="rounded bg-brand-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                Current
              </span>
            ) : null}
            {cancelled ? (
              <span className="rounded bg-rose-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                Cancelled
              </span>
            ) : done ? (
              <span className="rounded bg-blue-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                Completed
              </span>
            ) : dispatchBadge ? (
              <JobStatusBadge label={dispatchBadge.label} tone={dispatchBadge.tone} />
            ) : null}
            {stop.jobRef ? (
              <span className="font-mono text-[10px] font-semibold text-slate-600">{stop.jobRef}</span>
            ) : null}
            {stop.timeWindow && stop.timeWindow !== '—' ? (
              <span className="text-[10px] font-medium text-slate-600">{stop.timeWindow}</span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-xs font-semibold text-slate-900 sm:text-[13px]">
            {stop.customerName && stop.customerName !== '—' ? stop.customerName : 'Customer'}
          </p>
          <p className="line-clamp-2 text-[11px] leading-snug text-slate-600" title={stop.address || ''}>
            {stop.address || loc.label || loc.city || loc.postcode || '—'}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
            {driverName ? (
              <span>
                <span className="font-semibold text-slate-700">Driver:</span> {driverName}
              </span>
            ) : null}
            {vehicle ? (
              <span>
                <span className="font-semibold text-slate-700">Van:</span> {vehicle}
              </span>
            ) : null}
            {driverPayoutLabel ? (
              <span className="font-semibold text-violet-900">Driver payout: {driverPayoutLabel}</span>
            ) : null}
            {stop.volumeCrew ? (
              <span className="font-medium text-slate-700">{stop.volumeCrew}</span>
            ) : vm?.volumeLine && vm.volumeLine !== '—' ? (
              <span>
                {vm.volumeLine}
                {vm.crewDisplay && vm.crewDisplay !== '—' ? ` · ${vm.crewDisplay} crew` : ''}
              </span>
            ) : null}
            {inventory.summaryLine ? (
              <span className="text-slate-600">{inventory.summaryLine}</span>
            ) : null}
          </div>

          {inventory.itemsLine ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{inventory.itemsLine}</p>
          ) : null}

          {warningChips.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {warningChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded border border-amber-200/90 bg-amber-50 px-1 py-px text-[9px] font-semibold text-amber-950"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <span className="shrink-0 pt-0.5 text-slate-400" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-200/70 px-2 pb-2 pt-1.5 sm:px-2.5">
          <dl className="grid gap-1.5 text-[11px] sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Address</dt>
              <dd className="mt-px text-slate-800">{stop.address || '—'}</dd>
            </div>
            {(expanded.phone || expanded.email || expanded.customerName) && (
              <div className="sm:col-span-2">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Customer</dt>
                <dd className="mt-px text-slate-800">
                  {expanded.customerName || stop.customerName || '—'}
                  {expanded.phone ? (
                    <span className="block text-slate-600">{expanded.phone}</span>
                  ) : null}
                  {expanded.email ? (
                    <span className="block truncate text-slate-600">{expanded.email}</span>
                  ) : null}
                </dd>
              </div>
            )}
            {propertyType && propertyType !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Property</dt>
                <dd className="mt-px text-slate-800">{propertyType}</dd>
              </div>
            ) : null}
            {floor && floor !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Floor</dt>
                <dd className="mt-px text-slate-800">{floor}</dd>
              </div>
            ) : null}
            {liftRaw && liftRaw !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Lift</dt>
                <dd className="mt-px text-slate-800">{liftReadable(liftRaw)}</dd>
              </div>
            ) : null}
            {vm?.parking && vm.parking !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Parking</dt>
                <dd className="mt-px text-slate-800">{vm.parking}</dd>
              </div>
            ) : null}
            {vm?.walking && vm.walking !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Walking</dt>
                <dd className="mt-px text-slate-800">{vm.walking}</dd>
              </div>
            ) : null}
            {access ? (
              <div className="sm:col-span-2">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Access</dt>
                <dd className="mt-px text-slate-800">{access}</dd>
              </div>
            ) : null}
            {vm?.stairs && vm.stairs !== '—' ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Stairs</dt>
                <dd className="mt-px text-slate-800">{vm.stairs}</dd>
              </div>
            ) : null}
            {serviceMin ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  {isPickup ? 'Loading' : 'Unloading'}
                </dt>
                <dd className="mt-px text-slate-800">{serviceMin}</dd>
              </div>
            ) : null}
            {stop.volumeCrew ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Volume / crew</dt>
                <dd className="mt-px text-slate-800">{stop.volumeCrew}</dd>
              </div>
            ) : null}
            {driverName ? (
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Driver</dt>
                <dd className="mt-px font-medium text-emerald-800">{driverName}</dd>
              </div>
            ) : null}
          </dl>

          {expanded.inventory.rows.length > 0 ? (
            <div className="mt-2 border-t border-slate-100 pt-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Inventory ({expanded.inventory.summary.qtyTotal || expanded.inventory.itemCount} items
                {expanded.inventory.volumeLabel !== '—'
                  ? ` · ${expanded.inventory.volumeLabel}`
                  : ''}
                )
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {expanded.inventory.rows.map((r, i) => (
                  <li
                    key={`${r.name}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0 text-[11px] text-slate-800"
                  >
                    <span className="min-w-0 font-medium">
                      {r.qty}x {r.name}
                      {r.sizeType && r.sizeType !== '—' ? (
                        <span className="ml-1 font-normal text-slate-500">({r.sizeType})</span>
                      ) : null}
                    </span>
                    {r.volume && r.volume !== '—' ? (
                      <span className="shrink-0 tabular-nums text-slate-500">{r.volume}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {expanded.extras.length > 0 ? (
            <div className="mt-2 space-y-1 border-t border-slate-100 pt-1.5">
              {expanded.extras.map((ex) => (
                <div key={ex.label}>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{ex.label}</p>
                  <p className="text-[11px] text-slate-800">{ex.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {stop.notes ? (
            <div className="mt-2 border-t border-slate-100 pt-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-px whitespace-pre-wrap text-[11px] text-slate-800">{stop.notes}</p>
            </div>
          ) : null}
          {vm?.specialInstructions && vm.specialInstructions !== '—' ? (
            <div className="mt-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Instructions</p>
              <p className="mt-px whitespace-pre-wrap text-[11px] text-slate-800">{vm.specialInstructions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-t border-slate-200/60 bg-white/50 px-2 py-1 sm:px-2.5">
        {jobHref ? (
          <Link to={jobHref} className={`${btn} text-brand-800 border-brand-200 bg-brand-50/80`}>
            View job
          </Link>
        ) : null}
        {canRemoveJob ? (
          <button
            type="button"
            disabled={editorActions?.removingJob}
            onClick={() =>
              onRemoveJob(String(stop.quoteId), {
                jobRef: stop.jobRef || '',
                customerName: stop.customerName || '',
              })
            }
            className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
        {mode === 'editor' && editorActions ? (
          <>
            <button
              type="button"
              disabled={!editorActions.canMoveUp}
              onClick={editorActions.onMoveTop}
              className={btn}
            >
              Top
            </button>
            <button
              type="button"
              disabled={!editorActions.canMoveDown}
              onClick={editorActions.onMoveBottom}
              className={btn}
            >
              Bottom
            </button>
            <button
              type="button"
              disabled={!editorActions.canMoveUp}
              onClick={editorActions.onMoveUp}
              className={btn}
            >
              Up
            </button>
            <button
              type="button"
              disabled={!editorActions.canMoveDown}
              onClick={editorActions.onMoveDown}
              className={btn}
            >
              Down
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
