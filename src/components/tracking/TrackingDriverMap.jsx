import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const ROUTE_SOURCE = 'tracking-drive-route'
const ROUTE_LAYER_CASING = 'tracking-drive-route-casing'
const ROUTE_LAYER = 'tracking-drive-route-line'

/**
 * Single long-wheelbase Mercedes Sprinter van marker (no emoji / dual icons).
 * @param {{ driverName?: string, quoteRef?: string, live?: boolean }} opts
 */
function buildVanMarkerElement({ driverName = '', quoteRef = '', live = false } = {}) {
  const fullName = String(driverName || 'Your driver').trim() || 'Your driver'
  const ref = String(quoteRef || '').trim()
  const body = live ? '#0ea5e9' : '#64748b'
  const cabin = live ? '#0369a1' : '#475569'
  const glass = '#e0f2fe'
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-label', ref ? `Driver ${fullName}, booking ${ref}` : `Driver ${fullName}`)
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;user-select:none;'

  const van = document.createElement('div')
  // Long-wheelbase Sprinter silhouette (cab + extended cargo box)
  van.innerHTML = `
    <svg width="72" height="40" viewBox="0 0 96 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="48" cy="48" rx="28" ry="3.5" fill="rgba(15,23,42,0.2)"/>
      <!-- cargo box (long wheelbase) -->
      <rect x="6" y="12" width="58" height="24" rx="2.5" fill="${body}"/>
      <rect x="10" y="16" width="12" height="9" rx="1.2" fill="${glass}" opacity="0.85"/>
      <rect x="26" y="16" width="12" height="9" rx="1.2" fill="${glass}" opacity="0.7"/>
      <rect x="42" y="16" width="12" height="9" rx="1.2" fill="${glass}" opacity="0.55"/>
      <!-- cab -->
      <path d="M64 36 V18 C64 15.2 66.2 13 69 13 H78 L90 24 V36 Z" fill="${cabin}"/>
      <path d="M78 13 L88 23 H78 Z" fill="#0284c7"/>
      <rect x="70" y="18" width="12" height="9" rx="1.5" fill="${glass}"/>
      <!-- bumper / step -->
      <rect x="6" y="34" width="84" height="4" rx="1" fill="#0f172a"/>
      <!-- wheels (LWB spacing) -->
      <circle cx="22" cy="39" r="5.5" fill="#0f172a"/>
      <circle cx="22" cy="39" r="2.6" fill="#cbd5e1"/>
      <circle cx="48" cy="39" r="5.5" fill="#0f172a"/>
      <circle cx="48" cy="39" r="2.6" fill="#cbd5e1"/>
      <circle cx="78" cy="39" r="5.5" fill="#0f172a"/>
      <circle cx="78" cy="39" r="2.6" fill="#cbd5e1"/>
    </svg>
  `
  van.style.cssText = 'filter:drop-shadow(0 3px 6px rgba(15,23,42,0.35));line-height:0;'
  wrap.appendChild(van)

  const card = document.createElement('div')
  card.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:2px;max-width:200px;padding:5px 10px;border-radius:10px;background:#fff;border:1px solid rgba(15,23,42,0.12);box-shadow:0 2px 8px rgba(15,23,42,0.18);'

  const nameEl = document.createElement('div')
  nameEl.textContent = fullName
  nameEl.style.cssText =
    'max-width:184px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font:700 12px Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;text-align:center;line-height:1.25;word-break:break-word;'
  card.appendChild(nameEl)

  if (ref) {
    const refEl = document.createElement('div')
    refEl.textContent = ref
    refEl.style.cssText =
      'max-width:184px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569;text-align:center;'
    card.appendChild(refEl)
  }
  wrap.appendChild(card)

  if (!live) {
    const stale = document.createElement('div')
    stale.textContent = 'Last known'
    stale.style.cssText =
      'font:700 9px Inter,Segoe UI,system-ui,sans-serif;padding:1px 6px;border-radius:9999px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'
    wrap.appendChild(stale)
  }

  return wrap
}

/**
 * Destination marker (collection / delivery) — pin, no full address.
 * @param {{ kind?: 'collection' | 'delivery' | string }} opts
 */
