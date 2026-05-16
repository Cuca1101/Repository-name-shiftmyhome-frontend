import { Component, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { fetchDrivingRoute, metersToMiles } from '../../lib/mapboxRouteApi'

const UK_CENTER = { lng: -4.2, lat: 55.5 }
const UK_ZOOM = 5.2

const MSG_NO_TOKEN = 'Map unavailable - token missing'

const MSG_ROUTE_FAIL = 'Could not calculate route, please check addresses'

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.warn('[QuoteRouteMap] boundary', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[260px] min-h-[260px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center shadow-card ring-1 ring-slate-100">
          <p className="text-sm leading-relaxed text-slate-600">
            The map could not be displayed. You can still continue using manual distance in step 1.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function coordsPairReady(lng, lat) {
  return lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)
}

function coordsReady(plng, plat, dlng, dlat) {
  return coordsPairReady(plng, plat) && coordsPairReady(dlng, dlat)
}

function clearMarkers(markersRef) {
  markersRef.current.forEach((m) => {
    try {
      m.remove()
    } catch {
      /* ignore */
    }
  })
  markersRef.current = []
}

function clearRoute(map) {
  try {
    if (map.getLayer('route-line')) map.removeLayer('route-line')
    if (map.getSource('route')) map.removeSource('route')
  } catch {
    /* ignore */
  }
}

function mkMarkerEl(label, bg) {
  const el = document.createElement('div')
  el.textContent = label
  el.style.width = '36px'
  el.style.height = '36px'
  el.style.borderRadius = '9999px'
  el.style.backgroundColor = bg
  el.style.color = '#fff'
  el.style.fontWeight = '700'
  el.style.fontSize = '14px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.border = '3px solid #fff'
  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.25)'
  return el
}

/**
 * @param {{
 *   pickupLng: number | null,
 *   pickupLat: number | null,
 *   deliveryLng: number | null,
 *   deliveryLat: number | null,
 *   distanceMiles?: number,
 *   onDistanceFromRoute?: (payload: { type: 'ok', miles: number } | { type: 'failed' } | { type: 'incomplete' }) => void,
 * }} props
 */
function QuoteRouteMapInner({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  distanceMiles,
  onDistanceFromRoute,
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [mapReadyTick, setMapReadyTick] = useState(0)

  const [debounced, setDebounced] = useState(() => ({
    plng: pickupLng,
    plat: pickupLat,
    dlng: deliveryLng,
    dlat: deliveryLat,
  }))

  const [overlay, setOverlay] = useState(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced({
        plng: pickupLng,
        plat: pickupLat,
        dlng: deliveryLng,
        dlat: deliveryLat,
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [pickupLng, pickupLat, deliveryLng, deliveryLat])

  useEffect(() => {
    if (!token) {
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {
          /* ignore */
        }
        mapRef.current = null
      }
      setMapReadyTick(0)
      return
    }

    const el = containerRef.current
    if (!el || mapRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: el,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [UK_CENTER.lng, UK_CENTER.lat],
      zoom: UK_ZOOM,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
      setMapReadyTick((n) => n + 1)
    })

    map.on('error', (e) => {
      console.warn('[QuoteRouteMap] map error', e?.error ?? e)
    })

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {
          /* ignore */
        }
        mapRef.current = null
      }
      setMapReadyTick(0)
    }
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!token || !map) return

    let cancelled = false

    const run = async () => {
      if (!map.loaded()) {
        map.once('load', run)
        return
      }
      if (cancelled) return

      const { plng, plat, dlng, dlat } = debounced

      console.log('[QuoteRouteMap] Mapbox token exists:', true)
      console.log('[QuoteRouteMap] Pickup coordinates:', plng, plat)
      console.log('[QuoteRouteMap] Delivery coordinates:', dlng, dlat)
      console.log('[QuoteRouteMap] Stored distance (miles):', Number(distanceMiles) > 0 ? distanceMiles : '—')

      clearMarkers(markersRef)
      clearRoute(map)

      const pickupOk = coordsPairReady(plng, plat)
      const deliveryOk = coordsPairReady(dlng, dlat)

      try {
        map.resize()
      } catch {
        /* ignore */
      }

      if (coordsReady(plng, plat, dlng, dlat)) {
        setOverlay('calculating')
        const pickup = { lng: plng, lat: plat }
        const delivery = { lng: dlng, lat: dlat }
        let route
        try {
          route = await fetchDrivingRoute(pickup, delivery, token)
        } catch {
          route = null
        }
        if (cancelled) return

        const miles = route ? metersToMiles(route.distanceMeters) : null
        console.log('[QuoteRouteMap] Route distance (miles):', miles != null ? miles : '—')

        if (!route) {
          setOverlay('route-error')
          onDistanceFromRoute?.({ type: 'failed' })
          try {
            map.flyTo({
              center: [(pickup.lng + delivery.lng) / 2, (pickup.lat + delivery.lat) / 2],
              zoom: 8,
              duration: 0,
            })
          } catch {
            /* ignore */
          }
          const mA = new mapboxgl.Marker({ element: mkMarkerEl('A', '#2563eb'), anchor: 'bottom' })
            .setLngLat([pickup.lng, pickup.lat])
            .addTo(map)
          const mB = new mapboxgl.Marker({ element: mkMarkerEl('B', '#059669'), anchor: 'bottom' })
            .setLngLat([delivery.lng, delivery.lat])
            .addTo(map)
          markersRef.current = [mA, mB]
          return
        }

        if (typeof miles === 'number') {
          onDistanceFromRoute?.({ type: 'ok', miles })
        }

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#0284c7',
            'line-width': 5,
            'line-opacity': 0.88,
          },
        })

        const mA = new mapboxgl.Marker({ element: mkMarkerEl('A', '#2563eb'), anchor: 'bottom' })
          .setLngLat([pickup.lng, pickup.lat])
          .addTo(map)
        const mB = new mapboxgl.Marker({ element: mkMarkerEl('B', '#059669'), anchor: 'bottom' })
          .setLngLat([delivery.lng, delivery.lat])
          .addTo(map)
        markersRef.current = [mA, mB]

        const bounds = new mapboxgl.LngLatBounds()
        route.geometry.coordinates.forEach((coord) => bounds.extend(coord))
        map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 })
        setOverlay(null)
        return
      }

      onDistanceFromRoute?.({ type: 'incomplete' })
      setOverlay(null)

      if (pickupOk && !deliveryOk) {
        const mA = new mapboxgl.Marker({ element: mkMarkerEl('A', '#2563eb'), anchor: 'bottom' })
          .setLngLat([plng, plat])
          .addTo(map)
        markersRef.current = [mA]
        map.flyTo({ center: [plng, plat], zoom: 11, duration: 0 })
        return
      }

      if (deliveryOk && !pickupOk) {
        const mB = new mapboxgl.Marker({ element: mkMarkerEl('B', '#059669'), anchor: 'bottom' })
          .setLngLat([dlng, dlat])
          .addTo(map)
        markersRef.current = [mB]
        map.flyTo({ center: [dlng, dlat], zoom: 11, duration: 0 })
        return
      }

      map.flyTo({ center: [UK_CENTER.lng, UK_CENTER.lat], zoom: UK_ZOOM, duration: 0 })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [debounced, token, onDistanceFromRoute, distanceMiles, mapReadyTick])

  const showMap = Boolean(token)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card ring-1 ring-slate-100">
      {!showMap ? (
        <div className="flex h-[260px] min-h-[260px] w-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-center">
          <p className="text-sm leading-relaxed text-slate-700">{MSG_NO_TOKEN}</p>
        </div>
      ) : (
        <div className="relative h-[260px] min-h-[260px] w-full overflow-hidden rounded-2xl">
          <div ref={containerRef} className="h-full w-full" aria-label="Route map" />

          {overlay === 'calculating' && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80">
              <span
                className="h-9 w-9 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
                aria-hidden
              />
              <p className="mt-3 text-xs font-medium text-slate-600">Calculating route...</p>
            </div>
          )}

          {overlay === 'route-error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-4 text-center">
              <p className="max-w-[300px] text-sm leading-relaxed text-slate-700">{MSG_ROUTE_FAIL}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function QuoteRouteMap(props) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  console.log('[QuoteRouteMap] Mapbox token exists:', Boolean(token))

  return (
    <MapErrorBoundary>
      <QuoteRouteMapInner {...props} />
    </MapErrorBoundary>
  )
}
