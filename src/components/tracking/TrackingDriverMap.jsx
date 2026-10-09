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
 * Sprinter cutout is a side profile (wheels down). Keep a fixed upright orientation —
 * no rotation and no left/right mirroring from heading.
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
      display:block; width:58px; height:auto; max-height:40px;
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
    .smh-track-controls {
      position:relative; z-index:3; flex:0 0 auto;
      display:flex; flex-wrap:wrap; gap:8px;
      padding:8px; background:#fff;
      border-bottom:1px solid rgba(15,23,42,0.08);
    }
    .smh-track-controls .smh-track-follow,
    .smh-track-controls .smh-track-route {
      position:static; pointer-events:auto;
      min-height:44px; height:auto; padding:0 14px;
      font-size:13px; line-height:1;
    }
    .smh-track-route {
      display:inline-flex; align-items:center; justify-content:center;
      border:0; border-radius:9999px; cursor:pointer;
      background:#fff; color:#0369a1;
      font:700 13px Inter,Segoe UI,system-ui,sans-serif;
      box-shadow:0 2px 8px rgba(15,23,42,0.16);
    }
    .smh-track-route[data-active="1"] {
      background:#0284c7; color:#fff;
      box-shadow:0 2px 10px rgba(2,132,199,0.4);
    }
    .smh-stop-pin {
      display:flex; flex-direction:column; align-items:center;
      pointer-events:none; user-select:none; z-index:4;
    }
    .smh-stop-num {
      width:34px; height:34px; border-radius:9999px;
      display:flex; align-items:center; justify-content:center;
      color:#fff; border:3px solid #fff;
      font:800 16px Inter,Segoe UI,system-ui,sans-serif;
      box-shadow:0 2px 8px rgba(15,23,42,0.4);
    }
    .smh-stop-pin.is-active .smh-stop-num {
      box-shadow:0 0 0 4px rgba(255,255,255,0.95), 0 2px 10px rgba(15,23,42,0.45);
    }
    .smh-stop-stem { width:3px; height:12px; border-radius:2px; }
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
  wrap.style.zIndex = '8'
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

function setMarkerHeading(marker) {
  if (!marker) return
  const el = marker.getElement?.()
  const rotator = el?.querySelector?.('[data-rotator="1"]')
  if (!rotator) return
  // Fixed orientation: wheels down, never flip or rotate with heading.
  rotator.style.transform = 'none'
}

/**
 * @param {{ kind?: 'collection' | 'delivery' | string }} opts
 */
function buildDestinationMarkerElement({ kind = 'collection' } = {}) {
  ensureTrackingMarkerStyles()
  const label = kind === 'delivery' ? 'Delivery address' : 'Collection address'
  const accent = kind === 'delivery' ? '#059669' : '#ea580c'
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

const COLLECTION_PIN = '#0284c7'
const DELIVERY_PIN = '#e11d48'

function buildNumberedStopMarker(number, color, label) {
  ensureTrackingMarkerStyles()
  const wrap = document.createElement('div')
  wrap.className = 'smh-stop-pin'
  wrap.style.zIndex = '12'
  wrap.setAttribute('aria-label', label)
  const num = document.createElement('span')
  num.className = 'smh-stop-num'
  num.style.background = color
  num.textContent = String(number)
  const stem = document.createElement('span')
  stem.className = 'smh-stop-stem'
  stem.style.background = color
  wrap.appendChild(num)
  wrap.appendChild(stem)
  return wrap
}

function pointOffset(from, to, shift, metres = 160) {
  if (!from || !to) return [0, 0]
  const lng1 = Number(from.lng)
  const lat1 = Number(from.lat)
  const lng2 = Number(to.lng)
  const lat2 = Number(to.lat)
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return [0, 0]
  if (haversineMetres(lng1, lat1, lng2, lat2) > metres) return [0, 0]
  return shift
}

/** Collection = orange, delivery = green. The booked job route stays ShiftMyHome blue. */
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
function upsertRouteLine(map, coordinates, kind = 'collection', paint = null) {
  const coords = Array.isArray(coordinates)
    ? coordinates.filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    : []
  const colors = paint || routePaintForKind(kind)

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
      padding: { top: 72, bottom: 96, left: 48, right: 48 },
      maxZoom: 15,
      duration: 700,
      essential: true,
    })
  } catch {
    /* ignore fit errors */
  }
}

/**
 * Fit the booked route, both stops, and the van, with padding for the controls.
 * @param {mapboxgl.Map} map
 * @param {{ lng: number, lat: number } | null} driver
 * @param {Array<{ lng: number, lat: number } | null | undefined>} stops
 * @param {number[][] | null | undefined} routeCoordinates
 */
