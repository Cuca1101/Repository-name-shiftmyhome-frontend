import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { geocodeAddressCached } from '../../lib/operationsMapGeocodeCache'
import { fetchMapboxDrivingRoute } from '../../lib/operationsMapDirections'
import { buildSprinterVanElement } from '../tracking/sprinterVanMarker'

const MAP_FRAME =
  'relative h-[200px] min-h-[200px] w-full min-w-0 overflow-hidden sm:h-[240px] sm:min-h-[240px] md:h-[260px] md:min-h-[260px] min-[1500px]:h-full min-[1500px]:min-h-[320px] min-[1500px]:flex-1'

const ROUTE_SOURCE = 'lead-live-route'
const ROUTE_CASING = 'lead-live-route-casing'
const ROUTE_LINE = 'lead-live-route-line'

function finiteCoord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function locateAddress(address, token) {
  const text = String(address || '').trim()
  if (!text || !token) return null
  const direct = await geocodeAddressCached(text, token)
  if (direct) return direct
  if (!/united kingdom/i.test(text)) return geocodeAddressCached(`${text}, United Kingdom`, token)
  return null
}

function stopPin(number, color, label) {
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-label', label)
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'
  const num = document.createElement('span')
  num.textContent = String(number)
  num.style.cssText = `width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#fff;border:3px solid #fff;background:${color};font:800 16px Inter,Segoe UI,system-ui,sans-serif;box-shadow:0 2px 8px rgba(15,23,42,0.4);`
  const stem = document.createElement('span')
  stem.style.cssText = `width:3px;height:12px;border-radius:2px;background:${color};`
  wrap.appendChild(num)
  wrap.appendChild(stem)
  return wrap
}

function addLiveTraffic(map) {
  if (map.getSource('lead-mapbox-traffic')) return
  map.addSource('lead-mapbox-traffic', {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-traffic-v1',
  })
  map.addLayer({
    id: 'lead-mapbox-traffic',
    type: 'line',
    source: 'lead-mapbox-traffic',
    'source-layer': 'traffic',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': 2.5,
      'line-color': [
        'match',
        ['get', 'congestion'],
        'low',
        '#16a34a',
        'moderate',
        '#eab308',
        'heavy',
        '#f97316',
        'severe',
        '#dc2626',
        'transparent',
      ],
    },
  })
}

function addRoute(map, coordinates) {
  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  }
  if (map.getSource(ROUTE_SOURCE)) {
    map.getSource(ROUTE_SOURCE).setData(geojson)
    return
  }
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: geojson })
  map.addLayer({
    id: ROUTE_CASING,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#9a3412', 'line-width': 7, 'line-opacity': 0.28 },
  })
  map.addLayer({
    id: ROUTE_LINE,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ea580c', 'line-width': 4, 'line-opacity': 0.95 },
  })
}

/**
 * Collection → delivery map. Same streets style and live traffic colours as customer tracking.
 * @param {{
 *   pickupLng: number,
 *   pickupLat: number,
 *   deliveryLng: number,
 *   deliveryLat: number,
 *   token: string,
 *   onDriveTime?: (seconds: number | null) => void,
 *   frameClass?: string,
 *   driverLng?: number | null,
 *   driverLat?: number | null,
 *   driverLive?: boolean,
 *   driverWaiting?: boolean,
 *   driverName?: string,
 * }} props
 */