function buildDestinationMarkerElement({ kind = 'collection' } = {}) {
  const label = kind === 'delivery' ? 'Delivery' : 'Collection'
  const accent = kind === 'delivery' ? '#059669' : '#dc2626'
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-label', label)
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;user-select:none;'

  const pin = document.createElement('div')
  pin.innerHTML = `
    <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 0C6.3 0 0 6.1 0 13.6 0 22.4 14 36 14 36S28 22.4 28 13.6C28 6.1 21.7 0 14 0Z" fill="${accent}"/>
      <circle cx="14" cy="13" r="5.5" fill="#fff"/>
    </svg>
  `
  pin.style.cssText = 'line-height:0;filter:drop-shadow(0 2px 4px rgba(15,23,42,0.35));'
  wrap.appendChild(pin)

  const card = document.createElement('div')
  card.textContent = label
  card.style.cssText =
    'padding:3px 8px;border-radius:9999px;background:#fff;border:1px solid rgba(15,23,42,0.12);box-shadow:0 2px 6px rgba(15,23,42,0.16);font:700 10px Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;'
  wrap.appendChild(card)

  return wrap
}

/**
 * @param {mapboxgl.Map} map
 * @param {number[][] | null | undefined} coordinates
 */
function upsertRouteLine(map, coordinates) {
  const coords = Array.isArray(coordinates)
    ? coordinates.filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    : []

  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords.length >= 2 ? coords : [],
    },
  }

  const source = /** @type {mapboxgl.GeoJSONSource | undefined} */ (map.getSource(ROUTE_SOURCE))
  if (source) {
    source.setData(geojson)
  } else if (coords.length >= 2) {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: geojson })
    map.addLayer({
      id: ROUTE_LAYER_CASING,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0f172a',
        'line-width': 7,
        'line-opacity': 0.22,
      },
    })
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0284c7',
        'line-width': 4.5,
        'line-opacity': 0.95,
      },
    })
  }
}

/**
 * @param {mapboxgl.Map} map
 * @param {{ lng: number, lat: number }} driver
 * @param {{ lng: number, lat: number } | null} dest
 * @param {number[][] | null | undefined} routeCoordinates
 */