function fitOverview(map, driver, stops, routeCoordinates) {
  const bounds = new mapboxgl.LngLatBounds()
  let count = 0
  const add = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    bounds.extend([lng, lat])
    count += 1
  }
  add(Number(driver?.lng), Number(driver?.lat))
  for (const stop of stops || []) add(Number(stop?.lng), Number(stop?.lat))
  if (Array.isArray(routeCoordinates)) {
    for (const c of routeCoordinates) {
      if (!Array.isArray(c) || c.length < 2) continue
      add(Number(c[0]), Number(c[1]))
    }
  }
  if (count < 1) return
  try {
    if (count < 2 && Number.isFinite(Number(driver?.lng))) {
      map.easeTo({
        center: [Number(driver.lng), Number(driver.lat)],
        zoom: 14,
        duration: 600,
        essential: true,
      })
      return
    }
    map.fitBounds(bounds, {
      padding: { top: 48, bottom: 36, left: 36, right: 36 },
      maxZoom: 15,
      duration: 700,
      essential: true,
    })
  } catch {
    /* ignore fit errors */
  }
}

function syncNumberedPin(slotRef, map, point, number, color, label, offset, active) {
  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    try {
      slotRef.current?.remove()
    } catch {
      /* ignore */
    }
    slotRef.current = null
    return
  }
  const marker = slotRef.current
  if (!marker || marker.__pin !== number) {
    try {
      marker?.remove()
    } catch {
      /* ignore */
    }
    const el = buildNumberedStopMarker(number, color, label)
    el.classList.toggle('is-active', Boolean(active))
    slotRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset })
      .setLngLat([point.lng, point.lat])
      .addTo(map)
    slotRef.current.__pin = number
    return
  }
  marker.setLngLat([point.lng, point.lat])
  try {
    marker.setOffset(offset)
  } catch {
    /* ignore */
  }
  marker.getElement()?.classList.toggle('is-active', Boolean(active))
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
 *   collection?: { lng: number, lat: number } | null,
 *   delivery?: { lng: number, lat: number } | null,
 *   jobRouteCoordinates?: number[][] | null,
 *   routeControls?: boolean,
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
  collection = null,
  delivery = null,
  jobRouteCoordinates = null,
  routeControls = false,
  className = '',
}) {
  const hostRef = useRef(null)
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const collectionMarkerRef = useRef(null)
  const deliveryMarkerRef = useRef(null)
  const mapReadyRef = useRef(false)
  const lastFitKeyRef = useRef('')
  const driverMetaKeyRef = useRef('')
  const animFrameRef = useRef(0)
  const displayPosRef = useRef(/** @type {{ lng: number, lat: number } | null } */ (null))
  const headingRef = useRef(/** @type {number | null} */ (null))
  const followRef = useRef(!routeControls)
  const userInteractRef = useRef(false)
  const routeCoordsRef = useRef(routeCoordinates)
  const destRef = useRef(destination)
  const [error, setError] = useState('')
  const [camera, setCamera] = useState(routeControls ? 'overview' : 'follow')
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

  const collectionLng = Number(collection?.lng)
  const collectionLat = Number(collection?.lat)
  const deliveryLng = Number(delivery?.lng)
  const deliveryLat = Number(delivery?.lat)
  const collectionOk = Number.isFinite(collectionLng) && Number.isFinite(collectionLat)
  const deliveryOk = Number.isFinite(deliveryLng) && Number.isFinite(deliveryLat)
  const collectionPoint = collectionOk ? { lng: collectionLng, lat: collectionLat } : null
  const deliveryPoint = deliveryOk ? { lng: deliveryLng, lat: deliveryLat } : null
  const lineCoordinates = (Array.isArray(jobRouteCoordinates) && jobRouteCoordinates.length >= 2)
    ? jobRouteCoordinates
    : routeCoordinates
  const jobLine = Array.isArray(jobRouteCoordinates) && jobRouteCoordinates.length >= 2

  routeCoordsRef.current = lineCoordinates
  destRef.current = destination
  followRef.current = camera === 'follow'

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
        collectionMarkerRef.current?.remove()
      } catch {
        /* ignore */
      }
      collectionMarkerRef.current = null
      try {
        deliveryMarkerRef.current?.remove()
      } catch {
        /* ignore */
      }
      deliveryMarkerRef.current = null
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
        setCamera('free')
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
        if (followRef.current) {
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
      const driver = { lng, lat }
      const bothStops = Boolean(collectionPoint && deliveryPoint)

      if (bothStops) {
        const colShift = pointOffset(collectionPoint, driver, [-84, -4], 200)
        let delShift = pointOffset(deliveryPoint, collectionPoint, [40, 0], 80)
        const nearVan = pointOffset(deliveryPoint, driver, [84, -4], 200)
        if (nearVan[0] || nearVan[1]) delShift = nearVan
        syncNumberedPin(
          collectionMarkerRef,
          m,
          collectionPoint,
          1,
          COLLECTION_PIN,
          'Collection 1',
          colShift,
          stopKind !== 'delivery',
        )
        syncNumberedPin(
          deliveryMarkerRef,
          m,
          deliveryPoint,
          2,
          DELIVERY_PIN,
          'Delivery 2',
          delShift,
          stopKind === 'delivery',
        )
        try {
          destMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        destMarkerRef.current = null
      } else {
        try {
          collectionMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        collectionMarkerRef.current = null
        try {
          deliveryMarkerRef.current?.remove()
        } catch {
          /* ignore */
        }
        deliveryMarkerRef.current = null
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
      }

      try {
        upsertRouteLine(
          m,
          lineCoordinates,
          stopKind,
          jobLine ? { casing: '#075985', line: '#0284c7' } : null,
        )
      } catch (ex) {
        console.warn('[TrackingDriverMap] route update failed', ex)
      }

      const routeKey = Array.isArray(lineCoordinates)
        ? `${lineCoordinates.length}:${lineCoordinates[0]?.join(',')}:${lineCoordinates[lineCoordinates.length - 1]?.join(',')}`
        : 'none'
      const fitKey = `${collectionPoint ? `${collectionLng.toFixed(4)},${collectionLat.toFixed(4)}` : 'nocol'}|${deliveryPoint ? `${deliveryLng.toFixed(4)},${deliveryLat.toFixed(4)}` : 'nodel'}|${destOk ? `${destLng.toFixed(4)},${destLat.toFixed(4)}` : 'nodest'}|${routeKey}`
      if (fitKey !== lastFitKeyRef.current) {
        lastFitKeyRef.current = fitKey
        if (routeControls && camera === 'overview') {
          fitOverview(m, driver, [collectionPoint, deliveryPoint], lineCoordinates)
        } else if (!routeControls && followRef.current) {
          fitRouteBounds(
            m,
            driver,
            destOk ? { lng: destLng, lat: destLat } : null,
            lineCoordinates,
          )
        }
      }
    }

    if (mapReadyRef.current || map.isStyleLoaded()) apply()
    else map.once('load', apply)
    return undefined
  }, [
    collectionLng,
    collectionLat,
    deliveryLng,
    deliveryLat,
    destOk,
    destLng,
    destLat,
    stopKind,
    jobLine,
    lat,
    lng,
    routeControls,
    camera,
    lineCoordinates,
  ])

  const viewFullRoute = () => {
    userInteractRef.current = false
    followRef.current = false
    setCamera('overview')
    const map = mapRef.current
    if (!map || !coordsOk) return
    fitOverview(
      map,
      { lng, lat },
      [collectionPoint, deliveryPoint, destOk ? { lng: destLng, lat: destLat } : null],
      routeCoordsRef.current,
    )
  }

  const enableFollow = () => {
    userInteractRef.current = false
    followRef.current = true
    setCamera('follow')
    const map = mapRef.current
    if (!map || !coordsOk) return
    if (routeControls) {
      try {
        map.easeTo({
          center: [lng, lat],
          zoom: 15,
          duration: 500,
          essential: true,
        })
      } catch {
        /* ignore */
      }
      return
    }
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
      className={`relative flex w-full flex-col overflow-hidden bg-slate-200 ${className || 'h-80'}`}
    >
      {routeControls ? (
        <div className="smh-track-controls">
          <button
            type="button"
            className="smh-track-route"
            data-active={camera === 'overview' ? '1' : '0'}
            aria-pressed={camera === 'overview'}
            onClick={viewFullRoute}
          >
            View full route
          </button>
          <button
            type="button"
            className="smh-track-follow"
            data-active={camera === 'follow' ? '1' : '0'}
            aria-pressed={camera === 'follow'}
            onClick={enableFollow}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {camera === 'follow' ? 'Following' : 'Follow driver'}
          </button>
        </div>
      ) : null}
      <div className="relative min-h-0 w-full flex-1">
        <div
          ref={hostRef}
          className="smh-track-map-host absolute inset-0 h-full w-full"
          role="img"
          aria-label={name ? `Driver ${name} on map` : 'Driver location map'}
        />
        {routeControls ? null : (
          <button
            type="button"
            className="smh-track-follow"
            data-active={camera === 'follow' ? '1' : '0'}
            title={camera === 'follow' ? 'Following driver' : 'Follow driver'}
            aria-label={camera === 'follow' ? 'Following driver' : 'Follow driver'}
            aria-pressed={camera === 'follow'}
            onClick={enableFollow}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {camera === 'follow' ? 'Following' : 'Follow driver'}
          </button>
        )}
      {error ? (
        <p className="absolute inset-x-3 bottom-14 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
          Map could not load ({error}).{' '}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open in Google Maps
          </a>
        </p>
      ) : null}
      </div>
    </div>
  )
}
