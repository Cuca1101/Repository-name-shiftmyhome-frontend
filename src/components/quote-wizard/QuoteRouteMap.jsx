import { Component, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { fetchDrivingRoute, metersToMiles } from '../../lib/mapboxRouteApi'

const UK_CENTER = { lng: -4.2, lat: 55.5 }
const UK_ZOOM = 5.2
const ROUTE_FETCH_TIMEOUT_MS = 12000

const MSG_NO_TOKEN = 'Map unavailable - token missing'
const MSG_ROUTE_FAIL = 'Could not calculate route, please check addresses'
const MSG_ROUTE_TIMEOUT = 'Route is taking longer than expected. Check your connection or try again.'

const DEFAULT_MAP_SHELL =
  'relative h-[100px] min-h-[100px] xxs:h-[110px] xxs:min-h-[110px] xs:h-[130px] xs:min-h-[130px] mb:h-[160px] mb:min-h-[160px] sm:h-[200px] sm:min-h-[200px] lg:h-[260px] lg:min-h-[260px] w-full min-w-0 overflow-hidden rounded-2xl'
const COMPACT_MAP_SHELL = 'relative h-24 min-h-[6rem] w-full min-w-0 overflow-hidden rounded-lg md:rounded-2xl'

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
        <div className="h-[100px] min-h-[100px] xxs:h-[110px] xxs:min-h-[110px] xs:h-[130px] xs:min-h-[130px] mb:h-[160px] mb:min-h-[160px] sm:h-[200px] sm:min-h-[200px] lg:h-[260px] lg:min-h-[260px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center shadow-card ring-1 ring-slate-100">
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

function containerHasSize(el) {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return rect.width >= 2 && rect.height >= 2
}

function fetchDrivingRouteTimed(a, b, token, ms = ROUTE_FETCH_TIMEOUT_MS) {
  return Promise.race([
    fetchDrivingRoute(a, b, token).then((route) => ({ route, timedOut: false })),
    new Promise((resolve) => {
      window.setTimeout(() => resolve({ route: null, timedOut: true }), ms)
    }),
  ])
}

/**
 * @param {{
 *   pickupLng: number | null,
 *   pickupLat: number | null,
 *   deliveryLng: number | null,
 *   deliveryLat: number | null,
 *   distanceMiles?: number,
 *   compact?: boolean,
 *   onDistanceFromRoute?: (payload: { type: 'ok', miles: number, durationSeconds: number | null } | { type: 'failed' } | { type: 'incomplete' }) => void,
 * }} props
 */
function QuoteRouteMapInner({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  compact = false,
  onDistanceFromRoute,
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const containerRef = useRef(null)
  const shellRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeRequestRef = useRef(0)
  const onDistanceRef = useRef(onDistanceFromRoute)
  const [mapReadyTick, setMapReadyTick] = useState(0)

  const [debounced, setDebounced] = useState(() => ({
    plng: pickupLng,
    plat: pickupLat,
    dlng: deliveryLng,
    dlat: deliveryLat,
  }))

  const [overlay, setOverlay] = useState(null)

  onDistanceRef.current = onDistanceFromRoute

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
      return undefined
    }

    const shellEl = shellRef.current
    if (!shellEl) return undefined

    let disposed = false

    const resizeMap = () => {
      const map = mapRef.current
      if (!map) return
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }

    const initMap = () => {
      const el = containerRef.current
      if (disposed || mapRef.current || !el || !containerHasSize(el)) return

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
        resizeMap()
        setMapReadyTick((n) => n + 1)
      })

      map.on('error', (e) => {
        console.warn('[QuoteRouteMap] map error', e?.error ?? e)
      })
    }

    initMap()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (mapRef.current) {
              resizeMap()
            } else {
              initMap()
            }
          })
        : null
    resizeObserver?.observe(shellEl)

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) return
              if (mapRef.current) {
                resizeMap()
                setMapReadyTick((n) => n + 1)
              } else {
                initMap()
              }
            },
            { threshold: 0.01 },
          )
        : null
    intersectionObserver?.observe(shellEl)

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
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
  }, [token, compact])

  useEffect(() => {
    const map = mapRef.current
    if (!token || !map) return undefined

    let cancelled = false
    const requestId = ++routeRequestRef.current

    const setOverlayIfCurrent = (value) => {
      if (!cancelled && requestId === routeRequestRef.current) {
        setOverlay(value)
      }
    }

    const run = async () => {
      if (!map.loaded()) {
        return
      }
      if (cancelled || requestId !== routeRequestRef.current) return

      const { plng, plat, dlng, dlat } = debounced

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
        setOverlayIfCurrent('calculating')
        const pickup = { lng: plng, lat: plat }
        const delivery = { lng: dlng, lat: dlat }
        const { route, timedOut } = await fetchDrivingRouteTimed(pickup, delivery, token)
        if (cancelled || requestId !== routeRequestRef.current) return

        const miles = route ? metersToMiles(route.distanceMeters) : null

        if (!route) {
          setOverlayIfCurrent(timedOut ? 'route-timeout' : 'route-error')
          onDistanceRef.current?.({ type: 'failed' })
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
          const durationSeconds =
            typeof route.durationSeconds === 'number' && Number.isFinite(route.durationSeconds)
              ? route.durationSeconds
              : null
          onDistanceRef.current?.({
            type: 'ok',
            miles,
            durationSeconds: durationSeconds != null && durationSeconds > 0 ? durationSeconds : null,
          })
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
        map.fitBounds(bounds, { padding: compact ? 28 : 48, maxZoom: 12, duration: 0 })
        setOverlayIfCurrent(null)
        return
      }

      onDistanceRef.current?.({ type: 'incomplete' })
      setOverlayIfCurrent(null)

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

    const onMapLoad = () => {
      void run()
    }

    if (!map.loaded()) {
      map.once('load', onMapLoad)
    } else {
      void run()
    }

    return () => {
      cancelled = true
      if (!map.loaded()) {
        try {
          map.off('load', onMapLoad)
        } catch {
          /* ignore */
        }
      }
    }
  }, [debounced, token, mapReadyTick, compact])

  const showMap = Boolean(token)
  const mapShellClass = compact ? COMPACT_MAP_SHELL : DEFAULT_MAP_SHELL
  const overlayMessage =
    overlay === 'route-error' ? MSG_ROUTE_FAIL : overlay === 'route-timeout' ? MSG_ROUTE_TIMEOUT : null

  return (
    <div className="quote-route-map w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-card ring-1 ring-slate-100 sm:rounded-2xl">
      {!showMap ? (
        <div className={`flex ${mapShellClass} items-center justify-center bg-slate-50 px-4 text-center`}>
          <p className="text-sm leading-relaxed text-slate-700">{MSG_NO_TOKEN}</p>
        </div>
      ) : (
        <div ref={shellRef} className={mapShellClass}>
          <div ref={containerRef} className="h-full w-full min-w-0" aria-label="Route map" />

          {overlay === 'calculating' && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80">
              <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent md:h-9 md:w-9"
                aria-hidden
              />
              <p className="mt-2 text-[11px] font-medium text-slate-600 md:mt-3 md:text-xs">
                Calculating route...
              </p>
            </div>
          )}

          {overlayMessage ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-4 text-center">
              <p className="max-w-[300px] text-xs leading-relaxed text-slate-700 md:text-sm">{overlayMessage}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function QuoteRouteMap(props) {
  return (
    <MapErrorBoundary>
      <QuoteRouteMapInner {...props} />
    </MapErrorBoundary>
  )
}
