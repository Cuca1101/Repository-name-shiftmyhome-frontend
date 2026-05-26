import { useEffect, useState } from 'react'
import MapboxAddressField from '../MapboxAddressField'
import FloorSelect, { floorNeedsLiftQuestion } from '../FloorSelect'
import { getLocalDateYYYYMMDD } from '../../../lib/moveDateLocal'
import MobileStepTitleWithRef from '../MobileStepTitleWithRef'
import MobileStep1ArrivalWindow from '../MobileStep1ArrivalWindow'
import Step1ArrivalFields from '../Step1ArrivalFields'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']

const HAS_MAPBOX = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

const input =
  'box-border min-h-[34px] w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:min-h-[48px] sm:rounded-xl sm:px-4 sm:text-base'
const label = 'mb-0.5 block text-xs font-medium leading-snug text-slate-700 sm:mb-1.5 sm:text-sm'
const field = 'box-border min-w-0 w-full'
const textAreaNoMap = `${input} min-h-[4.75rem] resize-y py-2 sm:min-h-[5.5rem] sm:py-3`
const liftFieldset =
  'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:rounded-xl sm:px-4 sm:py-3'
const liftLegend = 'mb-1 block text-xs font-medium leading-snug text-slate-700 sm:mb-2 sm:text-sm'
const liftOption =
  'flex min-h-[34px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium leading-snug text-slate-800 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-900 sm:min-h-[40px] sm:gap-2 sm:px-3 sm:text-sm'
const liftRadio = 'h-3.5 w-3.5 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500 sm:h-4 sm:w-4'

const MOBILE_LIFT_SLOT = 'min-h-[5.375rem] shrink-0 md:hidden'

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
  servicePreSelected = false,
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

  const [serviceExpanded, setServiceExpanded] = useState(false)

  const hasServicePicker =
    typeof onServiceTypeChange === 'function' &&
    Array.isArray(serviceTypeOptions) &&
    serviceTypeOptions.length > 0

  const showFullServicePicker = hasServicePicker && (!servicePreSelected || serviceExpanded)

  const showPickupLift = floorNeedsLiftQuestion(data.pickupFloor)
  const showDeliveryLift = floorNeedsLiftQuestion(data.deliveryFloor)

  return (
    <div data-quote-step="1" className="box-border w-full min-w-0 space-y-2 sm:space-y-8">
      <div>
        <MobileStepTitleWithRef
          title="Address & access"
          quoteRef={quoteRef}
          titleClassName="whitespace-nowrap md:whitespace-normal"
        />
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
        {HAS_MAPBOX && (
          <p className="mt-2 text-sm leading-snug text-slate-600 md:hidden">
            Use address search and <strong className="font-semibold text-slate-800">select a suggestion</strong> for
            each location to plot the route.
          </p>
        )}
      </div>

      {hasServicePicker && servicePreSelected && !serviceExpanded && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600">Service:</span>
          <span className="font-semibold text-slate-900">{serviceType}</span>
          <button
            type="button"
            onClick={() => setServiceExpanded(true)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800"
          >
            Change
          </button>
        </div>
      )}

      {showFullServicePicker && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 sm:rounded-2xl sm:p-5">
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

      <div className="grid grid-cols-2 gap-x-2 gap-y-2 xxs:gap-x-2.5 xs:gap-x-3 ph:gap-x-4 sm:gap-x-8 sm:gap-y-6 sm:items-start">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:rounded-lg sm:text-xs">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:rounded-lg sm:text-xs">
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

        <label className={`${field} hidden md:block`}>
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
        <label className={`${field} hidden md:block`}>
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

        <div className={`${field} hidden md:block`} data-quote-field="pickup-access">
          <FloorSelect
            label="Pickup floor"
            value={data.pickupFloor}
            onChange={(v) => set('pickupFloor', v)}
          />
        </div>
        <div className={`${field} hidden md:block`} data-quote-field="delivery-access">
          <FloorSelect
            label="Delivery floor"
            value={data.deliveryFloor}
            onChange={(v) => set('deliveryFloor', v)}
          />
        </div>

        {showPickupLift ? (
          <div className={`${field} hidden md:block`} data-quote-field="pickup-lift">
            <LiftYesNoField
              legend="Lift at pickup"
              name="pickupLift"
              value={data.pickupLift}
              onSelect={(v) => set('pickupLift', v)}
            />
          </div>
        ) : null}
        {showDeliveryLift ? (
          <div className={`${field} hidden md:block`} data-quote-field="delivery-lift">
            <LiftYesNoField
              legend="Lift at delivery"
              name="deliveryLift"
              value={data.deliveryLift}
              onSelect={(v) => set('deliveryLift', v)}
            />
          </div>
        ) : null}

        <label className={`${field} hidden md:block`} data-quote-field="move-date">
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

        {/* Mobile: move date stays in left column under pickup access fields */}
        <div className="col-span-2 grid grid-cols-2 gap-x-2 gap-y-2 md:hidden">
          <div className="flex min-w-0 flex-col gap-2">
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
            <div className={field} data-quote-field="pickup-access">
              <FloorSelect
                label="Pickup floor"
                value={data.pickupFloor}
                onChange={(v) => set('pickupFloor', v)}
              />
            </div>
            {showPickupLift ? (
              <div className={field} data-quote-field="pickup-lift">
                <LiftYesNoField
                  legend="Lift at pickup"
                  name="pickupLift"
                  value={data.pickupLift}
                  onSelect={(v) => set('pickupLift', v)}
                />
              </div>
            ) : (
              <div className={MOBILE_LIFT_SLOT} aria-hidden />
            )}
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
          </div>

          <div className="flex min-w-0 flex-col gap-2">
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
            <div className={field} data-quote-field="delivery-access">
              <FloorSelect
                label="Delivery floor"
                value={data.deliveryFloor}
                onChange={(v) => set('deliveryFloor', v)}
              />
            </div>
            {showDeliveryLift ? (
              <div className={field} data-quote-field="delivery-lift">
                <LiftYesNoField
                  legend="Lift at delivery"
                  name="deliveryLift"
                  value={data.deliveryLift}
                  onSelect={(v) => set('deliveryLift', v)}
                />
              </div>
            ) : (
              <div className={MOBILE_LIFT_SLOT} aria-hidden />
            )}
          </div>
        </div>

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
              onChange({
                ...data,
                distanceMiles: v === '' ? 0 : parseFloat(v) || 0,
                mapboxRouteDurationSeconds: null,
              })
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
