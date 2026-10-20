import { Component, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { fetchDrivingRoute, metersToMiles } from '../../lib/mapboxRouteApi'
import useMobileQuoteLayout from '../../hooks/useMobileQuoteLayout'

/** Neutral Scotland overview — no city focus until addresses are chosen. */
const SCOTLAND_CENTER = { lng: -4.0, lat: 56.35 }
const SCOTLAND_ZOOM = 4.65
const ROUTE_FETCH_TIMEOUT_MS = 12000

const MSG_NO_TOKEN = 'Map unavailable - token missing'
const MSG_ROUTE_FAIL = 'Could not calculate route, please check addresses'
const MSG_ROUTE_TIMEOUT = 'Route is taking longer than expected. Check your connection or try again.'

const DEFAULT_MAP_SHELL =
  'relative h-[100px] min-h-[100px] xxs:h-[110px] xxs:min-h-[110px] xs:h-[130px] xs:min-h-[130px] mb:h-[160px] mb:min-h-[160px] sm:h-[200px] sm:min-h-[200px] lg:h-[260px] lg:min-h-[260px] w-full min-w-0 overflow-hidden rounded-2xl'
const COMPACT_MAP_SHELL = 'relative h-32 min-h-[8rem] w-full min-w-0 overflow-hidden rounded-lg md:rounded-2xl'
/** Step 3 review — compact route preview (logic unchanged). */
const REVIEW_MAP_SHELL =
  'relative h-[220px] min-h-[220px] w-full min-w-0 overflow-hidden md:h-[260px] md:min-h-[260px] lg:h-[300px] lg:min-h-[300px]'
/** Admin dispatch board — tall route visibility (Available / Job Accepted detail). */
const DISPATCH_MAP_SHELL =
  'relative h-[220px] min-h-[220px] sm:h-[260px] sm:min-h-[260px] md:h-[280px] md:min-h-[280px] lg:h-[300px] lg:min-h-[300px] xl:h-[320px] xl:min-h-[320px] w-full min-w-0 overflow-hidden'
/** Customer lead details — fills the route card, taller beside the action cards on a wide desktop. */
const LEAD_MAP_SHELL =
  'relative h-[200px] min-h-[200px] w-full min-w-0 overflow-hidden sm:h-[240px] sm:min-h-[240px] md:h-[260px] md:min-h-[260px] min-[1500px]:h-full min-[1500px]:min-h-[320px] min-[1500px]:flex-1'

const OUTER_DEFAULT =
  'quote-route-map w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-card ring-1 ring-slate-100 sm:rounded-2xl'
const OUTER_REVIEW =
  'quote-route-map quote-route-map--review w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm'
const OUTER_DISPATCH = 'quote-route-map quote-route-map--dispatch w-full min-w-0 overflow-hidden bg-slate-100'

function resolveMapVariant({ compact, variant }) {
  if (variant === 'review') return 'review'
  if (variant === 'lead') return 'lead'
  if (variant === 'dispatch') return 'dispatch'
  if (variant === 'compact' || compact) return 'compact'
  return 'default'
}

function mapVariantShellClass(variant) {
  if (variant === 'review') return REVIEW_MAP_SHELL
  if (variant === 'lead') return LEAD_MAP_SHELL
  if (variant === 'dispatch') return DISPATCH_MAP_SHELL
  if (variant === 'compact') return COMPACT_MAP_SHELL
  return DEFAULT_MAP_SHELL
}

function mapVariantBoundsPadding(variant) {
  if (variant === 'review') return { top: 56, bottom: 40, left: 40, right: 40 }
  if (variant === 'lead') return 28
  if (variant === 'compact') return 28
  if (variant === 'dispatch') return 36
  return 48
}

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

function finiteCoord(value) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function coordsPairReady(lng, lat) {
  return finiteCoord(lng) != null && finiteCoord(lat) != null
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
    if (map.getLayer('route-casing')) map.removeLayer('route-casing')
    if (map.getSource('route')) map.removeSource('route')
  } catch {
    /* ignore */
  }
}

/** Driving line above the basemap, with a light edge so it stays visible on the quote tiles. */
function drawRouteLine(map, geometry) {
  const data = {
    type: 'Feature',
    properties: {},
    geometry,
  }
  if (map.getSource('route')) {
    map.getSource('route').setData(data)
  } else {
    map.addSource('route', { type: 'geojson', data })
  }
  if (!map.getLayer('route-casing')) {
    map.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.95 },
    })
  }
  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0369a1', 'line-width': 5, 'line-opacity': 1 },
    })
  }
  if (map.getLayer('route-casing')) map.moveLayer('route-casing')
  if (map.getLayer('route-line')) map.moveLayer('route-line')
}

