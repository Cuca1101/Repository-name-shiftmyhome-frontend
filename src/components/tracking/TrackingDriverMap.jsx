import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const ROUTE_SOURCE = 'tracking-drive-route'
const ROUTE_LAYER_CASING = 'tracking-drive-route-casing'
const ROUTE_LAYER = 'tracking-drive-route-line'

let markerStylesInjected = false
function ensureTrackingMarkerStyles() {
  if (markerStylesInjected || typeof document === 'undefined') return
  markerStylesInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-tracking-marker', '1')
  style.textContent = `
    @keyframes smh-van-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }
    .smh-van-marker {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      pointer-events:none; user-select:none;
    }
    .smh-van-card {
      display:flex; flex-direction:column; align-items:center; gap:1px; max-width:168px;
      padding:6px 11px; border-radius:10px; background:#fff;
      border:1px solid rgba(15,23,42,0.1); box-shadow:0 2px 10px rgba(15,23,42,0.16);
    }
    .smh-van-name {
      max-width:152px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      font:700 12px Inter,Segoe UI,system-ui,sans-serif; color:#0f172a; text-align:center;
    }
    .smh-van-ref {
      max-width:152px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; color:#64748b; text-align:center;
    }
    .smh-van-badge {
      display:flex; align-items:center; justify-content:center;
      width:46px; height:46px; border-radius:9999px;
      background:#0284c7; color:#fff; border:2.5px solid #fff;
      box-shadow:0 4px 12px rgba(2,132,199,0.45);
    }
    .smh-van-badge.is-live { animation: smh-van-bob 1.7s ease-in-out infinite; }
    .smh-van-badge.is-stale { background:#64748b; box-shadow:0 3px 8px rgba(100,116,139,0.35); }
    .smh-van-badge svg { display:block; width:26px; height:26px; }
    .smh-van-pointer {
      display:flex; flex-direction:column; align-items:center; margin-top:-1px; line-height:0;
    }
    .smh-van-pointer-stem {
      width:3px; height:12px; border-radius:2px; background:#0284c7;
    }
    .smh-van-pointer-stem.is-stale { background:#64748b; }
    .smh-van-pointer-dot {
      width:11px; height:11px; margin-top:-2px; border-radius:9999px;
      background:#0284c7; border:2px solid #fff;
      box-shadow:0 0 0 2px rgba(2,132,199,0.35), 0 2px 6px rgba(15,23,42,0.3);
    }
    .smh-van-pointer-dot.is-stale {
      background:#64748b;
      box-shadow:0 0 0 2px rgba(100,116,139,0.35), 0 2px 6px rgba(15,23,42,0.3);
    }
    .smh-van-stale {
      font:700 9px Inter,Segoe UI,system-ui,sans-serif; padding:1px 6px; border-radius:9999px;
      background:#fef3c7; color:#92400e; border:1px solid #fcd34d;
    }
    .smh-dest-marker {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      pointer-events:none; user-select:none;
    }
    .smh-dest-card {
      padding:4px 9px; border-radius:10px; background:#fff;
      border:1px solid rgba(15,23,42,0.1); box-shadow:0 2px 8px rgba(15,23,42,0.14);
      font:700 11px Inter,Segoe UI,system-ui,sans-serif; color:#0f172a; white-space:nowrap;
    }
    .smh-track-map-host,
    .smh-track-map-host .mapboxgl-map,
    .smh-track-map-host .mapboxgl-canvas-container,
    .smh-track-map-host .mapboxgl-canvas {
      width:100% !important;
      height:100% !important;
    }
    .smh-track-recenter {
      position:absolute; top:98px; right:10px; z-index:2;
      width:29px; height:29px; border:0; border-radius:4px;
      background:#fff; color:#0f172a; cursor:pointer;
      box-shadow:0 0 0 2px rgba(0,0,0,0.1);
      display:flex; align-items:center; justify-content:center;
    }
    .smh-track-recenter:hover { background:#f8fafc; }
    .smh-track-recenter svg { width:16px; height:16px; display:block; }
  `
  document.head.appendChild(style)
}

/**
 * Blue van marker + name/ref card, tip anchored on exact GPS.
 * @param {{ driverName?: string, quoteRef?: string, live?: boolean }} opts
 */
