import { useEffect } from 'react'
import MapboxAddressField from '../MapboxAddressField'
import FloorSelect from '../FloorSelect'
import { getLocalDateYYYYMMDD } from '../../../lib/moveDateLocal'
import MobileStep1ArrivalWindow from '../MobileStep1ArrivalWindow'
import Step1ArrivalFields from '../Step1ArrivalFields'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']

const HAS_MAPBOX = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

const input =
  'min-h-[38px] w-full max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-base text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 xxs:min-h-[40px] xxs:px-2.5 xs:rounded-xl sm:min-h-[48px] sm:px-4'
const label = 'mb-1.5 block text-sm font-medium text-slate-700'
const field = 'min-w-0'
const textAreaNoMap = `${input} min-h-[5.5rem] resize-y py-3`
const liftFieldset =
  'min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3'
const liftLegend = 'mb-2 block text-sm font-medium text-slate-700'
const liftOption =
  'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-900'
const liftRadio = 'h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500'

function LiftYesNoField({ legend, name, value, onSelect }) {
  return (
    <fieldset className={liftFieldset}>
      <legend className={liftLegend}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={legend}>
        <label className={liftOption}>
          <input
            type="radio"
            name={name}
            className={liftRadio}
            checked={value === true}
            onChange={() => onSelect(true)}
          />
          Yes
        </label>
        <label className={liftOption}>
          <input
            type="radio"
            name={name}
            className={liftRadio}
            checked={value === false}
            onChange={() => onSelect(false)}
          />
          No
        </label>
      </div>
    </fieldset>
  )
}

export default function Step1Address({
  data,
  onChange,
  quoteRef,
  serviceType,
  serviceTypeOptions,
  onServiceTypeChange,
  arrivalError = '',
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
    <div className="space-y-4 sm:space-y-8">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="whitespace-nowrap text-base font-bold leading-tight text-slate-900 md:whitespace-normal md:text-2xl">
              Address & access
            </h2>
            <p className="mt-1 text-sm leading-snug text-slate-600 md:hidden">Pickup, delivery and access details.</p>
            <p className="mt-1 hidden text-sm text-slate-600 md:block">
              Where we’re collecting from and delivering to, plus access for planning.
            </p>
            {HAS_MAPBOX && (
              <p className="mt-2 hidden text-sm text-slate-600 md:block">
                Use the address search and <strong className="font-semibold text-slate-800">select a suggestion</strong>{' '}
                for each location so we can plot the route and distance.
              </p>
            )}
          </div>
          {quoteRef ? (
            <div
              className="flex w-[140px] shrink-0 flex-col justify-center rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2 md:hidden"
              aria-label="Quote reference"
            >
              <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-blue-600">Reference</p>
              <p className="mt-0.5 truncate font-mono text-xs font-bold leading-tight text-blue-900">{quoteRef}</p>
            </div>
          ) : null}
        </div>
        {HAS_MAPBOX && (
          <p className="mt-2 text-sm leading-snug text-slate-600 md:hidden">
            Use address search and <strong className="font-semibold text-slate-800">select a suggestion</strong> for
            each location to plot the route.
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

      <div className="grid grid-cols-2 gap-x-2 gap-y-3 xxs:gap-x-2.5 xxs:gap-y-3.5 xs:gap-x-3 ph:gap-x-4 sm:gap-x-8 sm:gap-y-6 sm:items-start">
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
            <div className={field} data-quote-field="pickup-address">
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
            <div className={field} data-quote-field="delivery-address">
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

        <div className={field} data-quote-field="pickup-access">
          <FloorSelect
            label="Pickup floor"
            value={data.pickupFloor}
            onChange={(v) => set('pickupFloor', v)}
          />
        </div>
        <div className={field} data-quote-field="delivery-access">
          <FloorSelect
            label="Delivery floor"
            value={data.deliveryFloor}
            onChange={(v) => set('deliveryFloor', v)}
          />
        </div>

        <div className={field}>
          <LiftYesNoField
            legend="Lift available at pickup"
            name="pickupLift"
            value={data.pickupLift}
            onSelect={(v) => set('pickupLift', v)}
          />
        </div>
        <div className={field}>
          <LiftYesNoField
            legend="Lift available at delivery"
            name="deliveryLift"
            value={data.deliveryLift}
            onSelect={(v) => set('deliveryLift', v)}
          />
        </div>

        <label className={field} data-quote-field="move-date">
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
        <div className={`${field} hidden sm:col-span-2 md:block`} data-quote-field="arrival">
          <Step1ArrivalFields data={data} onChange={onChange} error={arrivalError} />
        </div>

        <div className={`${field} col-span-2 md:hidden`} data-quote-field="arrival">
          <MobileStep1ArrivalWindow data={data} onChange={onChange} error={arrivalError} />
        </div>

        <label className={`${field} hidden sm:col-span-2 md:block`}>
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
