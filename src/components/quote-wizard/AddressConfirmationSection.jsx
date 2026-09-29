import { useRef, useState } from 'react'
import { Check, Loader2, MapPin, Pencil, Search } from 'lucide-react'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import {
  canConfirmDeliveryAddress,
  canConfirmPickupAddress,
  hasMapboxToken,
  isReviewSideConfirmed,
  reviewAddressStamp,
  reviewAddressesConfirmed,
} from '../../lib/addressConfirmation'
import {
  addressPlacePatch,
  createAddressSessionToken,
  emptyAddressPlacePatch,
  findUkAddressByText,
  hasGoogleMapsKey,
  isUkPostcodeQuery,
  placeFromPrediction,
  suggestUkStreets,
} from '../../lib/googlePlaces'
import { hasIdealPostcodesKey, lookupUkPostcode } from '../../lib/idealPostcodes'
import { hasSnapPostcodeLookup, lookupSnapPostcode, suggestSnapAddresses } from '../../lib/snapAddress'
import {
  contactDetailsComplete,
  isDropoffSameAsPickup,
  resolvePickupContact,
} from '../../lib/quoteWizardContactFields'

const GOOGLE_ATTRIBUTION_SRC =
  'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png'

const EMPTY_MESSAGE = "We couldn't find that address. Try again or enter it manually."

/**
 * Step 3 — search, check and confirm pickup and drop-off without leaving Review.
 */
export default function AddressConfirmationSection({
  data,
  onChange,
  fieldErrors = {},
}) {
  const sameDropoff = isDropoffSameAsPickup(data)
  const pickupConfirmed = isReviewSideConfirmed(data, 'pickup')
  const deliveryConfirmed = isReviewSideConfirmed(data, 'delivery')

  function patch(next) {
    applyWizardPatch(onChange, next)
  }

  function confirmSide(side) {
    const can =
      side === 'pickup'
        ? canConfirmPickupAddress(data, hasMapboxToken())
        : canConfirmDeliveryAddress(data, hasMapboxToken())
    if (!can) return
    const pickup = resolvePickupContact(data)
    const next = {
      [`${side}AddressConfirmed`]: true,
      [`${side}ReviewStamp`]: reviewAddressStamp(data, side),
      pickupContactName: pickup.name,
      pickupContactPhone: pickup.phone,
    }
    if (side === 'delivery' && sameDropoff) {
      next.deliveryContactName = pickup.name
      next.deliveryContactPhone = pickup.phone
    }
    patch(next)
  }

  return (
    <div className="space-y-3" data-quote-field="address-confirmation" id="quote-wizard-address-confirmation">
      <AddressCard
        side="pickup"
        title="Pickup address"
        data={data}
        onChange={onChange}
        confirmed={pickupConfirmed}
        error={fieldErrors.pickupAddressConfirmed}
        onConfirm={() => confirmSide('pickup')}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-sm font-bold text-slate-900">Who will be at drop-off?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ChoiceButton
            selected={sameDropoff}
            label="Same person as pickup"
            onClick={() => {
              const pickup = resolvePickupContact(data)
              patch({
                dropoffSameAsPickup: true,
                deliveryContactSameAsCustomer: true,
                deliveryContactName: pickup.name,
                deliveryContactPhone: pickup.phone,
              })
            }}
          />
          <ChoiceButton
            selected={!sameDropoff}
            label="Different person"
            onClick={() =>
              patch({
                dropoffSameAsPickup: false,
                deliveryContactSameAsCustomer: false,
              })
            }
          />
        </div>
      </div>

      <AddressCard
        side="delivery"
        title="Drop-off address"
        data={data}
        onChange={onChange}
        confirmed={deliveryConfirmed}
        error={fieldErrors.deliveryAddressConfirmed}
        showContact={!sameDropoff}
        onConfirm={() => confirmSide('delivery')}
      />
    </div>
  )
}

/** @param {Record<string, unknown>} data */
export function structuredAddressesConfirmed(data) {
  return reviewAddressesConfirmed(data)
}

