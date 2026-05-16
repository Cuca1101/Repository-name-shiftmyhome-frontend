import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { Link } from 'react-router-dom'
import { searchGeocodingSuggestions } from '../../lib/mapboxRouteApi'
import { COVERAGE_AREAS, COVERAGE_SEARCH_MESSAGE } from '../../lib/coverageAreas'
import { CONTACT, WHATSAPP_URL } from '../../config'

const UK_BOUNDS_PADDING = { top: 48, bottom: 48, left: 48, right: 48 }

function mkPinEl(name, bg) {
  const el = document.createElement('div')
  el.style.width = '16px'
  el.style.height = '16px'
  el.style.borderRadius = '9999px'
  el.style.backgroundColor = bg
  el.style.border = '3px solid #fff'
  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.25)'
  el.setAttribute('aria-hidden', 'true')
  el.title = name
  return el
}

function fitAreas(map) {
  const b = new mapboxgl.LngLatBounds()
  for (const a of COVERAGE_AREAS) {
    b.extend([a.lng, a.lat])
  }
  map.fitBounds(b, { padding: UK_BOUNDS_PADDING, maxZoom: 6.5, duration: 0 })
}

/**
 * @param {{
 *   variant?: 'compact' | 'full' | 'modal'
 *   searchInputId?: string
 *   statusLine?: string
 *   className?: string
 *   mapClassName?: string
 *   isActive?: boolean
 * }} props
 */
export default function NetworkCoverageMap({
  variant = 'compact',
  searchInputId = 'coverage-map-search',
  statusLine,
  className = '',
  mapClassName = '',
  isActive = true,
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const rootRef = useRef(null)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const suggestTimer = useRef(null)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchMsg, setSearchMsg] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const heightClass =
    variant === 'full'
      ? 'min-h-[min(70vh,560px)] h-[min(70vh,560px)]'
      : variant === 'modal'
        ? 'min-h-[min(42vh,520px)] h-[min(42vh,520px)] sm:min-h-[380px] sm:h-[380px] md:h-[420px]'
        : 'min-h-[320px] h-[320px] sm:min-h-[380px] sm:h-[380px]'

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => {
      try {
        m.remove()
      } catch {
        /* ignore */
      }
    })
    markersRef.current = []
  }, [])

  const addAreaMarkers = useCallback((map) => {
    clearMarkers()
    COVERAGE_AREAS.forEach((a, i) => {
      const bg = i % 2 === 0 ? '#2563eb' : '#059669'
      const el = mkPinEl(a.name, bg)
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([a.lng, a.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<div class="px-1 py-0.5 text-sm font-semibold text-slate-800">${a.name}</div>`,
          ),
        )
        .addTo(map)
      markersRef.current.push(marker)
    })
  }, [clearMarkers])

  useEffect(() => {
    if (!token || !containerRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-4.2, 55.5],
      zoom: 5,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    map.on('load', () => {
      fitAreas(map)
      addAreaMarkers(map)
      window.requestAnimationFrame(() => {
        try {
          map.resize()
        } catch {
          /* ignore */
        }
      })
    })
    mapRef.current = map

    return () => {
      clearMarkers()
      map.remove()
      mapRef.current = null
    }
  }, [token, addAreaMarkers, clearMarkers])

  useEffect(() => {
    if (!isActive || !mapRef.current) return
    const map = mapRef.current
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        try {
          map.resize()
        } catch {
          /* ignore */
        }
      })
    })
    const t = window.setTimeout(() => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }, 120)
    const t2 = window.setTimeout(() => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }, 400)
    return () => {
      window.cancelAnimationFrame(id)
      window.clearTimeout(t)
      window.clearTimeout(t2)
    }
  }, [isActive])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2 || !token) {
      setSuggestions([])
      return
    }
    window.clearTimeout(suggestTimer.current)
    suggestTimer.current = window.setTimeout(async () => {
      const list = await searchGeocodingSuggestions(query, token)
      setSuggestions(list)
    }, 280)
    return () => window.clearTimeout(suggestTimer.current)
  }, [query, token])

  useEffect(() => {
    const close = (e) => {
      if (!(e.target instanceof Node)) return
      if (rootRef.current && !rootRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const flyToResult = useCallback((lng, lat) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: 9, essential: true })
    setSearchMsg(COVERAGE_SEARCH_MESSAGE)
    setMenuOpen(false)
    setSuggestions([])
  }, [])

  const pickSuggestion = useCallback(
    (s) => {
      setQuery(s.placeName)
      flyToResult(s.lng, s.lat)
    },
    [flyToResult],
  )

  const handleSearchSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!token || !query.trim()) return
      const list = await searchGeocodingSuggestions(query, token)
      const first = list[0]
      if (first) {
        pickSuggestion(first)
      }
    },
    [token, query, pickSuggestion],
  )

  const activeAreas = useMemo(() => COVERAGE_AREAS.length, [])

  if (!token) {
    return (
      <div ref={rootRef} data-coverage-map-root className={`space-y-4 ${className}`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-card">
          <p className="text-sm text-slate-600">
            Map preview is unavailable (configure <code className="rounded bg-slate-200 px-1">VITE_MAPBOX_TOKEN</code>
            ). We still operate across these areas and UK-wide — get in touch for a quote.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {COVERAGE_AREAS.map((a) => (
              <li
                key={a.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
              >
                {a.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to="/#services"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 text-sm font-bold text-white shadow-md"
          >
            Get a quote
          </Link>
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Call us
          </a>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} data-coverage-map-root className={`space-y-4 ${className}`}>
      <form onSubmit={handleSearchSubmit} className="relative">
        <label htmlFor={searchInputId} className="sr-only">
          Search city or postcode
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id={searchInputId}
            type="search"
            autoComplete="off"
            placeholder="Search city or postcode…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setMenuOpen(true)
            }}
            onFocus={() => setMenuOpen(true)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
          />
        </div>
        {menuOpen && suggestions.length > 0 && (
          <ul
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {suggestions.map((s) => (
              <li key={s.id} role="option">
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  {s.placeName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {statusLine && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span>{statusLine}</span>
        </p>
      )}

      <div
        ref={containerRef}
        className={`w-full overflow-hidden rounded-2xl border border-slate-200 shadow-card ring-1 ring-slate-100 ${heightClass} ${mapClassName}`}
      />

      {searchMsg && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
          {searchMsg}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{activeAreas}</span> active service markers · Scotland & UK
          corridors
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => document.getElementById(searchInputId)?.focus()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-300 hover:text-brand-800"
          >
            Check if we cover your area
          </button>
          <Link
            to="/#services"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 text-sm font-bold text-white shadow-md hover:from-brand-700 hover:to-emerald-700"
          >
            Get a quote
          </Link>
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Call us
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
