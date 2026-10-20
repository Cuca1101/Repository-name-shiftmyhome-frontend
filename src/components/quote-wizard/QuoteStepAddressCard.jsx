import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, MapPin, Search } from 'lucide-react'
import { MIN_MANUAL_ADDRESS_LENGTH } from '../../lib/addressConfirmation'
import {
  ADDRESS_SEARCH_PAUSE_MS,
  GOOGLE_ADDRESS_MIN_QUERY,
  addressPlacePatch,
  createAddressSessionToken,
  emptyAddressPlacePatch,
  findUkAddressByText,
  hasGoogleMapsKey,
  placeFromPrediction,
  suggestUkPlaces,
} from '../../lib/googlePlaces'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']

const GOOGLE_ATTRIBUTION_SRC =
  'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png'

const EMPTY_MESSAGE = "We couldn't find that address. Try again or enter it manually."

/**
 * @param {string} addressKey
 * @returns {'pickup' | 'delivery'}
 */
function addressPrefix(addressKey) {
  return String(addressKey).startsWith('delivery') ? 'delivery' : 'pickup'
}

function suggestionLines(item) {
  const prediction = item?.prediction
  const main = prediction?.mainText?.text || item?.label || ''
  const secondary = prediction?.secondaryText?.text || ''
  return { main, secondary }
}

function composeAddressWithApartment(base, apartment) {
  const flat = String(apartment || '').trim()
  const line = String(base || '').trim()
  if (!flat) return line
  const prefix = `${flat}, `
  if (line.toLowerCase().startsWith(prefix.toLowerCase())) return line
  return `${flat}, ${line}`
}