function LeadTrafficMap({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  token,
  onDriveTime,
  frameClass = MAP_FRAME,
  driverLng = null,
  driverLat = null,
  driverLive = false,
  driverWaiting = false,
  driverName = '',
}) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(0)
  const onDriveTimeRef = useRef(onDriveTime)
  onDriveTimeRef.current = onDriveTime

  useEffect(() => {
    const host = hostRef.current
    if (!host || !token) return undefined
    let cancelled = false
    const markers = []
    let map = null
    let timers = []
    let observer

    const start = () => {
      if (cancelled || map) return
      const box = host.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) return

    mapboxgl.accessToken = token
    map = new mapboxgl.Map({
      container: host,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [pickupLng, pickupLat],
      zoom: 11,
      attributionControl: true,
    })
    mapRef.current = map
    setMapReady((n) => n + 1)
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')

    const collection = new mapboxgl.Marker({ element: stopPin(1, '#ea580c', 'Collection'), anchor: 'bottom' })
      .setLngLat([pickupLng, pickupLat])
      .addTo(map)
    const delivery = new mapboxgl.Marker({ element: stopPin(2, '#059669', 'Delivery'), anchor: 'bottom' })
      .setLngLat([deliveryLng, deliveryLat])
      .addTo(map)
    markers.push(collection, delivery)

    const draw = async () => {
      if (cancelled) return
      try {
        addLiveTraffic(map)
      } catch {
        /* traffic tiles are optional; the route still draws */
      }
      let route = null
      try {
        route = await fetchMapboxDrivingRoute(
          { lng: pickupLng, lat: pickupLat },
          { lng: deliveryLng, lat: deliveryLat },
          token,
          { profile: 'driving-traffic', timeoutMs: 8000 },
        )
      } catch {
        route = null
      }
      if (cancelled || !mapRef.current) return
      const coordinates = route?.coordinates?.length >= 2
        ? route.coordinates
        : [[pickupLng, pickupLat], [deliveryLng, deliveryLat]]
      try {
        addRoute(map, coordinates)
        const bounds = coordinates.reduce(
          (box, pair) => box.extend(pair),
          new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
        )
        map.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 14 })
      } catch {
        /* ignore a map that was removed mid-draw */
      }
      onDriveTimeRef.current?.(Number.isFinite(route?.durationSeconds) ? route.durationSeconds : null)
    }

    const resize = () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }
    const onLoad = () => {
      resize()
      void draw()
    }
    if (map.isStyleLoaded()) onLoad()
    else map.once('load', onLoad)
    map.on('webglcontextrestored', resize)
    resize()
    timers = [80, 250, 600].map((ms) => window.setTimeout(resize, ms))
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => resize())
      observer.observe(host)
    }

    }

    start()
    let sizeObserver
    if (!map && typeof ResizeObserver !== 'undefined') {
      sizeObserver = new ResizeObserver(() => start())
      sizeObserver.observe(host)
    }

    return () => {
      cancelled = true
      sizeObserver?.disconnect()
      timers.forEach((id) => window.clearTimeout(id))
      observer?.disconnect()
      markers.forEach((marker) => {
        try {
          marker.remove()
        } catch {
          /* ignore */
        }
      })
      try {
        map.remove()
      } catch {
        /* ignore */
      }
      driverMarkerRef.current = null
      mapRef.current = null
    }
  }, [pickupLng, pickupLat, deliveryLng, deliveryLat, token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return undefined
    const lng = Number(driverLng)
    const lat = Number(driverLat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      try {
        driverMarkerRef.current?.remove()
      } catch {
        /* ignore */
      }
      driverMarkerRef.current = null
      return undefined
    }
    const label = String(driverName || 'Driver').trim() || 'Driver'
    const sig = `${label}|${driverLive ? 1 : 0}|${driverWaiting ? 1 : 0}`
    const current = driverMarkerRef.current
    if (!current || current.getElement()?.dataset.markerSig !== sig) {
      try {
        current?.remove()
      } catch {
        /* ignore */
      }
      const el = buildSprinterVanElement({
        name: label,
        live: Boolean(driverLive),
        stale: !driverLive && !driverWaiting,
        waitingGps: Boolean(driverWaiting),
      })
      el.dataset.markerSig = sig
      el.style.pointerEvents = 'none'
      driverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)
    } else {
      current.setLngLat([lng, lat])
    }
    return undefined
  }, [mapReady, driverLng, driverLat, driverLive, driverWaiting, driverName])

  return (
    <div
      ref={hostRef}
      className={`smh-lead-map-host ${frameClass} bg-slate-200`}
      role="img"
      aria-label={driverName ? `Live traffic map, tracking ${driverName}` : 'Route map with live traffic'}
    />
  )
}

