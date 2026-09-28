import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MIN_MANUAL_ADDRESS_LENGTH } from '../../lib/addressConfirmation'
import {
  GOOGLE_ADDRESS_MIN_QUERY,
  addressPlacePatch,
  createAddressSessionToken,
  emptyAddressPlacePatch,
  findUkAddressByText,
  hasGoogleMapsKey,
  placeFromPrediction,
  suggestUkAddresses,
} from '../../lib/googlePlaces'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { useFloatingPanelBelow } from './useFloatingPanelBelow'

const inputClass =
  'box-border min-h-[38px] w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:min-h-[48px] sm:rounded-xl sm:px-4 sm:text-base'

const mobileCardInputClass =
  'box-border min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

const SEARCH_DEBOUNCE_MS = 300

const mobileSuggestionRow =
  'flex min-h-[56px] w-full min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-base text-slate-900 transition last:border-b-0 active:bg-brand-50'

const GOOGLE_ATTRIBUTION_SRC =
  'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png'

/**
 * @param {string} [nextFocusId]
 * @param {'move-date'} [nextFocusTarget]
 */
function focusNextField({ nextFocusId, nextFocusTarget }) {
  if (nextFocusId) {
    const el = document.getElementById(nextFocusId)
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: false })
      if (typeof el.select === 'function' && el.tagName === 'INPUT') {
        el.select()
      }
    }
    return
  }

  if (nextFocusTarget === 'move-date') {
    const inputs = document.querySelectorAll('[data-quote-field="move-date"] input[type="date"]')
    for (const input of inputs) {
      if (input.offsetParent !== null) {
        input.focus({ preventScroll: false })
        break
      }
    }
  }
}

/**
 * @param {string} addressKey
 * @returns {'pickup' | 'delivery'}
 */
function addressPrefix(addressKey) {
  return String(addressKey).startsWith('delivery') ? 'delivery' : 'pickup'
}

