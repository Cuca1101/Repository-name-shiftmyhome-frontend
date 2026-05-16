import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { searchGeocodingSuggestions } from '../../lib/mapboxRouteApi'

const inputClass =
  'min-h-[44px] w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:min-h-[48px] sm:px-4'

/**
 * Mapbox Geocoding autocomplete. Saves full address text + lng/lat when user picks a suggestion.
 *
 * @param {{
 *   label: React.ReactNode,
 *   markerLetter: string,
 *   markerClassName: string,
 *   placeholder?: string,
 *   address: string,
 *   lng: number | null,
 *   lat: number | null,
 *   addressKey: string,
 *   lngKey: string,
 *   latKey: string,
 *   data: object,
 *   onChange: (next: object) => void,
 * }} props
 */
export default function MapboxAddressField({
  label,
  markerLetter,
  markerClassName,
  placeholder = 'Start typing street, postcode, or city',
  address,
  lng,
  lat,
  addressKey,
  lngKey,
  latKey,
  data,
  onChange,
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(0)

  const selectedFromList = lng != null && lat != null

  const applyPatch = useCallback(
    (patch) => {
      onChange({ ...data, ...patch })
    },
    [data, onChange],
  )

  const handleInputChange = (e) => {
    const v = e.target.value
    applyPatch({
      [addressKey]: v,
      [lngKey]: null,
      [latKey]: null,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!token || !address?.trim() || address.trim().length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }

    window.clearTimeout(debounceRef.current)
    setSearching(true)

    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchGeocodingSuggestions(address, token)
        if (!rootRef.current) return
        setSuggestions(results)
        setOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(debounceRef.current)
  }, [address, token])

  useEffect(() => {
    function handlePointerDown(ev) {
      if (!rootRef.current?.contains(ev.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  const pickSuggestion = (s) => {
    applyPatch({
      [addressKey]: s.placeName,
      [lngKey]: s.lng,
      [latKey]: s.lat,
    })
    setSuggestions([])
    setOpen(false)
  }

  if (!token) {
    return null
  }

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${open && suggestions.length > 0 ? 'z-20' : 'z-0'}`}
    >
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        <span className="inline-flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${markerClassName}`}
          >
            {markerLetter}
          </span>
          {label}
        </span>
      </label>
      <div className="relative">
        <input
          id={addressKey}
          type="text"
          name={addressKey}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          value={address}
          onChange={handleInputChange}
          onFocus={() => (address || '').trim().length >= 2 && suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-100"
          >
            {suggestions.map((s) => (
              <li key={s.id} role="option">
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  {s.placeName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {searching && (
        <p className="mt-2 text-xs font-medium text-brand-600" aria-live="polite">
          Searching address...
        </p>
      )}

      {!searching && selectedFromList && (
        <p className="mt-1.5 text-xs text-emerald-700">Location saved from suggestions.</p>
      )}
    </div>
  )
}