function addressWithoutApartment(line, apartment) {
  const flat = String(apartment || '').trim()
  const text = String(line || '').trim()
  if (!flat) return text
  const prefix = `${flat}, `
  if (text.toLowerCase().startsWith(prefix.toLowerCase())) return text.slice(prefix.length).trim()
  return text
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripLeadingHouseNumber(line, houseNumber) {
  const text = String(line || '').trim()
  const door = String(houseNumber || '').trim()
  if (!door || !text) return text
  const pattern = new RegExp(`^${escapeRegExp(door)}(?=\\s|,|$)`, 'i')
  return pattern.test(text) ? text.replace(pattern, '').replace(/^[, ]+/, '').trim() : text
}

function composeStreetAddress(base, houseNumber) {
  const door = String(houseNumber || '').trim()
  const line = String(base || '').trim()
  if (!door) return line
  if (!line) return door
  const pattern = new RegExp(`^${escapeRegExp(door)}(?=\\s|,|$)`, 'i')
  if (pattern.test(line)) return line
  return `${door} ${line}`
}

function placeStreetLine(place) {
  const formatted = String(place?.formattedAddress || '')
    .replace(/,\s*(United Kingdom|UK)\s*$/i, '')
    .trim()
  const locality = [place?.town, place?.postcode].filter(Boolean).join(' ')
  const street = String(place?.street || '').trim()
  const fromStreet = street ? [street, locality].filter(Boolean).join(', ') : ''
  const formattedHasStreet = Boolean(street) && formatted.toLowerCase().includes(street.toLowerCase())
  if (formattedHasStreet) return stripLeadingHouseNumber(formatted, place?.houseNumber)
  if (fromStreet) return fromStreet
  return stripLeadingHouseNumber(formatted, place?.houseNumber)
}

function addressBase(address, apartment, houseNumber) {
  return stripLeadingHouseNumber(addressWithoutApartment(address, apartment), houseNumber)
}

/**
 * Collection and delivery address card for the website quote and Admin phone booking.
 * Suggestions come from Google Places Autocomplete (New), limited to the UK.
 *
 * @param {{
 *   tone: 'pickup' | 'delivery',
 *   title: string,
 *   helper: string,
 *   placeholder: string,
 *   address: string,
 *   houseNumber?: string,
 *   apartment?: string,
 *   lng: number | null,
 *   lat: number | null,
 *   addressKey: string,
 *   lngKey: string,
 *   latKey: string,
 *   confirmedKey: string,
 *   propertyValue: string,
 *   onChange: (next: object) => void,
 *   onPropertyChange: (value: string) => void,
 *   onAddressSelected?: () => void,
 *   propertySelectId?: string,
 *   quotePage?: boolean,
 * }} props
 */
export default function QuoteStepAddressCard({
  tone,
  title,
  helper,
  placeholder,
  address,
  houseNumber = '',
  apartment = '',
  lng,
  lat,
  addressKey,
  lngKey,
  latKey,
  confirmedKey,
  propertyValue,
  onChange,
  onPropertyChange,
  onAddressSelected,
  propertySelectId,
  quotePage = false,
  children = null,
}) {
  const prefix = addressPrefix(addressKey)
  const [accepted, setAccepted] = useState(() => lng != null && lat != null)
  const selected = (lng != null && lat != null) || (accepted && Boolean(String(address || '').trim()))
  const [query, setQuery] = useState(() => (selected ? '' : addressBase(address, apartment, houseNumber)))
  const [manual, setManual] = useState(false)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [notice, setNotice] = useState('')
  const sessionRef = useRef(null)
  const requestRef = useRef(0)
  const lastQueryRef = useRef('')
  const resultsRef = useRef([])
  const timerRef = useRef(0)
  const inputRef = useRef(null)
  const menuRef = useRef(null)
  const baseAddressRef = useRef(addressBase(address, apartment, houseNumber))
  const manualGeocodeRef = useRef(0)
  resultsRef.current = results

  const isPickup = tone === 'pickup'
  const accent = quotePage ? 'text-slate-900' : isPickup ? 'text-blue-700' : 'text-emerald-700'
  const iconWrap = quotePage
    ? 'bg-blue-50 text-blue-600'
    : isPickup
      ? 'bg-blue-600 text-white'
      : 'bg-emerald-600 text-white'
  const focusRing = quotePage || isPickup
    ? 'focus:border-blue-500 focus:ring-blue-500/25'
    : 'focus:border-emerald-500 focus:ring-emerald-500/25'
  const buttonClass = quotePage || isPickup
    ? 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500/30'
    : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30'

  function patch(next) {
    applyWizardPatch(onChange, next)
  }

  function clearSelection(nextAddress) {
    setAccepted(false)
    patch({
      [addressKey]: nextAddress,
      [lngKey]: null,
      [latKey]: null,
      [confirmedKey]: false,
      ...emptyAddressPlacePatch(prefix),
      [`${prefix}HouseNumber`]: houseNumber,
      [`${prefix}Apartment`]: apartment,
    })
  }

  function composedAddress(base, door = houseNumber, flat = apartment) {
    return composeAddressWithApartment(composeStreetAddress(base, door), flat)
  }

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!open || results.length === 0) return undefined
    function onPointerDown(event) {
      if (menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, results.length])

  async function ensureSession() {
    if (!sessionRef.current) sessionRef.current = await createAddressSessionToken()
    return sessionRef.current
  }

  function endSession() {
    sessionRef.current = null
  }

  function typedQuery() {
    return String(inputRef.current?.value ?? query).trim()
  }

  function findAddress(typed) {
    const text = String(typed ?? typedQuery()).trim()
    window.clearTimeout(timerRef.current)
    inputRef.current?.blur()
    if (text.length < GOOGLE_ADDRESS_MIN_QUERY) {
      setResults([])
      setOpen(false)
      setSearching(false)
      setNotice('Type a postcode or street, then press Find my address.')
      return
    }
    void runGoogleSearch(text)
  }

  async function runGoogleSearch(typed) {
    const text = String(typed || '').trim()
    if (!hasGoogleMapsKey() || text.length < GOOGLE_ADDRESS_MIN_QUERY) {
      setResults([])
      setOpen(false)
      setSearching(false)
      setNotice('Type a postcode or street, then press Find my address.')
      return
    }
    if (text === lastQueryRef.current && resultsRef.current.length > 0) {
      setOpen(true)
      setSearching(false)
      return
    }
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setSearching(true)
    try {
      const token = await ensureSession()
      if (requestRef.current !== requestId) return
      const list = await suggestUkPlaces(text, token)
      if (requestRef.current !== requestId) return
      lastQueryRef.current = text
      setResults(list)
      setOpen(list.length > 0)
      setNotice(list.length ? '' : EMPTY_MESSAGE)
    } catch {
      if (requestRef.current !== requestId) return
      endSession()
      setResults([])
      setNotice('Address search is unavailable. You can type the full address.')
    } finally {
      if (requestRef.current === requestId) setSearching(false)
    }
  }

  function scheduleSearch(text) {
    window.clearTimeout(timerRef.current)
    requestRef.current += 1
    const trimmed = String(text || '').trim()
    if (trimmed.length < GOOGLE_ADDRESS_MIN_QUERY) {
      lastQueryRef.current = ''
      setResults([])
      setOpen(false)
      setSearching(false)
      setNotice('')
      return
    }
    if (trimmed === lastQueryRef.current && resultsRef.current.length > 0) {
      setOpen(true)
      return
    }
    timerRef.current = window.setTimeout(() => {
      void runGoogleSearch(trimmed)
    }, ADDRESS_SEARCH_PAUSE_MS)
  }

  function applyPlace(place) {
    const base = placeStreetLine(place)
    if (!base || place.lng == null || place.lat == null) {
      setNotice(EMPTY_MESSAGE)
      return false
    }
    const door = place.houseNumber || houseNumber
    const flat = String(apartment || '').trim() || place.subpremise || ''
    const line = composedAddress(base, door, flat)
    baseAddressRef.current = base
    setAccepted(true)
    patch({
      ...addressPlacePatch(prefix, place, { keepTypedAddress: true, typedAddress: line }),
      [addressKey]: line,
      [`${prefix}HouseNumber`]: door,
      [`${prefix}Apartment`]: flat,
      [lngKey]: place.lng,
      [latKey]: place.lat,
      [confirmedKey]: true,
    })
    setQuery('')
    setResults([])
    setOpen(false)
    setManual(false)
    setNotice('')
    lastQueryRef.current = ''
    onAddressSelected?.()
    return true
  }

  async function choose(item) {
    window.clearTimeout(timerRef.current)
    setSearching(true)
    setNotice('')
    try {
      const place = await placeFromPrediction(item.prediction)
      endSession()
      applyPlace(place)
    } catch {
      endSession()
      setNotice(EMPTY_MESSAGE)
    } finally {
      setSearching(false)
    }
  }

  function currentBase() {
    return baseAddressRef.current || addressBase(address, apartment, houseNumber)
  }

  function setHouseNumber(value) {
    const base = currentBase()
    baseAddressRef.current = base
    patch({
      [`${prefix}HouseNumber`]: value,
      [addressKey]: composedAddress(base, value, apartment),
    })
  }

  function setApartment(value) {
    const base = currentBase()
    baseAddressRef.current = base
    patch({
      [`${prefix}Apartment`]: value,
      [addressKey]: composedAddress(base, houseNumber, value),
    })
  }

  function startChange() {
    const base = currentBase()
    baseAddressRef.current = base
    endSession()
    lastQueryRef.current = ''
    setQuery(base)
    setManual(false)
    setNotice('')
    setResults([])
    setOpen(false)
    clearSelection(composedAddress(base))
  }

  function startManual() {
    const base = currentBase()
    baseAddressRef.current = base
    endSession()
    lastQueryRef.current = ''
    setManual(true)
    setOpen(false)
    setResults([])
    setNotice('')
    setQuery(base)
    if (selected) clearSelection(composedAddress(base))
  }

  async function geocodeManual(base) {
    const text = composeStreetAddress(String(base || '').trim(), houseNumber)
    if (!hasGoogleMapsKey() || text.length < MIN_MANUAL_ADDRESS_LENGTH) return
    const requestId = manualGeocodeRef.current + 1
    manualGeocodeRef.current = requestId
    try {
      const place = await findUkAddressByText(text)
      if (manualGeocodeRef.current !== requestId || !place || place.lng == null || place.lat == null) return
      const door = place.houseNumber || houseNumber
      const flat = String(apartment || '').trim() || place.subpremise || ''
      const line = composedAddress(baseAddressRef.current || text, door, flat)
      setAccepted(true)
      patch({
        ...addressPlacePatch(prefix, place, { keepTypedAddress: true, typedAddress: line }),
        [addressKey]: line,
        [`${prefix}HouseNumber`]: door,
        [`${prefix}Apartment`]: flat,
        [lngKey]: place.lng,
        [latKey]: place.lat,
        [confirmedKey]: true,
      })
    } catch {
      /* The typed address stays. The map updates when coordinates are found. */
    }
  }

  const quoteField = addressKey === 'pickupAddress' ? 'pickup-address' : 'delivery-address'
  const control =
    'box-border h-[52px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:ring-2'
  const panelClass = 'border-slate-200 bg-white shadow-sm'
  const shownAddress = composedAddress(currentBase()) || address
  const houseNumberMissing = selected && !String(houseNumber || '').trim()
  const houseNumberErrorId = `${addressKey}-house-number-error`
  const houseControl = houseNumberMissing
    ? 'box-border h-[52px] w-full min-w-0 rounded-xl border border-red-500 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/25'
    : `${control} ${focusRing}`

  const numberFields = (
    <div className="mt-3 grid grid-cols-2 items-start gap-2">
      <div className="min-w-0">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium leading-snug text-slate-600">House number</span>
          <input
            type="text"
            value={houseNumber}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 12"
            aria-label="House number"
            aria-invalid={houseNumberMissing || undefined}
            aria-describedby={houseNumberMissing ? houseNumberErrorId : undefined}
            className={houseControl}
            onChange={(e) => setHouseNumber(e.target.value)}
          />
        </label>
        {houseNumberMissing ? (
          <p id={houseNumberErrorId} className="mt-1 text-xs font-medium text-red-600" role="alert">
            Select a number
          </p>
        ) : null}
      </div>
      <label className="min-w-0">
        <span className="mb-1.5 block text-xs font-medium leading-snug text-slate-600">Flat / Apartment (optional)</span>
        <input
          type="text"
          value={apartment}
          autoComplete="off"
          spellCheck={false}
          placeholder="Optional"
          aria-label="Flat or apartment"
          className={`${control} ${focusRing}`}
          onChange={(e) => setApartment(e.target.value)}
        />
      </label>
    </div>
  )

  return (
    <section
      data-quote-field={quoteField}
      className={`quote-address-card min-w-0 rounded-2xl border p-4 ${panelClass}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <MapPin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className={`text-base font-bold leading-tight ${accent}`}>{title}</h3>
          {helper ? <p className="mt-0.5 text-xs leading-snug text-slate-500">{helper}</p> : null}
        </div>
      </div>

      {selected && !manual ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-slate-900">{shownAddress}</p>
            <button
              type="button"
              onClick={startChange}
              className="mt-1 text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              Change
            </button>
          </div>
        </div>
      ) : manual ? (
        <textarea
          id={addressKey}
          rows={2}
          value={currentBase()}
          onChange={(e) => {
            const base = e.target.value
            baseAddressRef.current = base
            clearSelection(composedAddress(base))
          }}
          onBlur={() => {
            if (lng == null || lat == null) void geocodeManual(baseAddressRef.current)
          }}
          placeholder={placeholder}
          className={`${control} mt-3 h-auto min-h-[52px] resize-none py-3 ${focusRing}`}
        />
      ) : (
        <div className="relative mt-3">
          {quotePage ? (
            <span className="mb-1 block text-xs font-medium text-slate-600">Postcode, street or full address</span>
          ) : null}
          <div className="flex flex-col gap-2">
            <div className="quote-address-search flex flex-col gap-2">
            <input
              ref={inputRef}
              id={addressKey}
              type="text"
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls={`${addressKey}-results`}
              className={`${control} min-w-0 w-full ${focusRing}`}
              onChange={(e) => {
                const next = e.target.value
                setQuery(next)
                setNotice('')
                scheduleSearch(next)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  findAddress(e.currentTarget.value)
                }
              }}
            />
            <button
              type="button"
              disabled={searching}
              onClick={() => findAddress()}
              className={`quote-address-find inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70 ${quotePage ? 'rounded-xl' : 'rounded-2xl'} ${buttonClass}`}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : quotePage ? <Search className="h-4 w-4" aria-hidden /> : null}
              Find my address
            </button>
            </div>
          </div>
        </div>
      )}

      {numberFields}

      {!selected && !manual ? (
        <div ref={menuRef} className="relative mt-3">
          {quotePage ? (
            <button
              type="button"
              aria-expanded={open && results.length > 0}
              aria-controls={`${addressKey}-results`}
              onClick={() => {
                if (results.length > 0) {
                  setOpen((current) => !current)
                  return
                }
                findAddress()
              }}
              className={`${control} flex items-center justify-between gap-2 text-left text-slate-500 ${focusRing}`}
            >
              <span>Select your address</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open && results.length > 0 ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          ) : null}
          {open && results.length > 0 ? (
            <div
              id={`${addressKey}-results`}
              role="listbox"
              aria-label="Select your address"
              className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              {results.map((item) => {
                const lines = suggestionLines(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    className="block min-h-12 w-full whitespace-normal break-words border-b border-slate-100 px-3.5 py-3 text-left last:border-b-0 hover:bg-blue-50"
                    onClick={() => void choose(item)}
                  >
                    <span className="block text-sm font-semibold leading-snug text-slate-900">{lines.main}</span>
                    {lines.secondary ? (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">{lines.secondary}</span>
                    ) : null}
                  </button>
                )
              })}
              <div className="flex justify-end border-t border-slate-100 bg-white px-3 py-1.5">
                <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
              </div>
            </div>
          ) : null}
          {notice ? (
            <p className="mt-1.5 text-sm font-medium leading-snug text-red-600" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={manual ? () => setManual(false) : startManual}
        className={`mt-2 text-sm font-medium underline-offset-2 hover:underline ${
          quotePage ? 'text-blue-600 hover:text-blue-800' : 'text-xs font-semibold text-slate-500 hover:text-slate-800'
        }`}
      >
        {manual ? 'Search for an address' : 'Enter address manually'}
      </button>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Property type</span>
        <select
          id={propertySelectId}
          value={propertyValue}
          onChange={(e) => onPropertyChange(e.target.value)}
          className={`${control} ${focusRing}`}
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {children}
    </section>
  )
}