/**
 * Google Places autocomplete for pickup and delivery. Keeps the existing field layout.
 * Coordinates are written onto the wizard so Mapbox can still calculate the route.
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
 *   onChange: (next: object) => void,
 *   confirmedKey?: string,
 *   nextFocusId?: string,
 *   nextFocusTarget?: 'move-date',
 *   onAddressSelected?: () => void,
 *   variant?: 'default' | 'mobile-card',
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
  onChange,
  confirmedKey,
  nextFocusId,
  nextFocusTarget,
  onAddressSelected,
  variant = 'default',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const pickingRef = useRef(false)
  const sessionRef = useRef(null)
  const requestRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchNote, setSearchNote] = useState('')
  const debounceRef = useRef(0)
  const panelRef = useRef(null)
  const geocodeBlurRef = useRef(0)

  const selectedFromList = lng != null && lat != null
  const prefix = addressPrefix(addressKey)

  const applyPatch = useCallback(
    (patch) => {
      applyWizardPatch(onChange, patch)
    },
    [onChange],
  )

  const endSession = useCallback(() => {
    sessionRef.current = null
  }, [])

  const ensureSession = useCallback(async () => {
    if (!sessionRef.current) {
      sessionRef.current = await createAddressSessionToken()
    }
    return sessionRef.current
  }, [])

  const handleInputChange = (e) => {
    const v = e.target.value
    const patch = {
      [addressKey]: v,
      [lngKey]: null,
      [latKey]: null,
      ...emptyAddressPlacePatch(prefix),
    }
    if (confirmedKey) patch[confirmedKey] = false
    applyPatch(patch)
    setSearchNote('')
    if (selectedFromList) endSession()
    setOpen(true)
  }

  const pickSuggestion = useCallback(
    async (item) => {
      pickingRef.current = true
      setSearching(true)
      setSearchNote('')
      try {
        const place = await placeFromPrediction(item.prediction)
        endSession()
        if (!place.formattedAddress || place.lng == null || place.lat == null) {
          setSearchNote('Address search is unavailable. You can type the full address.')
          return
        }
        const patch = {
          ...addressPlacePatch(prefix, place),
          [lngKey]: place.lng,
          [latKey]: place.lat,
        }
        if (confirmedKey) patch[confirmedKey] = true
        applyPatch(patch)
        setSuggestions([])
        setOpen(false)
        window.requestAnimationFrame(() => {
          onAddressSelected?.()
          focusNextField({ nextFocusId, nextFocusTarget })
        })
      } catch {
        endSession()
        setSearchNote('Address search is unavailable. You can type the full address.')
      } finally {
        setSearching(false)
        window.setTimeout(() => {
          pickingRef.current = false
        }, 0)
      }
    },
    [prefix, lngKey, latKey, confirmedKey, applyPatch, endSession, nextFocusId, nextFocusTarget, onAddressSelected],
  )

  const geocodeManualAddress = useCallback(async () => {
    const trimmed = (address || '').trim()
    if (!hasGoogleMapsKey() || selectedFromList || trimmed.length < MIN_MANUAL_ADDRESS_LENGTH) return

    try {
      const place = await findUkAddressByText(trimmed)
      if (!place || place.lng == null || place.lat == null || !rootRef.current) return
      const patch = {
        ...addressPlacePatch(prefix, place, { keepTypedAddress: true, typedAddress: trimmed }),
        [lngKey]: place.lng,
        [latKey]: place.lat,
      }
      if (confirmedKey) patch[confirmedKey] = true
      applyPatch(patch)
      setSuggestions([])
      setOpen(false)
      onAddressSelected?.()
    } catch {
      setSearchNote('')
    }
  }, [address, selectedFromList, prefix, lngKey, latKey, confirmedKey, applyPatch, onAddressSelected])

  const handleBlur = useCallback(() => {
    window.clearTimeout(geocodeBlurRef.current)
    geocodeBlurRef.current = window.setTimeout(() => {
      void geocodeManualAddress()
    }, 200)
  }, [geocodeManualAddress])

  useEffect(() => {
    const query = (address || '').trim()
    if (!hasGoogleMapsKey() || query.length < GOOGLE_ADDRESS_MIN_QUERY) {
      setSuggestions([])
      setSearching(false)
      if (query.length < GOOGLE_ADDRESS_MIN_QUERY) setOpen(false)
      return undefined
    }

    if (selectedFromList) {
      setSearching(false)
      return undefined
    }

    window.clearTimeout(debounceRef.current)
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setSearching(true)

    debounceRef.current = window.setTimeout(async () => {
      try {
        const token = await ensureSession()
        if (requestRef.current !== requestId || !rootRef.current) return
        const results = await suggestUkAddresses(query, token)
        if (requestRef.current !== requestId || !rootRef.current) return
        setSuggestions(results)
        setOpen(true)
        setSearchNote(results.length === 0 ? 'No matching addresses. You can keep what you typed.' : '')
      } catch {
        if (requestRef.current !== requestId) return
        setSuggestions([])
        setOpen(false)
        setSearchNote('Address search is unavailable. You can type the full address.')
      } finally {
        if (requestRef.current === requestId) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(debounceRef.current)
  }, [address, selectedFromList, ensureSession])

  const isMobileCard = variant === 'mobile-card'
  const hasQuery = (address || '').trim().length >= GOOGLE_ADDRESS_MIN_QUERY
  const showDesktopList = open && (searching || suggestions.length > 0) && !isMobileCard && !selectedFromList
  const showMobileList = isMobileCard && open && !selectedFromList && hasQuery && (searching || suggestions.length > 0)
  const showSuggestionsPanel = isMobileCard ? showMobileList : showDesktopList

  const panelStyle = useFloatingPanelBelow(inputRef, showSuggestionsPanel, {
    maxHeight: 320,
    preferBelow: true,
    autoReveal: true,
    revealMode: 'panel-only',
  })

  useEffect(() => {
    function handlePointerDown(ev) {
      if (pickingRef.current) return
      if (rootRef.current?.contains(ev.target)) return
      if (panelRef.current?.contains(ev.target)) return
      setOpen(false)
    }
    function handleKey(ev) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  if (!hasGoogleMapsKey()) {
    return null
  }

  const quoteField =
    addressKey === 'pickupAddress'
      ? 'pickup-address'
      : addressKey === 'deliveryAddress'
        ? 'delivery-address'
        : undefined

  const resolvedInputClass = isMobileCard ? mobileCardInputClass : inputClass
  const labelClass = isMobileCard
    ? 'mb-1 block text-xs font-medium leading-snug text-slate-700'
    : 'mb-1 block text-xs font-medium leading-snug text-slate-700 sm:mb-1.5 sm:text-sm'

  return (
    <div ref={rootRef} data-quote-field={quoteField} className="relative box-border min-w-0 w-full">
      <label className={labelClass} htmlFor={addressKey}>
        <span className="inline-flex items-center gap-1.5 sm:gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:rounded-lg sm:text-xs ${markerClassName}`}
          >
            {markerLetter}
          </span>
          {label}
        </span>
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={addressKey}
          type="text"
          name={addressKey}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showSuggestionsPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          value={address}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={() => {
            if (!selectedFromList && (address || '').trim().length >= GOOGLE_ADDRESS_MIN_QUERY) {
              setOpen(true)
            }
          }}
          placeholder={placeholder}
          className={resolvedInputClass}
        />
      </div>
      {searching && !showSuggestionsPanel ? (
        <p className="mt-2 text-xs font-medium text-brand-600" aria-live="polite">
          Searching address...
        </p>
      ) : null}

      {!searching && selectedFromList ? (
        <p className="mt-1.5 text-xs text-emerald-700">Address verified.</p>
      ) : null}

      {!searching && searchNote ? (
        <p className="mt-1.5 text-xs text-slate-600" aria-live="polite">
          {searchNote}
        </p>
      ) : null}

      {showSuggestionsPanel && panelStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              className="quote-floating-panel"
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
              }}
            >
              {searching ? (
                <p className="px-4 py-3 text-sm font-medium text-brand-600" aria-live="polite">
                  Searching address...
                </p>
              ) : isMobileCard ? (
                suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={mobileSuggestionRow}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void pickSuggestion(s)
                    }}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${markerClassName}`}
                      aria-hidden
                    >
                      {markerLetter}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{s.label}</span>
                  </button>
                ))
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-50 active:bg-brand-50"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void pickSuggestion(s)
                    }}
                  >
                    {s.label}
                  </button>
                ))
              )}
              <div className="flex justify-end border-t border-slate-100 bg-white px-3 py-1.5">
                <img src={GOOGLE_ATTRIBUTION_SRC} alt="Powered by Google" className="h-4 w-auto" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