function fitRouteBounds(map, driver, dest, routeCoordinates) {
  const bounds = new mapboxgl.LngLatBounds()
  let count = 0
  if (Number.isFinite(driver.lng) && Number.isFinite(driver.lat)) {
    bounds.extend([driver.lng, driver.lat])
    count += 1
  }
  if (dest && Number.isFinite(dest.lng) && Number.isFinite(dest.lat)) {
    bounds.extend([dest.lng, dest.lat])
    count += 1
  }
  if (Array.isArray(routeCoordinates)) {
    for (const c of routeCoordinates) {
      if (!Array.isArray(c) || c.length < 2) continue
      const lng = Number(c[0])
      const lat = Number(c[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      bounds.extend([lng, lat])
      count += 1
    }
  }
  if (count < 1) return
  try {
    map.fitBounds(bounds, {
      padding: { top: 72, bottom: 56, left: 48, right: 48 },
      maxZoom: 14.5,
      duration: 650,
      essential: true,
    })
  } catch {
    /* ignore fit errors */
  }
}

/**
 * Customer tracking map with Sprinter van, destination pin, and Mapbox road route.
 *
 * @param {{
 *   latitude: number,
 *   longitude: number,
 *   live?: boolean,
 *   driverName?: string,
 *   quoteRef?: string,
 *   routeCoordinates?: number[][] | null,
 *   destination?: { lng: number, lat: number } | null,
 *   destinationKind?: 'collection' | 'delivery' | string | null,
 *   className?: string,
 * }} props
 */
export default function TrackingDriverMap({
  latitude,
  longitude,
  live = false,
  driverName = '',
  quoteRef = '',
  routeCoordinates = null,
  destination = null,
  destinationKind = null,
  className = '',
}) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const mapReadyRef = useRef(false)
  const lastFitKeyRef = useRef('')
  const driverMetaKeyRef = useRef('')
  const [error, setError] = useState('')
  const token = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()

  const lat = Number(latitude)
  const lng = Number(longitude)
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lng)
  const name = String(driverName || '').trim()
  const bookingRef = String(quoteRef || '').trim()
  const destLng = Number(destination?.lng)
  const destLat = Number(destination?.lat)
  const destOk = Number.isFinite(destLng) && Number.isFinite(destLat)
  const stopKind = destinationKind === 'delivery' ? 'delivery' : 'collection'
  const driverMetaKey = `${live ? 1 : 0}|${name}|${bookingRef}`

  useEffect(() => {
    if (!token) {
      setError('Map token missing.')
      return undefined
    }
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    let resizeObserver = null
    let loadTimer = 0

    const tearDown = () => {
      mapReadyRef.current = false
      try {
        driverMarkerRef.current?.remove()
      } catch {
        /* ignore */
      }
      driverMarkerRef.current = null
      try {
        destMarkerRef.current?.remove()
      } catch {
        /* ignore */
      }
      destMarkerRef.current = null
      try {
        mapRef.current?.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
    }

    const resize = () => {
      try {
        mapRef.current?.resize()
      } catch {
        /* ignore */
      }
    }

    tearDown()
    setError('')

    try {
      mapboxgl.accessToken = token
      host.style.width = '100%'
      host.style.minHeight = '16rem'
      host.style.height = host.style.height || '20rem'

      const map = new mapboxgl.Map({
        container: host,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: coordsOk ? [lng, lat] : [-3.5, 55.0],
        zoom: 12,
        attributionControl: true,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')

      map.on('load', () => {
        if (cancelled) return
        mapReadyRef.current = true
        resize()
        setError('')
      })
      map.on('error', (e) => {
        const msg = e?.error?.message || e?.message || 'Map failed to load'
        console.warn('[TrackingDriverMap]', msg, e?.error ?? e)
        if (!cancelled) setError(String(msg))
      })

      resize()
      loadTimer = window.setTimeout(resize, 50)
      window.setTimeout(resize, 250)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize())
        resizeObserver.observe(host)
      }
    } catch (ex) {
      console.error('[TrackingDriverMap] init failed', ex)
      setError(ex?.message || 'Could not start map')
      tearDown()
    }

    return () => {
      cancelled = true
      if (loadTimer) window.clearTimeout(loadTimer)
      resizeObserver?.disconnect()
      tearDown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !coordsOk) return undefined

    const apply = () => {
      if (!mapRef.current) return
      const metaChanged = driverMetaKeyRef.current !== driverMetaKey
      if (!driverMarkerRef.current || metaChanged) {
        driverMetaKeyRef.current = driverMetaKey
        try {
          driverMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        const el = buildVanMarkerElement({ driverName: name, quoteRef: bookingRef, live })
        driverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(mapRef.current)
        return
      }
      driverMarkerRef.current.setLngLat([lng, lat])
    }

    if (mapReadyRef.current || map.isStyleLoaded()) apply()
    else map.once('load', apply)
    return undefined
  }, [coordsOk, lat, lng, live, name, bookingRef, driverMetaKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined

    const apply = () => {
      const m = mapRef.current
      if (!m) return

      if (destOk) {
        try {
          destMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        const el = buildDestinationMarkerElement({ kind: stopKind })
        destMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([destLng, destLat])
          .addTo(m)
      } else if (destMarkerRef.current) {
        try {
          destMarkerRef.current.remove()
        } catch {
          /* ignore */
        }
        destMarkerRef.current = null
      }

      try {
        upsertRouteLine(m, routeCoordinates)
      } catch (ex) {
        console.warn('[TrackingDriverMap] route update failed', ex)
      }

      const routeKey = Array.isArray(routeCoordinates)
        ? `${routeCoordinates.length}:${routeCoordinates[0]?.join(',')}:${routeCoordinates[routeCoordinates.length - 1]?.join(',')}`
        : 'none'
      const fitKey = `${destOk ? `${destLng.toFixed(4)},${destLat.toFixed(4)}` : 'nodest'}|${routeKey}|${stopKind}`
      if (fitKey !== lastFitKeyRef.current) {
        lastFitKeyRef.current = fitKey
        fitRouteBounds(
          m,
          { lng, lat },
          destOk ? { lng: destLng, lat: destLat } : null,
          routeCoordinates,
        )
      }
    }

    if (mapReadyRef.current || map.isStyleLoaded()) apply()
    else map.once('load', apply)
    return undefined
  }, [destOk, destLng, destLat, stopKind, routeCoordinates, lat, lng])

  if (!token) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Map is temporarily unavailable.
      </p>
    )
  }

  if (!coordsOk) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Location temporarily unavailable.
      </p>
    )
  }

  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`

  return (
    <div className={className}>
      <div
        ref={hostRef}
        className="h-64 w-full overflow-hidden rounded-xl bg-slate-200 sm:h-80"
        role="img"
        aria-label={name ? `Driver ${name} on map` : 'Driver location map'}
      />
      {error ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Map could not load ({error}).{' '}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open location in Google Maps
          </a>
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
            Open in Google Maps
          </a>
        </p>
      )}
    </div>
  )
}
