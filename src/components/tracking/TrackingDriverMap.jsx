import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const ROUTE_SOURCE = 'tracking-drive-route'
const ROUTE_LAYER_CASING = 'tracking-drive-route-casing'
const ROUTE_LAYER = 'tracking-drive-route-line'

/**
 * Permanent driver vehicle marker asset — do not replace with SVG/icon-only markers.
 * Product requirement: always use the Mercedes Sprinter photo on the track map.
 */
const SPRINTER_IMG = '/tracking/mercedes-sprinter-lwb.png'

/**
 * Sprinter cutout is a side profile (wheels down). Never rotate it onto its roof —
 * only mirror left/right from heading so the nose points with travel.
 * PNG faces roughly right (east).
 */
const ANIM_MS = 1200
const MIN_ANIM_MOVE_M = 4
const MIN_HEADING_MOVE_M = 12

let markerStylesInjected = false
function ensureTrackingMarkerStyles() {
  if (markerStylesInjected || typeof document === 'undefined') return
  markerStylesInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-tracking-marker', '1')
  style.textContent = `
    @keyframes smh-van-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    .smh-van-marker {
      display:flex; flex-direction:column; align-items:center; gap:2px;
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
    .smh-van-rotator {
      display:flex; flex-direction:column; align-items:center;
      transform-origin: 50% 100%;
      will-change: transform;
    }
    .smh-van-icon {
      line-height:0;
      filter: drop-shadow(0 3px 6px rgba(15,23,42,0.3));
      background: transparent !important;
    }
    .smh-van-icon.is-live { animation: smh-van-bob 1.7s ease-in-out infinite; }
    .smh-van-img {
      display:block; width:48px; height:auto; max-height:32px;
      object-fit:contain; background:transparent !important; border:0; outline:0;
    }
    .smh-van-img.is-stale { filter: grayscale(0.25) brightness(0.96); opacity:0.92; }
    .smh-van-pointer {
      display:flex; flex-direction:column; align-items:center; margin-top:-2px; line-height:0;
    }
    .smh-van-pointer-stem {
      width:2px; height:10px; border-radius:2px; background:#0284c7;
      box-shadow:0 1px 2px rgba(15,23,42,0.25);
    }
    .smh-van-pointer-stem.is-stale { background:#64748b; }
    .smh-van-pointer-dot {
      width:9px; height:9px; margin-top:-2px; border-radius:9999px;
      background:#0284c7; border:2px solid #fff;
      box-shadow:0 0 0 2px rgba(2,132,199,0.35), 0 2px 6px rgba(15,23,42,0.35);
    }
    .smh-van-pointer-dot.is-live {
      box-shadow:0 0 0 2px rgba(2,132,199,0.4), 0 2px 6px rgba(15,23,42,0.35);
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
    .smh-track-follow {
      position:absolute; left:12px; bottom:12px; z-index:2;
      display:inline-flex; align-items:center; gap:6px;
      height:36px; padding:0 12px; border:0; border-radius:9999px;
      background:#0284c7; color:#fff; cursor:pointer;
      font:700 12px Inter,Segoe UI,system-ui,sans-serif;
      box-shadow:0 2px 10px rgba(2,132,199,0.4);
    }
    .smh-track-follow[data-active="1"] {
      background:#fff; color:#0369a1;
      box-shadow:0 0 0 2px rgba(2,132,199,0.35), 0 2px 8px rgba(15,23,42,0.12);
    }
    .smh-track-follow svg { width:16px; height:16px; display:block; }
  `
  document.head.appendChild(style)
}