function safeBoundsPadding(map, variant) {
  const wanted = mapVariantBoundsPadding(variant)
  const box = typeof wanted === 'number' ? { top: wanted, bottom: wanted, left: wanted, right: wanted } : wanted
  const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null
  const width = canvas?.clientWidth || map.getContainer()?.clientWidth || 0
  const height = canvas?.clientHeight || map.getContainer()?.clientHeight || 0
  const maxX = Math.max(12, Math.floor(width / 2) - 12)
  const maxY = Math.max(12, Math.floor(height / 2) - 12)
  return {
    top: Math.min(box.top, maxY),
    bottom: Math.min(box.bottom, maxY),
    left: Math.min(box.left, maxX),
    right: Math.min(box.right, maxX),
  }
}

function fitRoute(map, bounds, variant) {
  if (!bounds || bounds.isEmpty()) return
  map.resize()
  map.fitBounds(bounds, {
    padding: safeBoundsPadding(map, variant),
    maxZoom: 14,
    duration: 0,
  })
}

/** Strip city/POI labels from the Mapbox basemap for a clean quote preview. */
function applyCleanQuoteBasemap(map) {
  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers) {
    const id = layer.id || ''
    if (layer.type !== 'symbol') continue

    const hideLabel =
      id.startsWith('place-') ||
      id.startsWith('poi-') ||
      id.startsWith('airport-') ||
      id.startsWith('transit-') ||
      id.startsWith('road-label') ||
      id.startsWith('road-number') ||
      id.startsWith('waterway-label')

    if (!hideLabel) continue

    try {
      map.setLayoutProperty(id, 'visibility', 'none')
    } catch {
      /* layer may not be ready */
    }
  }
}

function flyToNeutralScotland(map) {
  map.flyTo({
    center: [SCOTLAND_CENTER.lng, SCOTLAND_CENTER.lat],
    zoom: SCOTLAND_ZOOM,
    duration: 0,
  })
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
 *   variant?: 'default' | 'compact' | 'dispatch' | 'lead',
 *   onDistanceFromRoute?: (payload: { type: 'ok', miles: number, durationSeconds: number | null } | { type: 'failed' } | { type: 'incomplete' }) => void,
 * }} props
 */
function applyMobilePreviewMapGestures(map, mapVariant) {
  if (mapVariant === 'dispatch' || mapVariant === 'lead') return
  try {
    map.scrollZoom.disable()
    map.boxZoom.disable()
    map.dragRotate.disable()
    map.dragPan.disable()
    map.keyboard.disable()
    map.doubleClickZoom.disable()
    map.touchZoomRotate.disable()
  } catch {
    /* ignore */
  }
}

