import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { searchGeocodingSuggestions } from '../../lib/mapboxRouteApi'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { useFloatingPanelBelow } from './useFloatingPanelBelow'

const inputClass =
  'box-border min-h-[38px] w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:min-h-[48px] sm:rounded-xl sm:px-4 sm:text-base'

const mobileCardInputClass =
  'box-border min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base leading-snug text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

const SEARCH_DEBOUNCE_MS = 200

const mobileSuggestionRow =
  'flex min-h-[56px] w-full min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-base text-slate-900 transition last:border-b-0 active:bg-brand-50'

/**
 * @param {string} [nextFocusId] — element id to focus after a suggestion is picked
 * @param {'move-date'} [nextFocusTarget] — focus first visible quote move-date input
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
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const pickingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(0)
  const panelRef = useRef(null)

  const selectedFromList = lng != null && lat != null

  const applyPatch = useCallback(
    (patch) => {
      applyWizardPatch(onChange, patch)
    },
    [onChange],
  )

  const handleInputChange = (e) => {
    const v = e.target.value
    const patch = {
      [addressKey]: v,
      [lngKey]: null,
      [latKey]: null,
    }
    if (confirmedKey) patch[confirmedKey] = false
    applyPatch(patch)
    setOpen(true)
  }

  const pickSuggestion = useCallback(
    (s) => {
      pickingRef.current = true

      const patch = {
        [addressKey]: s.placeName,
        [lngKey]: s.lng,
        [latKey]: s.lat,
      }
      if (confirmedKey) patch[confirmedKey] = true
      applyPatch(patch)
      setSuggestions([])
      setOpen(false)

      window.requestAnimationFrame(() => {
        onAddressSelected?.()
        focusNextField({ nextFocusId, nextFocusTarget })
        pickingRef.current = false
      })
    },
    [addressKey, lngKey, latKey, confirmedKey, applyPatch, nextFocusId, nextFocusTarget, onAddressSelected],
  )

  useEffect(() => {
    if (!token || !address?.trim() || address.trim().length < 2) {
      setSuggestions([])
      setSearching(false)
      setOpen(false)
      return undefined
    }

    if (selectedFromList) {
      setSearching(false)
      return undefined
    }

    window.clearTimeout(debounceRef.current)
    setSearching(true)

    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchGeocodingSuggestions(address, token)
        if (!rootRef.current) return
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      } finally {
        setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(debounceRef.current)
  }, [address, token, selectedFromList, variant])

  const isMobileCard = variant === 'mobile-card'
  const hasQuery = (address || '').trim().length >= 2
  const showDesktopList = open && suggestions.length > 0 && !isMobileCard
  const showMobileList =
    isMobileCard && open && !selectedFromList && hasQuery && (searching || suggestions.length > 0)
  const showSuggestionsPanel = isMobileCard ? showMobileList : showDesktopList

  const panelStyle = useFloatingPanelBelow(inputRef, showSuggestionsPanel, {
    maxHeight: 280,
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

  if (!token) {
    return null
  }

  const quoteField =
    addressKey === 'pickupAddress'
      ? 'pickup-address'
      : addressKey === 'deliveryAddress'
        ? 'delivery-address'
        : undefined

  const resolvedInputClass = isMobileCard ? mobileCardInputClass : inputClass
  const labelClass =
    isMobileCard
      ? 'mb-1 block text-xs font-medium leading-snug text-slate-700'
      : 'mb-1 block text-xs font-medium leading-snug text-slate-700 sm:mb-1.5 sm:text-sm'

  return (
    <div
      ref={rootRef}
      data-quote-field={quoteField}
      className="relative box-border min-w-0 w-full"
    >
      <label className={labelClass}>
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
          onFocus={() => {
            if (!selectedFromList && (address || '').trim().length >= 2) {
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
        <p className="mt-1.5 text-xs text-emerald-700">Location saved from suggestions.</p>
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
                      pickSuggestion(s)
                    }}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${markerClassName}`}
                      aria-hidden
                    >
                      {markerLetter}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{s.placeName}</span>
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
                      pickSuggestion(s)
                    }}
                  >
                    {s.placeName}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
