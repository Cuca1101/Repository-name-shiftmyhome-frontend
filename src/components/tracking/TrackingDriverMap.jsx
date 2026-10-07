import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const ROUTE_SOURCE = 'tracking-drive-route'
const ROUTE_LAYER_CASING = 'tracking-drive-route-casing'
const ROUTE_LAYER = 'tracking-drive-route-line'
const SPRINTER_IMG = '/tracking/mercedes-sprinter-lwb.png'

let markerStylesInjected = false
function ensureTrackingMarkerStyles() {
  if (markerStylesInjected || typeof document === 'undefined') return
  markerStylesInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-tracking-marker', '1')
  style.textContent = `
    @keyframes smh-sprinter-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes smh-sprinter-pulse {
      0%, 100% { transform: scale(0.92); opacity: 0.35; }
      50% { transform: scale(1.12); opacity: 0.12; }
    }
    @keyframes smh-sprinter-shadow {
      0%, 100% { transform: scaleX(1); opacity: 0.28; }
      50% { transform: scaleX(0.82); opacity: 0.16; }
    }
    .smh-sprinter-marker { display:flex; flex-direction:column; align-items:center; gap:2px; pointer-events:none; user-select:none; }
    .smh-sprinter-stack { position:relative; width:88px; height:62px; display:flex; align-items:flex-end; justify-content:center; }
    .smh-sprinter-pulse {
      position:absolute; left:50%; bottom:4px; width:54px; height:18px; margin-left:-27px;
      border-radius:9999px; background:#0284c7; animation: smh-sprinter-pulse 1.8s ease-in-out infinite;
    }
    .smh-sprinter-pulse.is-stale { background:#94a3b8; animation:none; opacity:0.2; }
    .smh-sprinter-img-wrap {
      position:relative; z-index:1; line-height:0;
      filter: drop-shadow(0 4px 8px rgba(15,23,42,0.28));
    }
    .smh-sprinter-img-wrap.is-live { animation: smh-sprinter-bob 1.8s ease-in-out infinite; }
    .smh-sprinter-img {
      display:block; width:84px; height:auto; max-height:56px; object-fit:contain;
      background:transparent;
    }
    .smh-sprinter-img.is-stale { filter: grayscale(0.35) brightness(0.95); }
    .smh-sprinter-ground {
      position:absolute; left:50%; bottom:2px; width:44px; height:8px; margin-left:-22px;
      border-radius:9999px; background:rgba(15,23,42,0.28); z-index:0;
    }
    .smh-sprinter-ground.is-live { animation: smh-sprinter-shadow 1.8s ease-in-out infinite; }
    .smh-sprinter-card {
      display:flex; flex-direction:column; align-items:center; gap:1px; max-width:168px;
      padding:4px 8px; border-radius:10px; background:#fff;
      border:1px solid rgba(15,23,42,0.12); box-shadow:0 2px 8px rgba(15,23,42,0.16);
    }
    .smh-sprinter-name {
      max-width:152px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      font:700 11px Inter,Segoe UI,system-ui,sans-serif; color:#0f172a; text-align:center; line-height:1.2; word-break:break-word;
    }
    .smh-sprinter-ref {
      max-width:152px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; color:#475569; text-align:center;
    }
    .smh-sprinter-stale-badge {
      font:700 9px Inter,Segoe UI,system-ui,sans-serif; padding:1px 6px; border-radius:9999px;
      background:#fef3c7; color:#92400e; border:1px solid #fcd34d;
    }
  `
  document.head.appendChild(style)
}

/**
 * Single Mercedes Sprinter LWB photo marker (one icon only) with soft live animation.
 * @param {{ driverName?: string, quoteRef?: string, live?: boolean }} opts
 */
function buildVanMarkerElement({ driverName = '', quoteRef = '', live = false } = {}) {
  ensureTrackingMarkerStyles()
  const fullName = String(driverName || 'Your driver').trim() || 'Your driver'
  const ref = String(quoteRef || '').trim()

  const wrap = document.createElement('div')
  wrap.className = 'smh-sprinter-marker'
  wrap.setAttribute('aria-label', ref ? `Driver ${fullName}, booking ${ref}` : `Driver ${fullName}`)

  const stack = document.createElement('div')
  stack.className = 'smh-sprinter-stack'

  const pulse = document.createElement('div')
  pulse.className = live ? 'smh-sprinter-pulse' : 'smh-sprinter-pulse is-stale'
  stack.appendChild(pulse)

  const ground = document.createElement('div')
  ground.className = live ? 'smh-sprinter-ground is-live' : 'smh-sprinter-ground'
  stack.appendChild(ground)

  const imgWrap = document.createElement('div')
  imgWrap.className = live ? 'smh-sprinter-img-wrap is-live' : 'smh-sprinter-img-wrap'
  const img = document.createElement('img')
  img.src = SPRINTER_IMG
  img.alt = ''
  img.draggable = false
  img.className = live ? 'smh-sprinter-img' : 'smh-sprinter-img is-stale'
  imgWrap.appendChild(img)
  stack.appendChild(imgWrap)
  wrap.appendChild(stack)

  const card = document.createElement('div')
  card.className = 'smh-sprinter-card'
  const nameEl = document.createElement('div')
  nameEl.className = 'smh-sprinter-name'
  nameEl.textContent = fullName
  card.appendChild(nameEl)
  if (ref) {
    const refEl = document.createElement('div')
    refEl.className = 'smh-sprinter-ref'
    refEl.textContent = ref
    card.appendChild(refEl)
  }
  wrap.appendChild(card)

  if (!live) {
    const stale = document.createElement('div')
    stale.className = 'smh-sprinter-stale-badge'
    stale.textContent = 'Last known'
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