function buildVanMarkerElement({ driverName = '', quoteRef = '', live = false } = {}) {
  ensureTrackingMarkerStyles()
  const fullName = String(driverName || 'Your driver').trim() || 'Your driver'
  const ref = String(quoteRef || '').trim()

  const wrap = document.createElement('div')
  wrap.className = 'smh-van-marker'
  wrap.setAttribute('aria-label', ref ? `Driver ${fullName}, booking ${ref}` : `Driver ${fullName}`)

  const card = document.createElement('div')
  card.className = 'smh-van-card'
  const nameEl = document.createElement('div')
  nameEl.className = 'smh-van-name'
  nameEl.textContent = fullName
  card.appendChild(nameEl)
  if (ref) {
    const refEl = document.createElement('div')
    refEl.className = 'smh-van-ref'
    refEl.textContent = ref
    card.appendChild(refEl)
  }
  wrap.appendChild(card)

  if (!live) {
    const stale = document.createElement('div')
    stale.className = 'smh-van-stale'
    stale.textContent = 'Last known'
    wrap.appendChild(stale)
  }

  const badge = document.createElement('div')
  badge.className = live ? 'smh-van-badge is-live' : 'smh-van-badge is-stale'
  badge.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7h11v10H3V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M14 10h4.2L21 13.2V17h-7v-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="7" cy="18.5" r="1.5" fill="currentColor"/>
      <circle cx="17.5" cy="18.5" r="1.5" fill="currentColor"/>
    </svg>
  `
  wrap.appendChild(badge)

  const pointer = document.createElement('div')
  pointer.className = 'smh-van-pointer'
  pointer.setAttribute('aria-hidden', 'true')
  const stem = document.createElement('div')
  stem.className = live ? 'smh-van-pointer-stem' : 'smh-van-pointer-stem is-stale'
  const tip = document.createElement('div')
  tip.className = live ? 'smh-van-pointer-dot' : 'smh-van-pointer-dot is-stale'
  pointer.appendChild(stem)
  pointer.appendChild(tip)
  wrap.appendChild(pointer)

  return wrap
}

/**
 * @param {{ kind?: 'collection' | 'delivery' | string }} opts
 */
function buildDestinationMarkerElement({ kind = 'collection' } = {}) {
  ensureTrackingMarkerStyles()
  const label = kind === 'delivery' ? 'Delivery address' : 'Collection address'
  const accent = kind === 'delivery' ? '#059669' : '#ef4444'
  const wrap = document.createElement('div')
  wrap.className = 'smh-dest-marker'
  wrap.setAttribute('aria-label', label)

  const card = document.createElement('div')
  card.className = 'smh-dest-card'
  card.textContent = label
  wrap.appendChild(card)

  const pin = document.createElement('div')
  pin.innerHTML = `
    <svg width="26" height="34" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 0C6.3 0 0 6.1 0 13.6 0 22.4 14 36 14 36S28 22.4 28 13.6C28 6.1 21.7 0 14 0Z" fill="${accent}"/>
      <circle cx="14" cy="13" r="5.5" fill="#fff"/>
    </svg>
  `
  pin.style.cssText = 'line-height:0;filter:drop-shadow(0 2px 4px rgba(15,23,42,0.3));'
  wrap.appendChild(pin)

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
        'line-color': '#0c4a6e',
        'line-width': 9,
        'line-opacity': 0.28,
      },
    })
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0284c7',
        'line-width': 6,
        'line-opacity': 0.98,
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
      padding: { top: 80, bottom: 64, left: 56, right: 56 },
      maxZoom: 14.5,
      duration: 650,
      essential: true,
    })
  } catch {
    /* ignore fit errors */
  }
}

/**
 * Customer tracking map: blue van, destination pin, road route, zoom + recenter.
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
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const mapReadyRef = useRef(false)
  const lastFitKeyRef = useRef('')
  const driverMetaKeyRef = useRef('')
  const routeCoordsRef = useRef(routeCoordinates)
  const destRef = useRef(destination)
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

  routeCoordsRef.current = routeCoordinates
  destRef.current = destination

  useEffect(() => {
    if (!token) {
      setError('Map token missing.')
      return undefined
    }
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    let resizeObserver = null
    const timers = []

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
    ensureTrackingMarkerStyles()

    try {
      mapboxgl.accessToken = token
      host.style.width = '100%'
      host.style.height = '100%'
      host.style.minHeight = '0'
      host.style.margin = '0'
      host.style.padding = '0'

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
      timers.push(window.setTimeout(resize, 50))
      timers.push(window.setTimeout(resize, 250))
      timers.push(window.setTimeout(resize, 600))

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize())
        resizeObserver.observe(host)
        if (wrapRef.current) resizeObserver.observe(wrapRef.current)
      }
    } catch (ex) {
      console.error('[TrackingDriverMap] init failed', ex)
      setError(ex?.message || 'Could not start map')
      tearDown()
    }

    return () => {
      cancelled = true
      for (const id of timers) window.clearTimeout(id)
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

  const recenter = () => {
    const map = mapRef.current
    if (!map || !coordsOk) return
    const dest = destRef.current
    const dLng = Number(dest?.lng)
    const dLat = Number(dest?.lat)
    fitRouteBounds(
      map,
      { lng, lat },
      Number.isFinite(dLng) && Number.isFinite(dLat) ? { lng: dLng, lat: dLat } : null,
      routeCoordsRef.current,
    )
  }

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
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden bg-slate-200 ${className || 'h-80'}`}
    >
      <div
        ref={hostRef}
        className="smh-track-map-host absolute inset-0 h-full w-full"
        role="img"
        aria-label={name ? `Driver ${name} on map` : 'Driver location map'}
      />
      <button
        type="button"
        className="smh-track-recenter"
        title="Recenter on route"
        aria-label="Recenter on route"
        onClick={recenter}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {error ? (
        <p className="absolute inset-x-3 bottom-3 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
          Map could not load ({error}).{' '}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open in Google Maps
          </a>
        </p>
      ) : null}
    </div>
  )
}