function haversineMetres(lng1, lat1, lng2, lat2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** @returns {number} degrees 0–360, north = 0 */
function bearingDegrees(from, to) {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * Mercedes Sprinter photo + name/ref card, tip anchored on exact GPS.
 * Always use SPRINTER_IMG — never swap this for an icon-only marker.
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

  const rotator = document.createElement('div')
  rotator.className = 'smh-van-rotator'
  rotator.dataset.rotator = '1'

  const icon = document.createElement('div')
  icon.className = live ? 'smh-van-icon is-live' : 'smh-van-icon'
  const img = document.createElement('img')
  img.src = SPRINTER_IMG
  img.alt = 'Mercedes Sprinter'
  img.draggable = false
  img.className = live ? 'smh-van-img' : 'smh-van-img is-stale'
  icon.appendChild(img)
  rotator.appendChild(icon)

  const pointer = document.createElement('div')
  pointer.className = 'smh-van-pointer'
  pointer.setAttribute('aria-hidden', 'true')
  const stem = document.createElement('div')
  stem.className = live ? 'smh-van-pointer-stem' : 'smh-van-pointer-stem is-stale'
  const tip = document.createElement('div')
  tip.className = live ? 'smh-van-pointer-dot is-live' : 'smh-van-pointer-dot is-stale'
  pointer.appendChild(stem)
  pointer.appendChild(tip)
  rotator.appendChild(pointer)

  wrap.appendChild(rotator)
  return wrap
}

function setMarkerHeading(marker, headingDeg) {
  if (!marker) return
  const el = marker.getElement?.()
  const rotator = el?.querySelector?.('[data-rotator="1"]')
  if (!rotator) return
  // Keep wheels down (head up). Mirror when heading is westbound (~90–270°).
  if (!Number.isFinite(headingDeg)) {
    rotator.style.transform = 'scaleX(1)'
    return
  }
  const h = ((headingDeg % 360) + 360) % 360
  const faceLeft = h > 90 && h < 270
  rotator.style.transform = faceLeft ? 'scaleX(-1)' : 'scaleX(1)'
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

/** Collection = orange, delivery = green. */
function routePaintForKind(kind) {
  if (kind === 'delivery') {
    return { casing: '#065f46', line: '#059669' }
  }
  return { casing: '#9a3412', line: '#ea580c' }
}

/**
 * @param {mapboxgl.Map} map
 * @param {number[][] | null | undefined} coordinates
 * @param {'collection' | 'delivery' | string} [kind]
 */
function upsertRouteLine(map, coordinates, kind = 'collection') {
  const coords = Array.isArray(coordinates)
    ? coordinates.filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    : []
  const colors = routePaintForKind(kind)

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
    if (map.getLayer(ROUTE_LAYER_CASING)) {
      map.setPaintProperty(ROUTE_LAYER_CASING, 'line-color', colors.casing)
      map.setPaintProperty(ROUTE_LAYER_CASING, 'line-width', 5)
      map.setPaintProperty(ROUTE_LAYER_CASING, 'line-opacity', 0.25)
    }
    if (map.getLayer(ROUTE_LAYER)) {
      map.setPaintProperty(ROUTE_LAYER, 'line-color', colors.line)
      map.setPaintProperty(ROUTE_LAYER, 'line-width', 3.25)
      map.setPaintProperty(ROUTE_LAYER, 'line-opacity', 0.98)
    }
  } else if (coords.length >= 2) {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: geojson })
    map.addLayer({
      id: ROUTE_LAYER_CASING,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.casing,
        'line-width': 5,
        'line-opacity': 0.25,
      },
    })
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': colors.line,
        'line-width': 3.25,
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
      padding: { top: 80, bottom: 72, left: 56, right: 56 },
      maxZoom: 15,
      duration: 700,
      essential: true,
    })
  } catch {
    /* ignore fit errors */
  }
}