/**
 * Collection → delivery map for a customer lead.
 * Saved wizard coordinates are used when present; otherwise the addresses are geocoded.
 * @param {{
 *   pickupAddress?: string,
 *   deliveryAddress?: string,
 *   pickupLng?: unknown,
 *   pickupLat?: unknown,
 *   deliveryLng?: unknown,
 *   deliveryLat?: unknown,
 *   onDriveTime?: (seconds: number | null) => void,
 *   frameClass?: string,
 *   driverLng?: number | null,
 *   driverLat?: number | null,
 *   driverLive?: boolean,
 *   driverWaiting?: boolean,
 *   driverName?: string,
 * }} props
 */
export default function CustomerLeadRouteMap({
  pickupAddress = '',
  deliveryAddress = '',
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  onDriveTime,
  frameClass,
  driverLng = null,
  driverLat = null,
  driverLive = false,
  driverWaiting = false,
  driverName = '',
}) {
  const token = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
  const [coords, setCoords] = useState({
    pickupLng: null,
    pickupLat: null,
    deliveryLng: null,
    deliveryLat: null,
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false
    const savedPickupLng = finiteCoord(pickupLng)
    const savedPickupLat = finiteCoord(pickupLat)
    const savedDeliveryLng = finiteCoord(deliveryLng)
    const savedDeliveryLat = finiteCoord(deliveryLat)
    const pickup = String(pickupAddress || '').trim()
    const delivery = String(deliveryAddress || '').trim()

    setCoords((current) => ({ ...current, loading: true, error: '' }))

    void (async () => {
      if (!pickup && !delivery && savedPickupLng == null && savedDeliveryLng == null) {
        if (!cancelled) {
          setCoords({
            pickupLng: null,
            pickupLat: null,
            deliveryLng: null,
            deliveryLat: null,
            loading: false,
            error: 'Add a collection and delivery address to show the route.',
          })
        }
        return
      }

      if (!token) {
        if (!cancelled) {
          setCoords({
            pickupLng: savedPickupLng,
            pickupLat: savedPickupLat,
            deliveryLng: savedDeliveryLng,
            deliveryLat: savedDeliveryLat,
            loading: false,
            error: 'Map is temporarily unavailable.',
          })
        }
        return
      }

      const [pickupHit, deliveryHit] = await Promise.all([
        savedPickupLng != null && savedPickupLat != null
          ? { lng: savedPickupLng, lat: savedPickupLat }
          : locateAddress(pickup, token),
        savedDeliveryLng != null && savedDeliveryLat != null
          ? { lng: savedDeliveryLng, lat: savedDeliveryLat }
          : locateAddress(delivery, token),
      ])
      if (cancelled) return
      const missing = []
      if (!pickupHit) missing.push('collection')
      if (!deliveryHit) missing.push('delivery')
      setCoords({
        pickupLng: pickupHit?.lng ?? null,
        pickupLat: pickupHit?.lat ?? null,
        deliveryLng: deliveryHit?.lng ?? null,
        deliveryLat: deliveryHit?.lat ?? null,
        loading: false,
        error: missing.length ? `Could not place the ${missing.join(' and ')} address on the map.` : '',
      })
    })().catch(() => {
      if (!cancelled) {
        setCoords((current) => ({
          ...current,
          loading: false,
          error: 'The route map could not be loaded.',
        }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [pickupAddress, deliveryAddress, pickupLng, pickupLat, deliveryLng, deliveryLat, token])

  const ready =
    coords.pickupLng != null &&
    coords.pickupLat != null &&
    coords.deliveryLng != null &&
    coords.deliveryLat != null

  if (coords.loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-sm text-slate-500 ${frameClass || MAP_FRAME}`}>
        Loading route map…
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-[120px] items-center justify-center bg-slate-50 px-4 text-center text-sm text-slate-600">
        {coords.error || 'The route map is not available for this lead.'}
      </div>
    )
  }

  return (
    <LeadTrafficMap
      pickupLng={coords.pickupLng}
      pickupLat={coords.pickupLat}
      deliveryLng={coords.deliveryLng}
      deliveryLat={coords.deliveryLat}
      token={token}
      onDriveTime={onDriveTime}
      frameClass={frameClass}
      driverLng={driverLng}
      driverLat={driverLat}
      driverLive={driverLive}
      driverWaiting={driverWaiting}
      driverName={driverName}
    />
  )
}