function ChoiceButton({ selected, label, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
        selected
          ? 'border-blue-500 bg-white text-slate-900 ring-1 ring-blue-500'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-blue-600' : 'border-slate-300'
        }`}
        aria-hidden
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  )
}

function AddressCard({ side, title, data, onChange, confirmed, error, showContact = true, onConfirm }) {
  const isPickup = side === 'pickup'
  const canConfirm = isPickup
    ? canConfirmPickupAddress(data, hasMapboxToken())
    : canConfirmDeliveryAddress(data, hasMapboxToken())
  const input =
    'box-border min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

  function patch(next) {
    applyWizardPatch(onChange, next)
  }

  function changeHouseNumber(value) {
    const prevHouse = String(data[`${side}HouseNumber`] || '')
    patch({
      [`${side}HouseNumber`]: value,
      [`${side}Address`]: replaceLeadingHouseNumber(data[`${side}Address`], prevHouse, value),
    })
  }

  const contactName = isPickup
    ? data.pickupContactSameAsCustomer === false
      ? data.pickupContactName || ''
      : data.pickupContactName || data.fullName || ''
    : data.deliveryContactName || ''
  const contactPhone = isPickup
    ? data.pickupContactSameAsCustomer === false
      ? data.pickupContactPhone || ''
      : data.pickupContactPhone || data.phone || ''
    : data.deliveryContactPhone || ''

  return (
    <section
      className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${
        isPickup ? 'border-emerald-100 bg-[#f4fbf7]' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>

      <PlaceSearch side={side} data={data} onChange={onChange} confirmed={confirmed} />

      <div className="mt-3 grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">House number</span>
          <input
            value={String(data[`${side}HouseNumber`] || '')}
            onChange={(e) => changeHouseNumber(e.target.value)}
            className={input}
            placeholder="e.g. 12"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Flat / unit / access details (optional)</span>
          <input
            value={String(data[`${side}FlatDetails`] || '')}
            onChange={(e) => patch({ [`${side}FlatDetails`]: e.target.value })}
            className={input}
            placeholder={
              isPickup
                ? 'e.g. Flat 2, Rear Entrance, Call on arrival'
                : 'e.g. Flat 3, Side Door, Leave with neighbour'
            }
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {confirmed ? (
          <p className="mr-auto inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden />
            Address confirmed
          </p>
        ) : null}
        {hasGoogleMapsKey() ? (
          <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {showContact ? (
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-900">{isPickup ? 'Person at pickup' : 'Person at drop-off'}</p>
          <div className={`mt-2 grid gap-2 ${isPickup ? '' : 'sm:grid-cols-2'}`}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
              <input
                value={contactName}
                onChange={(e) =>
                  patch(
                    isPickup
                      ? { pickupContactName: e.target.value, pickupContactSameAsCustomer: false }
                      : { deliveryContactName: e.target.value, deliveryContactSameAsCustomer: false, dropoffSameAsPickup: false },
                  )
                }
                className={input}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Phone</span>
              <input
                value={contactPhone}
                onChange={(e) =>
                  patch(
                    isPickup
                      ? { pickupContactPhone: e.target.value, pickupContactSameAsCustomer: false }
                      : { deliveryContactPhone: e.target.value, deliveryContactSameAsCustomer: false, dropoffSameAsPickup: false },
                  )
                }
                className={input}
                type="tel"
                autoComplete="tel"
              />
            </label>
          </div>
          {isPickup && !contactDetailsComplete(contactName, contactPhone) ? (
            <p className="mt-1.5 text-[11px] text-amber-800">Add the name and phone for the person at pickup.</p>
          ) : null}
          {!isPickup && !contactDetailsComplete(contactName, contactPhone) ? (
            <p className="mt-1.5 text-[11px] text-amber-800">Add the name and phone for the person at drop-off.</p>
          ) : null}
        </div>
      ) : null}

      {confirmed ? null : (
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-800/70"
        >
          {isPickup ? 'Confirm pickup' : 'Confirm drop-off'}
        </button>
      )}
    </section>
  )
}

function PlaceSearch({ side, data, onChange, confirmed }) {
  const address = String(data[`${side}Address`] || '')
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)
  const [editing, setEditing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [notice, setNotice] = useState('')
  const [manualHouse, setManualHouse] = useState(String(data[`${side}HouseNumber`] || ''))
  const [manualLine, setManualLine] = useState(address)
  const [manualPostcode, setManualPostcode] = useState(String(data[`${side}Postcode`] || ''))
  const sessionRef = useRef(null)
  const requestRef = useRef(0)
  const inputClass =
    'box-border min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

  function patch(next) {
    applyWizardPatch(onChange, {
      [`${side}AddressConfirmed`]: false,
      [`${side}ReviewStamp`]: '',
      ...next,
    })
  }

  async function runSearch() {
    const typed = query.trim()
    setNotice('')
    if (typed.length < 2) {
      setResults([])
      setNotice(EMPTY_MESSAGE)
      return
    }
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setSearching(true)
    try {
      const postcodeOnly = isUkPostcodeQuery(typed)
      if (hasSnapPostcodeLookup() || (postcodeOnly && hasIdealPostcodesKey())) {
        let list = []
        try {
          if (hasSnapPostcodeLookup()) {
            list = postcodeOnly ? await lookupSnapPostcode(typed) : await suggestSnapAddresses(typed)
          }
        } catch {
          list = []
        }
        if (requestRef.current !== requestId) return
        if (list.length === 0 && postcodeOnly && hasIdealPostcodesKey()) {
          try {
            list = await lookupUkPostcode(typed)
          } catch {
            list = []
          }
        }
        if (requestRef.current !== requestId) return
        if (list.length > 0) {
          setResults(list)
          setNotice('')
          return
        }
      }
      if (!hasGoogleMapsKey() || typed.length < 3) {
        setResults([])
        setNotice(EMPTY_MESSAGE)
        return
      }
      sessionRef.current = await createAddressSessionToken()
      const list = await suggestUkStreets(typed, sessionRef.current)
      if (requestRef.current !== requestId) return
      setResults(list)
      setNotice(list.length ? '' : EMPTY_MESSAGE)
    } catch {
      if (requestRef.current === requestId) {
        setResults([])
        setNotice(EMPTY_MESSAGE)
      }
    } finally {
      if (requestRef.current === requestId) setSearching(false)
    }
  }

  async function choose(item) {
    setSearching(true)
    setNotice('')
    try {
      if (item.source === 'snap-group' && item.postcode) {
        const list = await lookupSnapPostcode(item.postcode)
        if (list.length > 0) {
          setResults(list)
          return
        }
      }
      let place = item.place
      if (item.prediction) place = await placeFromPrediction(item.prediction)
      if ((item.source === 'ideal' || item.source === 'snap') && (place?.lng == null || place?.lat == null)) {
        const hit = await findUkAddressByText(place?.formattedAddress || '')
        if (hit?.lng != null) place = { ...place, lng: hit.lng, lat: hit.lat }
      }
      if (!place?.formattedAddress) {
        setNotice(EMPTY_MESSAGE)
        return
      }
      patch({
        ...addressPlacePatch(side, place),
        [`${side}Lng`]: place.lng,
        [`${side}Lat`]: place.lat,
      })
      setQuery('')
      setResults([])
      setManual(false)
      setEditing(false)
    } catch {
      setNotice(EMPTY_MESSAGE)
    } finally {
      setSearching(false)
    }
  }

  function saveManual() {
    const house = manualHouse.trim()
    const line = manualLine.trim()
    const postcode = manualPostcode.trim()
    const composed = [house && line && !line.toLowerCase().startsWith(house.toLowerCase()) ? `${house} ${line}` : line || house, postcode]
      .filter(Boolean)
      .join(', ')
    if (composed.length < 8) {
      setNotice('Enter the house number, street and postcode.')
      return
    }
    patch({
      ...emptyAddressPlacePatch(side),
      [`${side}Address`]: composed,
      [`${side}HouseNumber`]: house,
      [`${side}Street`]: line,
      [`${side}Postcode`]: postcode,
      [`${side}Lng`]: null,
      [`${side}Lat`]: null,
    })
    setManual(false)
    setNotice('')
  }

  return (
    <div className="mt-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Search address or postcode</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setNotice('')
              setResults([])
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
            placeholder="Search address or postcode"
            className={`${inputClass} pl-9 pr-10`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Search address"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </span>
      </label>

      {results.length > 0 ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg" role="listbox">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-800 last:border-b-0 hover:bg-slate-50"
              onClick={() => void choose(item)}
            >
              {resultText(item)}
            </button>
          ))}
        </div>
      ) : null}

      {address && !manual ? (
        <div className={`mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 ${confirmed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          {confirmed ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
          {editing ? (
            <input
              value={address}
              onChange={(e) => patch({ [`${side}Address`]: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
              aria-label={`${side} address`}
            />
          ) : (
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900">{address}</p>
          )}
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
            aria-label="Edit address"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {manual ? (
        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">Enter the address manually</p>
          <input value={manualHouse} onChange={(e) => setManualHouse(e.target.value)} className={inputClass} placeholder="House number" />
          <input value={manualLine} onChange={(e) => setManualLine(e.target.value)} className={inputClass} placeholder="Street and town" />
          <input value={manualPostcode} onChange={(e) => setManualPostcode(e.target.value)} className={inputClass} placeholder="Postcode" />
          <button type="button" onClick={saveManual} className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline">
            Use this address
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-2 text-xs text-slate-600" role="status">
          {notice}{' '}
          <button type="button" className="font-semibold text-blue-700 underline-offset-2 hover:underline" onClick={() => setManual(true)}>
            Enter it manually
          </button>
        </p>
      ) : (
        <button type="button" className="mt-2 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline" onClick={() => setManual((open) => !open)}>
          {manual ? 'Search for an address' : 'Enter address manually'}
        </button>
      )}
    </div>
  )
}

function resultText(item) {
  if (item.place?.formattedAddress) return item.place.formattedAddress
  if (item.label) return item.label
  if (item.main) return [item.door, item.main, item.secondary].filter(Boolean).join(', ')
  const prediction = item.prediction
  return [prediction?.mainText?.text, prediction?.secondaryText?.text].filter(Boolean).join(', ') || 'Address'
}

function replaceLeadingHouseNumber(address, previousHouse, nextHouse) {
  const current = String(address || '').trim()
  const prev = String(previousHouse || '').trim()
  const next = String(nextHouse || '').trim()
  if (prev && current.toLowerCase().startsWith(prev.toLowerCase())) {
    return `${next}${current.slice(prev.length)}`.replace(/\s+,/g, ',').trim()
  }
  if (next && current && !current.toLowerCase().startsWith(next.toLowerCase())) return `${next} ${current}`
  return next || current
}