/**
 * Uber-style customer tracking map: Sprinter marker, smooth GPS moves, heading, follow.
 *
 * @param {{
 *   latitude: number,
 *   longitude: number,
 *   heading?: number | null,
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
  heading = null,
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
  const animFrameRef = useRef(0)
  const displayPosRef = useRef(/** @type {{ lng: number, lat: number } | null } */ (null))
  const headingRef = useRef(/** @type {number | null} */ (null))
  const followRef = useRef(true)
  const userInteractRef = useRef(false)
  const routeCoordsRef = useRef(routeCoordinates)
  const destRef = useRef(destination)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(true)
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
  const headingNum = Number(heading)

  routeCoordsRef.current = routeCoordinates
  destRef.current = destination
  followRef.current = following

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
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = 0
      }
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
      displayPosRef.current = null
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
        zoom: 13,
        attributionControl: true,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')

      const onUserInteract = () => {
        if (userInteractRef.current) return
        userInteractRef.current = true
        followRef.current = false
        setFollowing(false)
      }
      map.on('dragstart', onUserInteract)
      map.on('zoomstart', (e) => {
        // Programmatic easeTo/fitBounds also fire zoomstart — only treat as user when originalEvent set.
        if (e?.originalEvent) onUserInteract()
      })
      map.on('rotatestart', (e) => {
        if (e?.originalEvent) onUserInteract()
      })

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

    const target = { lng, lat }

    const applyMarker = () => {
      if (!mapRef.current) return
      const metaChanged = driverMetaKeyRef.current !== driverMetaKey
      if (!driverMarkerRef.current || metaChanged) {
        driverMetaKeyRef.current = driverMetaKey
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current)
          animFrameRef.current = 0
        }
        try {
          driverMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        const el = buildVanMarkerElement({ driverName: name, quoteRef: bookingRef, live })
        driverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([target.lng, target.lat])
          .addTo(mapRef.current)
        displayPosRef.current = { ...target }
        if (Number.isFinite(headingNum)) {
          headingRef.current = headingNum
          setMarkerHeading(driverMarkerRef.current, headingNum)
        }
        return
      }

      const from = displayPosRef.current || target
      const moveM = haversineMetres(from.lng, from.lat, target.lng, target.lat)

      let nextHeading = Number.isFinite(headingNum) ? headingNum : null
      if (nextHeading == null && moveM >= MIN_HEADING_MOVE_M) {
        nextHeading = bearingDegrees(from, target)
      }
      if (nextHeading != null) {
        headingRef.current = nextHeading
        setMarkerHeading(driverMarkerRef.current, nextHeading)
      }

      if (!live || moveM < MIN_ANIM_MOVE_M) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current)
          animFrameRef.current = 0
        }
        driverMarkerRef.current.setLngLat([target.lng, target.lat])
        displayPosRef.current = { ...target }
        if (followRef.current && live) {
          try {
            mapRef.current.easeTo({
              center: [target.lng, target.lat],
              duration: 400,
              essential: true,
            })
          } catch {
            /* ignore */
          }
        }
        return
      }

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = 0
      }
      const start = performance.now()
      const startPos = { ...from }
      const run = (now) => {
        const t = Math.min(1, (now - start) / ANIM_MS)
        const e = easeInOut(t)
        const cur = {
          lng: startPos.lng + (target.lng - startPos.lng) * e,
          lat: startPos.lat + (target.lat - startPos.lat) * e,
        }
        displayPosRef.current = cur
        try {
          driverMarkerRef.current?.setLngLat([cur.lng, cur.lat])
        } catch {
          /* ignore */
        }
        if (followRef.current && mapRef.current) {
          try {
            mapRef.current.easeTo({
              center: [cur.lng, cur.lat],
              duration: 0,
              essential: true,
            })
          } catch {
            /* ignore */
          }
        }
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(run)
        } else {
          animFrameRef.current = 0
        }
      }
      animFrameRef.current = requestAnimationFrame(run)
    }

    if (mapReadyRef.current || map.isStyleLoaded()) applyMarker()
    else map.once('load', applyMarker)
    return undefined
  }, [coordsOk, lat, lng, live, name, bookingRef, driverMetaKey, headingNum])

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
        upsertRouteLine(m, routeCoordinates, stopKind)
      } catch (ex) {
        console.warn('[TrackingDriverMap] route update failed', ex)
      }

      const routeKey = Array.isArray(routeCoordinates)
        ? `${routeCoordinates.length}:${routeCoordinates[0]?.join(',')}:${routeCoordinates[routeCoordinates.length - 1]?.join(',')}`
        : 'none'
      const fitKey = `${destOk ? `${destLng.toFixed(4)},${destLat.toFixed(4)}` : 'nodest'}|${routeKey}|${stopKind}`
      // Fit full route when destination/route changes, or when follow was just re-enabled via fitKey change.
      if (fitKey !== lastFitKeyRef.current) {
        lastFitKeyRef.current = fitKey
        if (!followRef.current) {
          // still update route line; don't steal camera
        } else {
          fitRouteBounds(
            m,
            { lng, lat },
            destOk ? { lng: destLng, lat: destLat } : null,
            routeCoordinates,
          )
        }
      }
    }

    if (mapReadyRef.current || map.isStyleLoaded()) apply()
    else map.once('load', apply)
    return undefined
  }, [destOk, destLng, destLat, stopKind, routeCoordinates, lat, lng])

  const enableFollow = () => {
    userInteractRef.current = false
    followRef.current = true
    setFollowing(true)
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
        className="smh-track-follow"
        data-active={following ? '1' : '0'}
        title={following ? 'Following driver' : 'Follow driver'}
        aria-label={following ? 'Following driver' : 'Follow driver'}
        aria-pressed={following}
        onClick={enableFollow}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {following ? 'Following' : 'Follow driver'}
      </button>
      {error ? (
        <p className="absolute inset-x-3 bottom-14 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
          Map could not load ({error}).{' '}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open in Google Maps
          </a>
        </p>
      ) : null}
    </div>
  )
}
