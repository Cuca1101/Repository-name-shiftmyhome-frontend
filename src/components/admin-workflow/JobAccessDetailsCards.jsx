import { ACCESS_NOT_PROVIDED } from '../../lib/adminJobQuoteDetailsViewModel'

const ROWS = [
  ['propertyType', 'Property type'],
  ['floor', 'Floor'],
  ['lift', 'Lift'],
  ['parking', 'Parking'],
  ['carryDistance', 'Carry distance'],
  ['stairs', 'Stairs'],
  ['accessNotes', 'Access notes'],
  ['specialInstructions', 'Special instructions'],
]

/**
 * @param {{ label: string, value: string }} props
 */
function AccessRow({ label, value }) {
  const missing = value === ACCESS_NOT_PROVIDED
  return (
    <>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={missing ? 'text-sm text-slate-400' : 'whitespace-pre-wrap text-sm font-medium text-slate-900'}>
        {value}
      </dd>
    </>
  )
}

/**
 * @param {{
 *   title: string,
 *   tone: 'pickup' | 'delivery',
 *   address?: string,
 *   side: Record<string, string>,
 * }} props
 */
function AccessCard({ title, tone, address, side }) {
  const pickup = tone === 'pickup'
  return (
    <article
      data-access-side={tone}
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${
        pickup ? 'border-violet-200/80 bg-violet-50/40' : 'border-emerald-200/80 bg-emerald-50/40'
      }`}
    >
      <h4 className={`text-sm font-bold ${pickup ? 'text-violet-900' : 'text-emerald-900'}`}>{title}</h4>
      {address ? <p className="mt-1 text-sm leading-snug text-slate-700">{address}</p> : null}
      <dl className="mt-3 grid grid-cols-[7.75rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2">
        {ROWS.map(([key, label]) => (
          <AccessRow key={key} label={label} value={side[key] || ACCESS_NOT_PROVIDED} />
        ))}
      </dl>
    </article>
  )
}

/**
 * Pickup and delivery access, side by side from the lg breakpoint.
 * @param {{
 *   access: {
 *     allMissing?: boolean,
 *     pickup: Record<string, string>,
 *     delivery: Record<string, string>,
 *   },
 *   pickupAddress?: string,
 *   deliveryAddress?: string,
 * }} props
 */
export default function JobAccessDetailsCards({ access, pickupAddress = '', deliveryAddress = '' }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Access details</h3>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">Pickup and delivery</p>
      </div>
      {access?.allMissing ? (
        <p className="px-5 py-4 text-sm text-slate-600 sm:px-6">Access details were not saved for this booking.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <AccessCard title="Pickup" tone="pickup" address={pickupAddress} side={access.pickup} />
          <AccessCard title="Delivery" tone="delivery" address={deliveryAddress} side={access.delivery} />
        </div>
      )}
    </section>
  )
}
