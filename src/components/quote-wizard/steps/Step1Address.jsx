import { useEffect } from 'react'
import MapboxAddressField from '../MapboxAddressField'
import FloorSelect from '../FloorSelect'
import { getLocalDateYYYYMMDD } from '../../../lib/moveDateLocal'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']

const ARRIVAL_OPTIONS = [
  { value: 'flex', label: 'Flexible on time' },
  { value: 'morning', label: 'Morning (08:00–12:00)' },
  { value: 'midday', label: 'Midday (12:00–16:00)' },
  { value: 'evening', label: 'Evening (16:00–20:00)' },
  { value: 'exact', label: 'Exact arrival time (premium)' },
]

/** Whole hours 08:00 … 18:00 */
const EXACT_HOUR_OPTIONS = Array.from({ length: 11 }, (_, i) => {
  const h = i + 8
  const hh = String(h).padStart(2, '0')
  return { value: `${hh}:00`, label: `${hh}:00` }
})

const HAS_MAPBOX = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

const input =
  'min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const label = 'mb-1.5 block text-sm font-medium text-slate-700'
const field = 'min-w-0'
const textAreaNoMap = `${input} min-h-[5.5rem] resize-y py-3`
const liftRow =
  'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25'
const liftInput = 'h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500'

export default function Step1Address({
  data,
  onChange,
  serviceType,
  serviceTypeOptions,
  onServiceTypeChange,
}) {
  function set(k, v) {
    onChange({ ...data, [k]: v })
  }

  useEffect(() => {
    if (data.arrivalWindow === 'afternoon') {
      onChange({ ...data, arrivalWindow: 'evening' })
    }
  }, [data.arrivalWindow])

  const showServicePicker =
    typeof onServiceTypeChange === 'function' &&
    Array.isArray(serviceTypeOptions) &&
    serviceTypeOptions.length > 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Address & access</h2>
        <p className="mt-1 text-sm text-slate-600">
          Where we’re collecting from and delivering to, plus access for planning.
        </p>
        {HAS_MAPBOX && (
          <p className="mt-2 text-sm text-slate-600">
            Use the address search and <strong className="font-semibold text-slate-800">select a suggestion</strong> for
            each location so we can plot the route and distance.
          </p>
        )}
      </div>

      {showServicePicker && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
          <label className={label} htmlFor="quote-service-type">
            Service type
          </label>
          <select
            id="quote-service-type"
            value={serviceType ?? serviceTypeOptions[0]}
            onChange={(e) => onServiceTypeChange(e.target.value)}
            className={input}
          >
            {serviceTypeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-600">
            Your live price updates on the review step when you change service or details.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 sm:items-start">
        {HAS_MAPBOX ? (
          <>
            <MapboxAddressField
              label="Pickup address"
              markerLetter="A"
              markerClassName="bg-brand-600"
              placeholder="e.g. EH1 1YZ, Glasgow, or street address"
              address={data.pickupAddress}
              lng={data.pickupLng}
              lat={data.pickupLat}
              addressKey="pickupAddress"
              lngKey="pickupLng"
              latKey="pickupLat"
              data={data}
              onChange={onChange}
            />
            <MapboxAddressField
              label="Delivery address"
              markerLetter="B"
              markerClassName="bg-emerald-600"
              placeholder="e.g. G1 1XX, Edinburgh, or street address"
              address={data.deliveryAddress}
              lng={data.deliveryLng}
              lat={data.deliveryLat}
              addressKey="deliveryAddress"
              lngKey="deliveryLng"
              latKey="deliveryLat"
              data={data}
              onChange={onChange}
            />
          </>
        ) : (
          <>
            <div className={field}>
              <label className={label} htmlFor="pickupAddress-fallback">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                    A
                  </span>
                  Pickup address
                </span>
              </label>
              <textarea
                id="pickupAddress-fallback"
                required
                rows={3}
                value={data.pickupAddress}
                onChange={(e) => set('pickupAddress', e.target.value)}
                className={textAreaNoMap}
                placeholder="Postcode or full address"
              />
            </div>
            <div className={field}>
              <label className={label} htmlFor="deliveryAddress-fallback">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                    B
                  </span>
                  Delivery address
                </span>
              </label>
              <textarea
                id="deliveryAddress-fallback"
                required
                rows={3}
                value={data.deliveryAddress}
                onChange={(e) => set('deliveryAddress', e.target.value)}
                className={textAreaNoMap}
                placeholder="Postcode or full address"
              />
            </div>
          </>
        )}

        <label className={field}>
          <span className={label}>Pickup property type</span>
          <select
            value={data.pickupPropertyType}
            onChange={(e) => set('pickupPropertyType', e.target.value)}
            className={input}
          >
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          <span className={label}>Delivery property type</span>
          <select
            value={data.deliveryPropertyType}
            onChange={(e) => set('deliveryPropertyType', e.target.value)}
            className={input}
          >
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className={field}>
          <FloorSelect
            label="Pickup floor"
            value={data.pickupFloor}
            onChange={(v) => set('pickupFloor', v)}
          />
        </div>
        <div className={field}>
          <FloorSelect
            label="Delivery floor"
            value={data.deliveryFloor}
            onChange={(v) => set('deliveryFloor', v)}
          />
        </div>

        <label className={`${field} ${liftRow}`}>
          <input
            type="checkbox"
            checked={data.pickupLift}
            onChange={(e) => set('pickupLift', e.target.checked)}
            className={liftInput}
          />
          <span className="text-sm font-medium leading-snug text-slate-800">Lift available at pickup</span>
        </label>
        <label className={`${field} ${liftRow}`}>
          <input
            type="checkbox"
            checked={data.deliveryLift}
            onChange={(e) => set('deliveryLift', e.target.checked)}
            className={liftInput}
          />
          <span className="text-sm font-medium leading-snug text-slate-800">Lift available at delivery</span>
        </label>

        <label className={field}>
          <span className={label}>Move date</span>
          <input
            type="date"
            required
            min={getLocalDateYYYYMMDD()}
            value={data.moveDate}
            onChange={(e) => set('moveDate', e.target.value)}
            className={input}
          />
        </label>
        <label className={field}>
          <span className={label}>Preferred arrival window</span>
          <select
            value={data.arrivalWindow}
            onChange={(e) => {
              const v = e.target.value
              set('arrivalWindow', v)
              if (v !== 'exact') set('exactArrivalTime', '')
            }}
            className={input}
          >
            {ARRIVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {data.arrivalWindow === 'exact' && (
          <div className={`${field} space-y-2`}>
            <label className="block">
              <span className={label}>Preferred arrival time</span>
              <select
                value={data.exactArrivalTime || ''}
                onChange={(e) => set('exactArrivalTime', e.target.value)}
                className={input}
                required={data.arrivalWindow === 'exact'}
              >
                <option value="">Select hour (08:00–18:00)</option>
                {EXACT_HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-relaxed text-amber-900/90">
              Exact time requests are subject to route availability. A premium applies — shown in your estimate on step 4.
            </p>
          </div>
        )}

        <label className={`${field} sm:col-span-2`}>
          <span className={label}>Distance (miles)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={data.distanceMiles === 0 ? '' : data.distanceMiles}
            onChange={(e) => {
              const v = e.target.value
              set('distanceMiles', v === '' ? 0 : parseFloat(v) || 0)
            }}
            className={input}
          />
          <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">
            {HAS_MAPBOX
              ? 'Updates automatically when the route is calculated. You can adjust manually if the route cannot be found.'
              : 'Enter the driving distance in miles for your estimate.'}
          </span>
        </label>
      </div>
    </div>
  )
}
