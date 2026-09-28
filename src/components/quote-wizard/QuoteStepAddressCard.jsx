import { useRef, useState } from 'react'
import { Check, Loader2, MapPin, Search } from 'lucide-react'
import {
  addressPlacePatch,
  createAddressSessionToken,
  emptyAddressPlacePatch,
  findUkAddressByText,
  hasGoogleMapsKey,
  isUkPostcodeQuery,
  placeFromPrediction,
  suggestUkAddresses,
} from '../../lib/googlePlaces'
import { hasIdealPostcodesKey, lookupUkPostcode } from '../../lib/idealPostcodes'
import { hasSnapPostcodeLookup, lookupSnapPostcode, suggestSnapAddresses } from '../../lib/snapAddress'
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

function suggestionLines(item, typedDoor) {
  const prediction = item?.prediction
  let main = prediction?.mainText?.text || item?.label || ''
  let secondary = prediction?.secondaryText?.text || ''
  if (!/\d/.test(main) && /\d/.test(secondary)) {
    const swap = main
    main = secondary
    secondary = swap
  }
  const typed = String(typedDoor || '').trim()
  if (typed && !new RegExp(`^${typed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(main)) {
    main = `${typed} ${main}`
  }
  const doorMatch = main.match(/^(\d+\s*[A-Za-z]?(?:\s*\/\s*\d+\s*[A-Za-z]?)?)\s+(.+)$/)
  return {
    door: doorMatch?.[1]?.replace(/\s+/g, '') || '',
    main: doorMatch?.[2] || main,
    secondary,
  }
}

/**
 * Customer quote Step 1 address card. Search runs on the button or Enter.
 *
 * @param {{
 *   tone: 'pickup' | 'delivery',
 *   title: string,
 *   helper: string,
 *   placeholder: string,
 *   address: string,
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
}) {
  const prefix = addressPrefix(addressKey)
  const [accepted, setAccepted] = useState(() => lng != null && lat != null)
  const selected = (lng != null && lat != null) || (accepted && Boolean(String(address || '').trim()))
  const doorList = hasSnapPostcodeLookup() || hasIdealPostcodesKey()
  const [query, setQuery] = useState(() => (selected ? '' : address || ''))
  const [manual, setManual] = useState(false)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [notice, setNotice] = useState('')
  const [door, setDoor] = useState('')
  const [street, setStreet] = useState('')
  const sessionRef = useRef(null)
  const requestRef = useRef(0)

  const isPickup = tone === 'pickup'
  const accent = isPickup ? 'text-blue-700' : 'text-emerald-700'
  const iconWrap = isPickup ? 'bg-blue-600' : 'bg-emerald-600'
  const focusRing = isPickup
    ? 'focus:border-blue-500 focus:ring-blue-500/25'
    : 'focus:border-emerald-500 focus:ring-emerald-500/25'
  const buttonClass = isPickup
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
    })
  }

  const postcodeOnly = isUkPostcodeQuery(query)

  function searchText() {
    const typed = query.trim()
    if (!postcodeOnly) return typed
    const doorText = door.trim()
    const streetText = street.trim()
    if (!doorText || streetText.length < 2) return ''
    return `${doorText} ${streetText}, ${typed}`
  }

  async function runSearch() {
    const typed = query.trim()
    setNotice('')
    setOpen(false)
    if (hasSnapPostcodeLookup() && typed.length >= 2) {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setSearching(true)
      try {
        let list = []
        try {
          list = postcodeOnly ? await lookupSnapPostcode(typed) : await suggestSnapAddresses(typed)
        } catch {
          list = postcodeOnly && hasIdealPostcodesKey() ? await lookupUkPostcode(typed) : []
        }
        if (!postcodeOnly && list.length === 0) {
          if (requestRef.current === requestId) setSearching(false)
        } else {
          if (requestRef.current !== requestId) return
          setResults(list)
          setNotice(list.length ? '' : EMPTY_MESSAGE)
          setOpen(list.length > 0)
          if (requestRef.current === requestId) setSearching(false)
          return
        }
      } catch {
        if (requestRef.current !== requestId) return
        if (postcodeOnly) {
          setResults([])
          setNotice(EMPTY_MESSAGE)
          setSearching(false)
          return
        }
        setSearching(false)
      }
    }

    if (postcodeOnly && hasIdealPostcodesKey()) {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setSearching(true)
      try {
        const list = await lookupUkPostcode(typed)
        if (requestRef.current !== requestId) return
        setResults(list)
        setNotice(list.length ? '' : EMPTY_MESSAGE)
        setOpen(list.length > 0)
      } catch {
        if (requestRef.current !== requestId) return
        setResults([])
        setNotice(EMPTY_MESSAGE)
      } finally {
        if (requestRef.current === requestId) setSearching(false)
      }
      return
    }

    const text = searchText()
    if (postcodeOnly && !text) {
      setResults([])
      setNotice('Enter the house number and street for this postcode.')
      return
    }
    if (!hasGoogleMapsKey() || text.length < 3) {
      setResults([])
      setNotice(EMPTY_MESSAGE)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setSearching(true)
    try {
      sessionRef.current = await createAddressSessionToken()
      const list = await suggestUkAddresses(text, sessionRef.current)
      if (requestRef.current !== requestId) return
      setResults(list)
      if (list.length === 0) {
        setNotice(EMPTY_MESSAGE)
        setOpen(false)
      } else {
        setOpen(true)
      }
    } catch {
      if (requestRef.current !== requestId) return
      setResults([])
      setNotice(EMPTY_MESSAGE)
    } finally {
      if (requestRef.current === requestId) setSearching(false)
    }
  }

  function applyPlace(place, keepFormatted) {
    if (!place.formattedAddress || ((place.lng == null || place.lat == null) && !keepFormatted)) {
      setNotice(EMPTY_MESSAGE)
      return false
    }
    setAccepted(true)
    patch({
      ...addressPlacePatch(
        prefix,
        place,
        keepFormatted ? { keepTypedAddress: true, typedAddress: place.formattedAddress } : undefined,
      ),
      [lngKey]: place.lng,
      [latKey]: place.lat,
      [confirmedKey]: true,
    })
    setQuery('')
    setDoor('')
    setStreet('')
    setResults([])
    setOpen(false)
    setManual(false)
    onAddressSelected?.()
    return true
  }

  async function choose(item) {
    setSearching(true)
    setNotice('')
    try {
      if (item.source === 'snap-group' && item.postcode) {
        const list = await lookupSnapPostcode(item.postcode)
        setResults(list)
        setNotice(list.length ? '' : EMPTY_MESSAGE)
        setOpen(list.length > 0)
        return
      }
      if (item.source === 'ideal' || item.source === 'snap') {
        sessionRef.current = null
        let place = item.place
        if (place.lng == null || place.lat == null) {
          const hit = await findUkAddressByText(place.formattedAddress)
          if (hit?.lng != null && hit?.lat != null) {
            place = { ...place, lng: hit.lng, lat: hit.lat }
          }
        }
        applyPlace(place, true)
        return
      }
      const place = await placeFromPrediction(item.prediction)
      if (!place.houseNumber && !place.subpremise) {
        const typedDoor = suggestionLines(item, postcodeOnly ? door : '').door
        if (typedDoor) place.houseNumber = typedDoor
      }
      sessionRef.current = null
      applyPlace(place, false)
    } catch {
      sessionRef.current = null
      setNotice(EMPTY_MESSAGE)
    } finally {
      setSearching(false)
    }
  }

  function startChange() {
    setQuery(address || '')
    setManual(false)
    setNotice('')
    setResults([])
    setOpen(false)
    clearSelection(address || '')
  }

  function startManual() {
    setManual(true)
    setOpen(false)
    setResults([])
    setNotice('')
    setQuery(address || query)
    if (selected) clearSelection(address || '')
  }

  const quoteField = addressKey === 'pickupAddress' ? 'pickup-address' : 'delivery-address'
  const control =
    'box-border h-[52px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:ring-2'
  const panelClass = quotePage
    ? isPickup
      ? 'border-blue-100 bg-[#eef5ff]'
      : 'border-emerald-100 bg-[#eefaf3]'
    : 'border-slate-200 bg-white shadow-sm'

  function resultLabel(item) {
    if (item.source === 'snap-group') return item.secondary ? `${item.main} (${item.secondary})` : item.main
    if (item.source === 'snap') return item.place?.formattedAddress || item.main
    if (item.source === 'ideal') return [item.door, item.main, item.secondary].filter(Boolean).join(', ')
    const lines = suggestionLines(item, postcodeOnly ? door : '')
    return [lines.door, lines.main, lines.secondary].filter(Boolean).join(', ')
  }

  return (
    <section
      data-quote-field={quoteField}
      className={`rounded-2xl border p-4 ${panelClass}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${iconWrap}`}>
          <MapPin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className={`text-sm font-semibold leading-tight ${accent}`}>{title}</h3>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{helper}</p>
        </div>
      </div>

      {selected && !manual ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-slate-900">{address}</p>
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
          value={address}
          onChange={(e) => clearSelection(e.target.value)}
          placeholder={placeholder}
          className={`${control} mt-3 h-auto min-h-[52px] resize-none py-3 ${focusRing}`}
        />
      ) : (
        <div className="relative mt-3">
          <div className="flex flex-col gap-2">
            <input
              id={addressKey}
              type="text"
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              aria-expanded={open}
              className={`${control} ${focusRing}`}
              onChange={(e) => {
                setQuery(e.target.value)
                setNotice('')
                setOpen(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void runSearch()
                }
              }}
            />
            {postcodeOnly && !doorList ? (
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <input
                  type="text"
                  value={door}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="No."
                  aria-label="House number"
                  className={`${control} ${focusRing}`}
                  onChange={(e) => {
                    setDoor(e.target.value)
                    setNotice('')
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void runSearch()
                    }
                  }}
                />
                <input
                  type="text"
                  value={street}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Street"
                  aria-label="Street"
                  className={`${control} ${focusRing}`}
                  onChange={(e) => {
                    setStreet(e.target.value)
                    setNotice('')
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void runSearch()
                    }
                  }}
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={searching}
              onClick={() => void runSearch()}
              className={`inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70 ${quotePage ? 'rounded-xl' : 'rounded-2xl'} ${buttonClass}`}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : quotePage ? <Search className="h-4 w-4" aria-hidden /> : null}
              Find my address
            </button>
          </div>

          {quotePage ? (
            <>
              <select
                id={`${addressKey}-results`}
                aria-label="Select your address"
                disabled={searching || results.length === 0}
                value=""
                onChange={(e) => {
                  const item = results.find((entry) => entry.id === e.target.value)
                  if (item) void choose(item)
                }}
                className={`${control} mt-2 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-400 ${focusRing}`}
              >
                <option value="">Select your address</option>
                {results.map((item) => (
                  <option key={item.id} value={item.id}>
                    {resultLabel(item)}
                  </option>
                ))}
              </select>
              {results.length > 0 ? (
                <div className="mt-1 flex justify-end">
                  {results[0]?.source === 'ideal' || results[0]?.source === 'snap' || results[0]?.source === 'snap-group' ? (
                    <span className="text-[10px] leading-none text-slate-400">© Royal Mail</span>
                  ) : (
                    <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {!quotePage && open && results.length > 0 ? (
            <div
              role="listbox"
              className="z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg"
            >
              {results.map((item) => {
                const lines =
                  item.source === 'snap'
                    ? { ...item, door: '' }
                    : item.source === 'ideal' || item.source === 'snap-group'
                      ? item
                      : suggestionLines(item, postcodeOnly ? door : '')
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    className="flex w-full items-start gap-2 border-b border-slate-100 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                    onClick={() => void choose(item)}
                  >
                    {lines.door ? (
                      <span className="w-10 shrink-0 text-base font-semibold leading-snug text-slate-900">{lines.door}</span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug text-slate-900">{lines.main}</span>
                      {lines.secondary ? (
                        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{lines.secondary}</span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
              <div className="flex justify-end border-t border-slate-100 bg-white px-3 py-1.5">
                {results[0]?.source === 'ideal' || results[0]?.source === 'snap' || results[0]?.source === 'snap-group' ? (
                  <span className="text-[10px] leading-none text-slate-400">© Royal Mail</span>
                ) : (
                  <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
                )}
              </div>
            </div>
          ) : null}

          {notice ? (
            <p className="mt-2 text-xs leading-snug text-slate-600" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      )}

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

      <button
        type="button"
        onClick={manual ? () => setManual(false) : startManual}
        className={`mt-2 text-sm font-medium underline-offset-2 hover:underline ${
          quotePage ? 'text-blue-600 hover:text-blue-800' : 'text-xs font-semibold text-slate-500 hover:text-slate-800'
        }`}
      >
        {manual ? 'Search for an address' : 'Enter address manually'}
      </button>
    </section>
  )
}
