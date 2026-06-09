import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'
import MapboxAddressField from './MapboxAddressField'
import FloorSelect, { floorNeedsLiftQuestion } from './FloorSelect'
import { liftClearPatchForWizard } from '../../lib/floorAccess'
import MobileStep1ArrivalWindow from './MobileStep1ArrivalWindow'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']

const mobileInput =
  'box-border min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const mobileLabel = 'mb-1 block text-xs font-medium leading-snug text-slate-700'
const textAreaNoMap = `${mobileInput} min-h-[5.5rem] resize-none py-2`
const liftFieldset =
  'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm'
const liftLegend = 'mb-1.5 block text-xs font-medium leading-snug text-slate-700'
const liftOption =
  'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-medium leading-snug text-slate-800 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-900'
const liftRadio = 'h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500'

const SECTION = {
  PICKUP_PROPERTY: 'pickup-property',
  PICKUP_FLOOR: 'pickup-floor',
  PICKUP_LIFT: 'pickup-lift',
  DELIVERY_ADDRESS: 'delivery-address',
  DELIVERY_PROPERTY: 'delivery-property',
  DELIVERY_FLOOR: 'delivery-floor',
  DELIVERY_LIFT: 'delivery-lift',
  MOVE_DATE: 'move-date',
  ARRIVAL: 'arrival',
}

function coordsReady(lng, lat) {
  return lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)
}

/** @param {Record<string, unknown>} data */
/** Sections always visible on mobile — addresses + property types. */
const ALWAYS_VISIBLE = new Set([
  'pickup-address',
  SECTION.PICKUP_PROPERTY,
  SECTION.DELIVERY_ADDRESS,
  SECTION.DELIVERY_PROPERTY,
])

function computeInitialSections(data) {
  const open = new Set(ALWAYS_VISIBLE)
  if (!coordsReady(data.pickupLng, data.pickupLat)) return open

  open.add(SECTION.PICKUP_PROPERTY)
  open.add(SECTION.PICKUP_FLOOR)
  if (data.pickupFloor == null) return open

  if (floorNeedsLiftQuestion(data.pickupFloor)) {
    open.add(SECTION.PICKUP_LIFT)
    if (data.pickupLift == null) return open
  }

  open.add(SECTION.DELIVERY_ADDRESS)
  if (!coordsReady(data.deliveryLng, data.deliveryLat)) return open

  open.add(SECTION.DELIVERY_PROPERTY)
  open.add(SECTION.DELIVERY_FLOOR)
  if (data.deliveryFloor == null) return open

  if (floorNeedsLiftQuestion(data.deliveryFloor)) {
    open.add(SECTION.DELIVERY_LIFT)
    if (data.deliveryLift == null) return open
  }

  open.add(SECTION.MOVE_DATE)
  if (!String(data.moveDate || '').trim()) return open

  open.add(SECTION.ARRIVAL)
  return open
}

function focusById(id) {
  window.requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (!el || typeof el.focus !== 'function') return
    el.focus({ preventScroll: false })
    if (typeof el.click === 'function' && el.tagName === 'BUTTON') {
      return
    }
    if (typeof el.showPicker === 'function' && el.type === 'date') {
      try {
        el.showPicker()
      } catch {
        /* unsupported */
      }
    }
  })
}

