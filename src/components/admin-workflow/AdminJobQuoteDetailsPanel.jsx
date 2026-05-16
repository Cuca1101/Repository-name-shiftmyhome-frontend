import { useMemo } from 'react'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { buildAdminJobQuoteDetailsViewModel, liftReadable } from '../../lib/adminJobQuoteDetailsViewModel'
import AvailableJobInventorySection from './AvailableJobInventorySection'
import { AdminField } from './AdminJobUiPrimitives'

function PinIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z" />
    </svg>
  )
}

function UserIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  )
}

function RouteIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h10M4 12h16M4 18h10" />
      <circle cx="7" cy="6" r="2" />
      <circle cx="17" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </svg>
  )
}

/**
 * @param {{ value: string }} props
 */
function AccessBadge({ value }) {
  const v = liftReadable(value)
  const yes = v === 'Yes'
  const no = v === 'No'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        yes
          ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
          : no
            ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
            : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/70'
      }`}
    >
      {v}
    </span>
  )
}

const cardShell = 'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

/**
 * @param {{ quote: Record<string, unknown> }} props
 */
export default function AdminJobQuoteDetailsPanel({ quote: q }) {
  const vm = useMemo(() => buildAdminJobQuoteDetailsViewModel(q), [q])

  return (
    <div className="space-y-6">
      <section className={cardShell}>
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</h3>
            <p className="text-sm font-semibold text-slate-800">Contact & identifiers</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <AdminField label="Name" value={q.full_name} />
            <AdminField label="Email" value={q.email} mono />
            <AdminField label="Phone" value={q.phone} />
          </div>
        </div>
      </section>

      <section className={cardShell}>
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <RouteIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Route</h3>
            <p className="text-sm font-semibold text-slate-800">Pickup & delivery</p>
          </div>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex gap-4 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 via-white to-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md">
                <PinIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800">Pickup</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">{q.pickup_address || '—'}</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                <PinIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Dropoff</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">{q.delivery_address || '—'}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Distance</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
                {vm.distanceDisplay}
              </span>
            </div>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[12rem]">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Time window</span>
              <span className="font-medium leading-snug text-slate-800">{vm.arrivalLine}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardShell}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Move details</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">Service & schedule</p>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <AdminField label="Service type" value={vm.serviceLabel} />
            <AdminField label="Move date" value={q.move_date ? formatDateUK(q.move_date) : '—'} />
            <AdminField label="Date / time window" value={vm.arrivalLine} />
            <AdminField label="Crew size" value={vm.crewDisplay} />
            <AdminField label="Volume" value={vm.volumeLine} />
          </div>
        </section>

        <section className={cardShell}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Access details</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">Property, lifts & carry</p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Property</span>
                  <span className="text-right text-sm font-semibold text-slate-900">{vm.pickupType}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Floor</span>
                  <span className="text-sm font-semibold text-slate-900">{vm.pickupFloor}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Lift</span>
                  <AccessBadge value={vm.pickupLiftRaw} />
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Delivery</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Property</span>
                  <span className="text-right text-sm font-semibold text-slate-900">{vm.deliveryType}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Floor</span>
                  <span className="text-sm font-semibold text-slate-900">{vm.deliveryFloor}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Lift</span>
                  <AccessBadge value={vm.deliveryLiftRaw} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">Parking</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{vm.parking}</p>
              </div>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-900">
                Access
              </span>
            </div>
            <AdminField label="Walking distance" value={vm.walking} />
            <AdminField label="Stairs" value={vm.stairs} />
            <AdminField label="Stairs & access notes" value={vm.stairsNotes} />
            <AdminField label="Special instructions" value={vm.specialInstructions} />
          </div>
        </section>
      </div>

      <AvailableJobInventorySection quote={q} />
    </div>
  )
}
