import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  GOOGLE_ADDRESS_MIN_QUERY,
  createAddressSessionToken,
  hasGoogleMapsKey,
  placeFromPrediction,
  suggestUkAddresses,
} from '../../lib/googlePlaces'

const SEARCH_DEBOUNCE_MS = 300
const GOOGLE_ATTRIBUTION_SRC =
  'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png'

/**
 * Plain address input with Google Places suggestions.
 * If Places is unavailable, the customer can still type and submit the address.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   value: string,
 *   placeholder?: string,
 *   className?: string,
 *   required?: boolean,
 *   onValueChange: (value: string) => void,
 *   onPlace: (place: import('../../lib/googlePlaces.js').parseGooglePlace extends never ? never : ReturnType<typeof import('../../lib/googlePlaces.js').parseGooglePlace>) => void,
 * }} props
 */
export default function GoogleAddressInput({
  id,
  name,
  value,
  placeholder,
  className,
  required = false,
  onValueChange,
  onPlace,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const sessionRef = useRef(null)
  const requestRef = useRef(0)
  const pickingRef = useRef(false)
  const lockedValueRef = useRef('')
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [note, setNote] = useState('')

  const enabled = hasGoogleMapsKey()

  const ensureSession = useCallback(async () => {
    if (!sessionRef.current) sessionRef.current = await createAddressSessionToken()
    return sessionRef.current
  }, [])

  useEffect(() => {
    const query = String(value || '').trim()
    if (query && query === lockedValueRef.current) {
      setSuggestions([])
      setSearching(false)
      setOpen(false)
      return undefined
    }
    if (!enabled || query.length < GOOGLE_ADDRESS_MIN_QUERY) {
      setSuggestions([])
      setSearching(false)
      if (query.length < GOOGLE_ADDRESS_MIN_QUERY) setOpen(false)
      return undefined
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const token = await ensureSession()
        if (requestRef.current !== requestId) return
        const results = await suggestUkAddresses(query, token)
        if (requestRef.current !== requestId) return
        setSuggestions(results)
        setOpen(true)
        setNote(results.length === 0 ? 'No matching addresses. You can keep what you typed.' : '')
      } catch {
        if (requestRef.current !== requestId) return
        setSuggestions([])
        setOpen(false)
        setNote('Address search is unavailable. You can type the full address.')
      } finally {
        if (requestRef.current === requestId) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [value, enabled, ensureSession])

  useEffect(() => {
    function onPointerDown(event) {
      if (pickingRef.current) return
      if (rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  async function pick(item) {
    pickingRef.current = true
    setSearching(true)
    try {
      const place = await placeFromPrediction(item.prediction)
      sessionRef.current = null
      if (place.formattedAddress) {
        lockedValueRef.current = place.formattedAddress
        onPlace(place)
        setNote('')
      } else {
        setNote('Address search is unavailable. You can type the full address.')
      }
      setSuggestions([])
      setOpen(false)
    } catch {
      sessionRef.current = null
      setNote('Address search is unavailable. You can type the full address.')
    } finally {
      setSearching(false)
      window.setTimeout(() => {
        pickingRef.current = false
      }, 0)
    }
  }

  const showList = open && (searching || suggestions.length > 0)

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        required={required}
        autoComplete="off"
        spellCheck={false}
        className={className}
        placeholder={placeholder}
        value={value}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        role="combobox"
        onChange={(e) => {
          if (lockedValueRef.current) {
            lockedValueRef.current = ''
            sessionRef.current = null
          }
          setNote('')
          onValueChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (String(value || '').trim().length >= GOOGLE_ADDRESS_MIN_QUERY) setOpen(true)
        }}
      />
      {note ? (
        <p className="mt-1 text-xs text-slate-600" aria-live="polite">
          {note}
        </p>
      ) : null}
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {searching ? (
            <p className="px-3 py-2 text-sm font-medium text-brand-600">Searching address...</p>
          ) : (
            suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                className="block w-full px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                onPointerDown={(e) => {
                  e.preventDefault()
                  void pick(item)
                }}
              >
                {item.label}
              </button>
            ))
          )}
          <div className="flex justify-end border-t border-slate-100 px-3 py-1.5">
            <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