function MobileLiftYesNoField({ legend, name, value, onSelect, liftYesId, liftNoId }) {
  return (
    <fieldset className={liftFieldset}>
      <legend className={liftLegend}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={legend}>
        <label className={liftOption}>
          <input
            id={liftYesId}
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
            id={liftNoId}
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

function MobileCardRow({ children, allowOverflow = false }) {
  return (
    <div
      className={`quote-mobile-step1-row px-3 py-2.5 ${allowOverflow ? 'relative z-20 overflow-visible' : ''}`}
    >
      {children}
    </div>
  )
}

/**
 * Mobile Step 1 — stacked card layout with progressive accordion (UI only).
 */
export default function MobileStep1AddressCards({
  data,
  onChange,
  set,
  hasMapbox,
  arrivalError = '',
  showPickupLift,
  showDeliveryLift,
}) {
  const [openSections, setOpenSections] = useState(() => computeInitialSections(data))
  const [activeDropdown, setActiveDropdown] = useState(null)

  useEffect(() => {
    const patch = liftClearPatchForWizard(data)
    if (patch) applyWizardPatch(onChange, patch)

    setOpenSections((prev) => {
      const next = new Set([...prev, ...computeInitialSections(data)])
      if (!floorNeedsLiftQuestion(data.pickupFloor)) next.delete(SECTION.PICKUP_LIFT)
      if (!floorNeedsLiftQuestion(data.deliveryFloor)) next.delete(SECTION.DELIVERY_LIFT)
      return next
    })
  }, [
    data.pickupLng,
    data.pickupLat,
    data.pickupFloor,
    data.pickupLift,
    data.deliveryLng,
    data.deliveryLat,
    data.deliveryFloor,
    data.deliveryLift,
    data.moveDate,
  ])

  const unlock = useCallback((section) => {
    setOpenSections((prev) => new Set([...prev, section]))
  }, [])

  const closeDropdowns = useCallback(() => setActiveDropdown(null), [])

  const show = useMemo(
    () => ({
      pickupProperty: true,
      pickupFloor: openSections.has(SECTION.PICKUP_FLOOR),
      pickupLift: openSections.has(SECTION.PICKUP_LIFT) && showPickupLift,
      deliveryFloor: openSections.has(SECTION.DELIVERY_FLOOR),
      deliveryLift: openSections.has(SECTION.DELIVERY_LIFT) && showDeliveryLift,
      moveDate: openSections.has(SECTION.MOVE_DATE),
      arrival: openSections.has(SECTION.ARRIVAL),
    }),
    [openSections, showPickupLift, showDeliveryLift],
  )

  function onPickupAddressSelected() {
    unlock(SECTION.PICKUP_PROPERTY)
    focusById('quote-mobile-pickup-property-type')
  }

  function openPickupFloor() {
    unlock(SECTION.PICKUP_FLOOR)
    closeDropdowns()
    focusById('quote-mobile-pickup-floor')
    setActiveDropdown('pickup-floor')
  }

  function onPickupPropertyChange(e) {
    set('pickupPropertyType', e.target.value)
    openPickupFloor()
  }

  function onPickupPropertyCommit() {
    if (openSections.has(SECTION.PICKUP_PROPERTY)) {
      openPickupFloor()
    }
  }

  function onPickupFloorChange(v) {
    if (floorNeedsLiftQuestion(v)) {
      set('pickupFloor', v)
    } else {
      applyWizardPatch(onChange, { pickupFloor: v, pickupLift: null })
    }
    closeDropdowns()
    if (floorNeedsLiftQuestion(v)) {
      unlock(SECTION.PICKUP_LIFT)
      focusById('quote-mobile-pickup-lift-yes')
      return
    }
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.delete(SECTION.PICKUP_LIFT)
      return next
    })
    unlock(SECTION.DELIVERY_ADDRESS)
    focusById(hasMapbox ? 'deliveryAddress' : 'quote-mobile-delivery-address-fallback')
  }

  function onPickupLiftSelect(v) {
    set('pickupLift', v)
    unlock(SECTION.DELIVERY_ADDRESS)
    focusById(hasMapbox ? 'deliveryAddress' : 'quote-mobile-delivery-address-fallback')
  }

  function onDeliveryAddressSelected() {
    unlock(SECTION.DELIVERY_PROPERTY)
    unlock(SECTION.DELIVERY_FLOOR)
    focusById('quote-mobile-delivery-property-type')
  }

  function openDeliveryFloor() {
    unlock(SECTION.DELIVERY_FLOOR)
    closeDropdowns()
    focusById('quote-mobile-delivery-floor')
    setActiveDropdown('delivery-floor')
  }

  function onDeliveryPropertyChange(e) {
    set('deliveryPropertyType', e.target.value)
    openDeliveryFloor()
  }

  function onDeliveryPropertyCommit() {
    if (openSections.has(SECTION.DELIVERY_PROPERTY)) {
      openDeliveryFloor()
    }
  }

  function onDeliveryFloorChange(v) {
    if (floorNeedsLiftQuestion(v)) {
      set('deliveryFloor', v)
    } else {
      applyWizardPatch(onChange, { deliveryFloor: v, deliveryLift: null })
    }
    closeDropdowns()
    if (floorNeedsLiftQuestion(v)) {
      unlock(SECTION.DELIVERY_LIFT)
      focusById('quote-mobile-delivery-lift-yes')
      return
    }
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.delete(SECTION.DELIVERY_LIFT)
      return next
    })
    unlock(SECTION.MOVE_DATE)
    focusById('quote-mobile-move-date')
  }

  function onDeliveryLiftSelect(v) {
    set('deliveryLift', v)
    unlock(SECTION.MOVE_DATE)
    focusById('quote-mobile-move-date')
  }

  function onMoveDateChange(e) {
    set('moveDate', e.target.value)
    if (e.target.value) {
      unlock(SECTION.ARRIVAL)
      window.requestAnimationFrame(() => {
        const trigger = document.getElementById('quote-mobile-arrival-trigger')
        trigger?.focus({ preventScroll: false })
        trigger?.click()
      })
    }
  }

  return (
    <div className="quote-mobile-step1-flow overflow-visible">
      <MobileCardRow allowOverflow>
          {hasMapbox ? (
            <MapboxAddressField
              label="Pickup address"
              markerLetter="A"
              markerClassName="bg-brand-600"
              placeholder="Postcode or street address"
              address={data.pickupAddress}
              lng={data.pickupLng}
              lat={data.pickupLat}
              addressKey="pickupAddress"
              lngKey="pickupLng"
              latKey="pickupLat"
              confirmedKey="pickupAddressConfirmed"
              nextFocusId="quote-mobile-pickup-property-type"
              onAddressSelected={onPickupAddressSelected}
              variant="mobile-card"
              onChange={onChange}
            />
          ) : (
            <div data-quote-field="pickup-address">
              <label className={mobileLabel} htmlFor="quote-mobile-pickup-address-fallback">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white">
                    A
                  </span>
                  Pickup address
                </span>
              </label>
              <textarea
                id="quote-mobile-pickup-address-fallback"
                required
                rows={3}
                value={data.pickupAddress}
                onChange={(e) => set('pickupAddress', e.target.value)}
                className={textAreaNoMap}
                placeholder="Postcode or full address"
              />
            </div>
          )}
        </MobileCardRow>

        <MobileCardRow>
          <label className="block">
            <span className={mobileLabel}>Pickup property type</span>
              <select
                id="quote-mobile-pickup-property-type"
                value={data.pickupPropertyType}
                onChange={onPickupPropertyChange}
                onBlur={onPickupPropertyCommit}
                onFocus={closeDropdowns}
                className={mobileInput}
              >
                {PROPERTY_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
        </MobileCardRow>

        {show.pickupFloor ? (
          <MobileCardRow>
            <FloorSelect
              id="quote-mobile-pickup-floor"
              label="Pickup floor"
              value={data.pickupFloor}
              onChange={onPickupFloorChange}
              variant="mobile-card"
              open={activeDropdown === 'pickup-floor'}
              onOpenChange={(next) => setActiveDropdown(next ? 'pickup-floor' : null)}
            />
          </MobileCardRow>
        ) : null}

        {show.pickupLift ? (
          <MobileCardRow>
            <div data-quote-field="pickup-lift">
              <MobileLiftYesNoField
                legend="Lift at pickup"
                name="pickupLift"
                value={data.pickupLift}
                liftYesId="quote-mobile-pickup-lift-yes"
                liftNoId="quote-mobile-pickup-lift-no"
                onSelect={onPickupLiftSelect}
              />
            </div>
          </MobileCardRow>
        ) : null}

        <MobileCardRow allowOverflow>
          {hasMapbox ? (
            <MapboxAddressField
              label="Delivery address"
                markerLetter="B"
                markerClassName="bg-emerald-600"
                placeholder="Postcode or street address"
                address={data.deliveryAddress}
                lng={data.deliveryLng}
                lat={data.deliveryLat}
                addressKey="deliveryAddress"
                lngKey="deliveryLng"
                latKey="deliveryLat"
                confirmedKey="deliveryAddressConfirmed"
                nextFocusId="quote-mobile-delivery-property-type"
                onAddressSelected={onDeliveryAddressSelected}
                variant="mobile-card"
                onChange={onChange}
              />
            ) : (
              <div data-quote-field="delivery-address">
                <label className={mobileLabel} htmlFor="quote-mobile-delivery-address-fallback">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white">
                      B
                    </span>
                    Delivery address
                  </span>
                </label>
                <textarea
                  id="quote-mobile-delivery-address-fallback"
                  required
                  rows={3}
                  value={data.deliveryAddress}
                  onChange={(e) => set('deliveryAddress', e.target.value)}
                  className={textAreaNoMap}
                  placeholder="Postcode or full address"
                />
              </div>
            )}
        </MobileCardRow>

        <MobileCardRow>
          <label className="block">
            <span className={mobileLabel}>Delivery property type</span>
            <select
              id="quote-mobile-delivery-property-type"
              value={data.deliveryPropertyType}
              onChange={onDeliveryPropertyChange}
              onBlur={onDeliveryPropertyCommit}
              onFocus={closeDropdowns}
              className={mobileInput}
            >
              {PROPERTY_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </MobileCardRow>

          {show.deliveryFloor ? (
            <MobileCardRow>
              <FloorSelect
                id="quote-mobile-delivery-floor"
                label="Delivery floor"
                value={data.deliveryFloor}
                onChange={onDeliveryFloorChange}
                variant="mobile-card"
                open={activeDropdown === 'delivery-floor'}
                onOpenChange={(next) => setActiveDropdown(next ? 'delivery-floor' : null)}
              />
            </MobileCardRow>
          ) : null}

          {show.deliveryLift ? (
            <MobileCardRow>
              <div data-quote-field="delivery-lift">
                <MobileLiftYesNoField
                  legend="Lift at delivery"
                  name="deliveryLift"
                  value={data.deliveryLift}
                  liftYesId="quote-mobile-delivery-lift-yes"
                  liftNoId="quote-mobile-delivery-lift-no"
                  onSelect={onDeliveryLiftSelect}
                />
              </div>
            </MobileCardRow>
          ) : null}

      {show.moveDate ? (
        <MobileCardRow>
          <label className="block" data-quote-field="move-date">
            <span className={mobileLabel}>Move date</span>
            <input
              id="quote-mobile-move-date"
              type="date"
              required
              min={getLocalDateYYYYMMDD()}
              value={data.moveDate}
              onChange={onMoveDateChange}
              className={mobileInput}
            />
          </label>
        </MobileCardRow>
      ) : null}

      {show.arrival ? (
        <MobileCardRow>
          <div data-quote-field="arrival">
            <MobileStep1ArrivalWindow
              data={data}
              onChange={onChange}
              error={arrivalError}
              triggerId="quote-mobile-arrival-trigger"
              variant="mobile-card"
            />
          </div>
        </MobileCardRow>
      ) : null}
    </div>
  )
}