function QuoteRouteMapInner({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  compact = false,
  variant: variantProp,
  onDistanceFromRoute,
  shellClass = '',
}) {
  const mapVariant = resolveMapVariant({ compact, variant: variantProp })
  const isMobileLayout = useMobileQuoteLayout()
  const passScrollOnMobile = isMobileLayout && mapVariant !== 'dispatch' && mapVariant !== 'lead'
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const containerRef = useRef(null)
  const shellRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeRequestRef = useRef(0)
  const onDistanceRef = useRef(onDistanceFromRoute)
  const fittedBoundsRef = useRef(null)
  const [mapReadyTick, setMapReadyTick] = useState(0)

  const [debounced, setDebounced] = useState(() => ({
    plng: pickupLng,
    plat: pickupLat,
    dlng: deliveryLng,
    dlat: deliveryLat,
  }))

  const [overlay, setOverlay] = useState(null)

  onDistanceRef.current = onDistanceFromRoute

  const paintFittedRoute = () => {
    const map = mapRef.current
    const bounds = fittedBoundsRef.current
    if (!map || !bounds) return
    try {
      fitRoute(map, bounds, mapVariant)
    } catch {
      /* container may still be settling */
    }
  }

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
      fittedBoundsRef.current = null
      setMapReadyTick(0)
      return undefined
    }

    const shellEl = shellRef.current
    if (!shellEl) return undefined

    let disposed = false
    let settleTimer = 0

    const resizeMap = () => {
      const map = mapRef.current
      if (!map) return
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }

    const settleMap = () => {
      resizeMap()
      paintFittedRoute()
    }

    const initMap = () => {
      const el = containerRef.current
      if (disposed || mapRef.current || !el || !containerHasSize(el)) return

      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [SCOTLAND_CENTER.lng, SCOTLAND_CENTER.lat],
        zoom: SCOTLAND_ZOOM,
        attributionControl: true,
        fadeDuration: 0,
      })
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
      mapRef.current = map

      map.on('load', () => {
        if (disposed || mapRef.current !== map) return
        applyCleanQuoteBasemap(map)
        if (passScrollOnMobile) applyMobilePreviewMapGestures(map, mapVariant)
        settleMap()
        setMapReadyTick((n) => n + 1)
        window.requestAnimationFrame(() => {
          if (!disposed) settleMap()
        })
        settleTimer = window.setTimeout(() => {
          if (!disposed) settleMap()
        }, 250)
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
              settleMap()
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
                settleMap()
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
      window.clearTimeout(settleTimer)
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
  }, [token, mapVariant, passScrollOnMobile])

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
      if (cancelled || requestId !== routeRequestRef.current) return

      const plng = finiteCoord(debounced.plng)
      const plat = finiteCoord(debounced.plat)
      const dlng = finiteCoord(debounced.dlng)
      const dlat = finiteCoord(debounced.dlat)

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

        const geometry =
          route?.geometry?.coordinates?.length >= 2
            ? route.geometry
            : {
                type: 'LineString',
                coordinates: [
                  [pickup.lng, pickup.lat],
                  [delivery.lng, delivery.lat],
                ],
              }
        try {
          drawRouteLine(map, geometry)
        } catch (err) {
          console.warn('[QuoteRouteMap] draw', err)
        }

        const mA = new mapboxgl.Marker({ element: mkMarkerEl('A', '#2563eb'), anchor: 'bottom' })
          .setLngLat([pickup.lng, pickup.lat])
          .addTo(map)
        const mB = new mapboxgl.Marker({ element: mkMarkerEl('B', '#059669'), anchor: 'bottom' })
          .setLngLat([delivery.lng, delivery.lat])
          .addTo(map)
        markersRef.current = [mA, mB]

        const bounds = new mapboxgl.LngLatBounds()
        geometry.coordinates.forEach((coord) => bounds.extend(coord))
        bounds.extend([pickup.lng, pickup.lat])
        bounds.extend([delivery.lng, delivery.lat])
        fittedBoundsRef.current = bounds
        const frameRoute = () => {
          if (cancelled || requestId !== routeRequestRef.current) return
          try {
            if (map.getLayer('route-line')) map.moveLayer('route-line')
            fitRoute(map, bounds, mapVariant)
          } catch (err) {
            console.warn('[QuoteRouteMap] fit', err)
          }
        }
        frameRoute()
        window.requestAnimationFrame(frameRoute)
        window.setTimeout(frameRoute, 250)
        setOverlayIfCurrent(null)
        return
      }

      fittedBoundsRef.current = null
      onDistanceRef.current?.({ type: 'incomplete' })
      setOverlayIfCurrent(null)
      try {
        flyToNeutralScotland(map)
      } catch {
        /* ignore */
      }
    }

    const styleReady = () =>
      typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : map.loaded()

    let started = false
    let tries = 0
    let retryTimer = 0
    const onReady = () => {
      if (cancelled || started || requestId !== routeRequestRef.current) return
      if (!styleReady()) {
        tries += 1
        if (tries <= 40) {
          map.once('idle', onReady)
          window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(onReady, 150)
          return
        }
      }
      started = true
      void run()
    }

    if (styleReady()) onReady()
    else {
      map.once('load', onReady)
      map.once('idle', onReady)
    }

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      try {
        map.off('load', onReady)
        map.off('idle', onReady)
      } catch {
        /* ignore */
      }
    }
  }, [debounced, token, mapReadyTick, mapVariant])

  const showMap = Boolean(token)
  const mapShellClass = shellClass || mapVariantShellClass(mapVariant)
  const outerClass =
    mapVariant === 'lead'
      ? `${OUTER_DISPATCH} flex h-full min-h-0 flex-1 flex-col`
      : mapVariant === 'dispatch'
        ? OUTER_DISPATCH
        : mapVariant === 'review'
          ? OUTER_REVIEW
          : OUTER_DEFAULT
  const overlayMessage =
    overlay === 'route-error' ? MSG_ROUTE_FAIL : overlay === 'route-timeout' ? MSG_ROUTE_TIMEOUT : null

  return (
    <div className={`${outerClass}${passScrollOnMobile ? ' quote-route-map--pass-scroll' : ''}`}>
      {!showMap ? (
        <div className={`flex ${mapShellClass} items-center justify-center bg-slate-50 px-4 text-center`}>
          <p className="text-sm leading-relaxed text-slate-700">{MSG_NO_TOKEN}</p>
        </div>
      ) : (
        <div ref={shellRef} className={mapShellClass}>
          <div ref={containerRef} className="absolute inset-0 h-full w-full min-w-0" aria-label="Route map" />

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
