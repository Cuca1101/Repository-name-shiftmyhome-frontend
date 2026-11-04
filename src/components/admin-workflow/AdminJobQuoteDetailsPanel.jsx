import { useMemo } from 'react'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { ACCESS_NOT_PROVIDED, buildAdminJobQuoteDetailsViewModel } from '../../lib/adminJobQuoteDetailsViewModel'
import AvailableJobInventorySection from './AvailableJobInventorySection'
import QuotePhotosAdminSection from './QuotePhotosAdminSection'

const ACCESS_ROWS = [
  ['propertyType', 'Property'],
  ['floor', 'Floor'],
  ['lift', 'Lift'],
  ['parking', 'Parking'],
  ['carryDistance', 'Carry'],
  ['stairs', 'Stairs'],
  ['accessNotes', 'Notes'],
  ['specialInstructions', 'Instructions'],
]

function shown(value) {
  const text = String(value ?? '').trim()
  return text && text !== '—' && text !== ACCESS_NOT_PROVIDED ? text : ''
}

/**
 * @param {{ label: string, value: unknown }} props
 */
function Fact({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{value || '—'}</p>
    </div>
  )
}

/**
 * @param {{
 *   title: string,
 *   tone: 'pickup' | 'delivery',
 *   address: string,
 *   contact: string,
 *   phone: string,
 *   flat: string,
 *   access: Record<string, string>,
 * }} props
 */
function StopCard({ title, tone, address, contact, phone, flat, access }) {
  const pickup = tone === 'pickup'
  const rows = ACCESS_ROWS.map(([key, label]) => ({ label, value: shown(access?.[key]) })).filter((row) => row.value)
  return (
    <article className="min-w-0 p-3 sm:p-4">
      <p className={`text-[10px] font-bold uppercase tracking-wide ${pickup ? 'text-orange-700' : 'text-emerald-700'}`}>
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{address || '—'}</p>
      {contact || phone ? (
        <p className="mt-1 text-xs text-slate-600">
          {[contact, phone].filter((part) => shown(part)).join(' · ') || '—'}
        </p>
      ) : null}
      {shown(flat) ? <p className="mt-1 text-xs text-slate-600">{flat}</p> : null}
      {rows.length ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</dt>
              <dd className="text-xs font-medium leading-snug text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Access details were not saved.</p>
      )}
    </article>
  )
}

/**
 * @param {{
 *   quote: Record<string, unknown>,
 *   jobId?: string|null,
 *   photoQuoteRef?: string|null,
 *   linkedJob?: Record<string, unknown> | null,
 *   legacyPhotoFileNames?: string[],
 * }} props
 */
export default function AdminJobQuoteDetailsPanel({
  quote: q,
  jobId = null,
  photoQuoteRef = null,
  linkedJob = null,
  legacyPhotoFileNames = [],
}) {
  const vm = useMemo(() => buildAdminJobQuoteDetailsViewModel(q), [q])
  const photoRef =
    photoQuoteRef != null && String(photoQuoteRef).trim()
      ? String(photoQuoteRef).trim()
      : q.quote_ref != null
        ? String(q.quote_ref).trim()
        : ''

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Job details</p>
          <p className="truncate text-sm font-semibold text-slate-900">{vm.serviceLabel || 'Booking'}</p>
        </div>
        <p className="min-w-0 text-xs leading-snug text-slate-600">
          {[q.full_name, q.phone, q.email].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-3 sm:px-4">
        <Fact label="Move date" value={q.move_date ? formatDateUK(q.move_date) : '—'} />
        <Fact label="Time window" value={vm.arrivalLine} />
        <Fact label="Crew" value={vm.crewDisplay} />
        <Fact label="Volume" value={vm.volumeLine} />
        <Fact label="Distance" value={vm.distanceDisplay} />
        <Fact label="Service" value={vm.serviceLabel} />
      </div>

      <div className="grid divide-y border-t border-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        <StopCard
          title="Collection"
          tone="pickup"
          address={String(q.pickup_address || '')}
          contact={vm.pickupContact}
          phone={vm.pickupContactPhone}
          flat={vm.pickupFlatDetails}
          access={vm.access?.pickup || {}}
        />
        <StopCard
          title="Delivery"
          tone="delivery"
          address={String(q.delivery_address || '')}
          contact={vm.deliveryContact}
          phone={vm.deliveryContactPhone}
          flat={vm.deliveryFlatDetails}
          access={vm.access?.delivery || {}}
        />
      </div>

      <div className="border-t border-slate-100">
        <AvailableJobInventorySection quote={q} compact />
      </div>
      <div className="border-t border-slate-100 p-3 sm:p-4">
        <QuotePhotosAdminSection
          quoteRef={photoRef}
          jobId={jobId}
          quoteRow={q}
          linkedJob={linkedJob}
          legacyPhotoFileNames={legacyPhotoFileNames}
        />
      </div>
    </section>
  )
}
