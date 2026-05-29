import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { buildDriverMarkerElement } from './driverMarkerElement'

const UK = { lng: -2.5, lat: 53.5, zoom: 5.8 }

/**
 * Colourful roads / parks / water (Google‑Maps‑like readability), not monochrome dispatch.
 */
const OPERATIONS_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

const SRC = {
  legs: 'ops-src-job-legs',
  traveled: 'ops-src-route-traveled',
  remaining: 'ops-src-route-remaining',
  jLines: 'ops-src-journey-lines',
  jStops: 'ops-src-journey-stops',
  drivers: 'ops-src-drivers',
  heatmap: 'ops-src-heatmap',
  gpsTrail: 'ops-src-gps-trail',
  gpsStops: 'ops-src-gps-stops',
}

const LYR = {
  legShadow: 'ops-lyr-job-leg-shadow',
  legGlow: 'ops-lyr-job-leg-glow',
  legCasing: 'ops-lyr-job-leg-casing',
  legCore: 'ops-lyr-job-leg-core',
  legHit: 'ops-lyr-job-leg-hit',
  jGlow: 'ops-lyr-journey-glow',
  jCore: 'ops-lyr-journey-core',
  jStop: 'ops-lyr-j-stop',
  jStopLab: 'ops-lyr-j-stop-lab',
  drv: 'ops-lyr-driver',
  drvLab: 'ops-lyr-driver-lab',
  traveledCore: 'ops-lyr-traveled-core',
  remainingCore: 'ops-lyr-remaining-core',
  heatmap: 'ops-lyr-heatmap',
  gpsTrail: 'ops-lyr-gps-trail',
  gpsStops: 'ops-lyr-gps-stops',
}

const LEG_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' }

/** Pickup → delivery gradient per operations mode */
const ROUTE_GRADIENT_BY_MODE = {
  available: ['interpolate', ['linear'], ['line-progress'], 0, '#64748b', 0.5, '#3b82f6', 1, '#2563eb'],
  active: ['interpolate', ['linear'], ['line-progress'], 0, '#f59e0b', 0.45, '#fbbf24', 1, '#22c55e'],
  completed: ['interpolate', ['linear'], ['line-progress'], 0, '#60a5fa', 1, '#2563eb'],
  cancelled: ['interpolate', ['linear'], ['line-progress'], 0, '#f87171', 1, '#b91c1c'],
}

function routeGradientForMode(mode) {
  return ROUTE_GRADIENT_BY_MODE[mode] || ROUTE_GRADIENT_BY_MODE.available
}

function applyJobRouteVisualMode(map, mode) {
  const gradient = routeGradientForMode(mode)
  const cancelled = mode === 'cancelled'
  try {
    map.setPaintProperty(LYR.legCore, 'line-gradient', gradient)
    map.setPaintProperty(LYR.legCore, 'line-dasharray', cancelled ? [1.6, 1.1] : [1, 0])
    map.setPaintProperty(LYR.legCasing, 'line-dasharray', cancelled ? [1.6, 1.1] : [1, 0])
  } catch {
    /* layers not ready */
  }
}

const emptyFc = () => ({ type: 'FeatureCollection', features: [] })

/**
 * DOM marker wrapper: orange pickup (1) · green delivery (2) · job_ref label.
 * Anchored at geographic point; always above WebGL terrain.
 */
const MARKER_PIN_BG = {
  waiting: { pickup: '#64748b', delivery: '#3b82f6' },
  accepted: { pickup: '#f59e0b', delivery: '#d97706' },
  active: { pickup: '#22c55e', delivery: '#16a34a' },
  completed: { pickup: '#3b82f6', delivery: '#2563eb' },
  cancelled: { pickup: '#ef4444', delivery: '#b91c1c' },
}

function buildJobMarkerElement(quoteId, kind, jobRef, pointNum, isHighlighted, dispatchTone = 'waiting') {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.dataset.quoteId = quoteId
  wrap.dataset.kind = kind
  wrap.setAttribute('aria-label', `${kind === 'pickup' ? 'Pickup' : 'Delivery'} ${jobRef}`)
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.alignItems = 'center'
  wrap.style.gap = '2px'
  wrap.style.pointerEvents = 'auto'
  wrap.style.cursor = 'pointer'
  wrap.style.margin = '0'
  wrap.style.padding = '0'
  wrap.style.border = 'none'
  wrap.style.background = 'transparent'

  const pin = document.createElement('div')
  const isPickup = kind === 'pickup'
  pin.textContent = pointNum || (isPickup ? '1' : '2')
  pin.style.width = '32px'
  pin.style.height = '32px'
  pin.style.borderRadius = '9999px'
  pin.style.border = `3px solid ${isHighlighted ? '#fbbf24' : '#ffffff'}`
  pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)'
  pin.style.boxSizing = 'border-box'
  const palette = MARKER_PIN_BG[dispatchTone] || MARKER_PIN_BG.waiting
  pin.style.background = isPickup ? palette.pickup : palette.delivery
  pin.style.color = '#ffffff'
  pin.style.font = 'bold 13px system-ui,sans-serif'
  pin.style.display = 'flex'
  pin.style.alignItems = 'center'
  pin.style.justifyContent = 'center'
  if (isHighlighted) {
    pin.style.outline = '3px solid rgba(251,191,36,0.55)'
    pin.style.transform = 'scale(1.08)'
  } else {
    pin.style.transform = 'scale(1)'
  }

  const lab = document.createElement('div')
  lab.textContent = jobRef || quoteId.slice(0, 8)
  lab.style.maxWidth = '120px'
  lab.style.overflow = 'hidden'
  lab.style.textOverflow = 'ellipsis'
  lab.style.whiteSpace = 'nowrap'
  lab.style.font = 'bold 10px system-ui,sans-serif'
  lab.style.lineHeight = '1.15'
  lab.style.padding = '1px 4px'
  lab.style.borderRadius = '4px'
  lab.style.background = 'rgba(255,255,255,0.95)'
  lab.style.border = '1px solid rgba(15,23,42,0.12)'
  lab.style.color = '#0f172a'
  lab.style.pointerEvents = 'none'

  wrap.appendChild(pin)
  wrap.appendChild(lab)

  return wrap
}

/**
 * @param {{
 *   token: string | undefined,
 *   mode: string,
 *   jobLegs: GeoJSON.FeatureCollection,
 *   jobPoints: GeoJSON.FeatureCollection,
 *   journeyLines: GeoJSON.FeatureCollection,
 *   journeyStops: GeoJSON.FeatureCollection,
 *   drivers: GeoJSON.FeatureCollection,
 *   animatedDrivers?: { driverId: string, name: string, initials: string, lng: number, lat: number, bearing: number, moving: boolean, status: string, etaLabel?: string, online?: boolean }[],
 *   routeTraveled?: GeoJSON.FeatureCollection,
 *   routeRemaining?: GeoJSON.FeatureCollection,
 *   heatmapPoints?: GeoJSON.FeatureCollection,
 *   showHeatmap?: boolean,
 *   useRouteProgress?: boolean,
 *   selectedQuoteIds: string[],
 *   focusedQuoteId: string,
 *   focusedDriverId?: string,
 *   onPickQuote: (quoteId: string) => void,
 *   onPickJourney: (journeyId: string) => void,
 *   onPickDriver: (driverId: string) => void,
 *   diagnostics?: Record<string, string | number> | null,
 * }} props
 */
export default function OperationsMapboxCanvas({
  token,
  mode,
  jobLegs,
  jobPoints,
  journeyLines,
  journeyStops,
  drivers,
  animatedDrivers = [],
  routeTraveled,
  routeRemaining,
  heatmapPoints,
  gpsTrail,
  gpsStops,
  showHeatmap = false,
  useRouteProgress = false,
  selectedQuoteIds,
  focusedQuoteId,
  focusedDriverId = '',
  onPickQuote,
  onPickJourney,
  onPickDriver,
  diagnostics,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(/** @type {import('mapbox-gl').Map | null} */ (null))
  const jobMarkersRef = useRef(/** @type {import('mapbox-gl').Marker[]} */ ([]))
  const driverMarkersRef = useRef(/** @type {import('mapbox-gl').Marker[]} */ ([]))
  const driverMarkerElsRef = useRef(/** @type {Record<string, import('mapbox-gl').Marker>} */ ({}))
  const [styleReady, setStyleReady] = useState(false)
  const [domMarkerCount, setDomMarkerCount] = useState(0)

  const selectedLiteral = useMemo(() => (selectedQuoteIds || []).map(String).filter(Boolean), [selectedQuoteIds])

  const highlightQuoteIds = useMemo(() => {
    const s = new Set(selectedLiteral)
    const f = String(focusedQuoteId || '').trim()
    if (f) s.add(f)
    return [...s]
  }, [selectedLiteral, focusedQuoteId])

  const highlightSet = useMemo(() => new Set(highlightQuoteIds.map(String)), [highlightQuoteIds])

  const flushSources = useCallback(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const run = () => {
      if (!map.loaded()) {
        map.once('idle', run)
        return
      }
      try {
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.legs))?.setData(jobLegs || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.traveled))?.setData(routeTraveled || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.remaining))?.setData(routeRemaining || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.jLines))?.setData(journeyLines || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.jStops))?.setData(journeyStops || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.drivers))?.setData(drivers || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.heatmap))?.setData(heatmapPoints || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.gpsTrail))?.setData(gpsTrail || emptyFc())
        /** @type {import('mapbox-gl').GeoJSONSource} */ (map.getSource(SRC.gpsStops))?.setData(gpsStops || emptyFc())
      } catch {
        /* ignore */
      }
    }
    run()
  }, [styleReady, jobLegs, routeTraveled, routeRemaining, journeyLines, journeyStops, drivers, heatmapPoints, gpsTrail, gpsStops])

  /** Map boot (once per token): layers + guaranteed style-ready state for downstream effects */
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: OPERATIONS_MAP_STYLE,
      center: [UK.lng, UK.lat],
      zoom: UK.zoom,
      attributionControl: true,
      projection: 'mercator',
      renderWorldCopies: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    mapRef.current = map
    setStyleReady(false)

    const addOperationalLayers = () => {
      try {
        if (map.getSource(SRC.legs)) {
          setStyleReady(true)
          return
        }

        map.addSource(SRC.legs, { type: 'geojson', data: emptyFc(), lineMetrics: true })
        map.addLayer({
          id: LYR.legShadow,
          type: 'line',
          source: SRC.legs,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#0f172a',
            'line-width': 14,
            'line-opacity': 0.22,
            'line-blur': 4,
          },
        })
        map.addLayer({
          id: LYR.legGlow,
          type: 'line',
          source: SRC.legs,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#38bdf8',
            'line-width': 12,
            'line-opacity': 0.28,
            'line-blur': 2.5,
          },
        })
        map.addLayer({
          id: LYR.legCasing,
          type: 'line',
          source: SRC.legs,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#ffffff',
            'line-width': 7,
            'line-opacity': 0.92,
          },
        })
        map.addLayer({
          id: LYR.legCore,
          type: 'line',
          source: SRC.legs,
          layout: LEG_LAYOUT,
          paint: {
            'line-gradient': routeGradientForMode('available'),
            'line-width': 4.5,
            'line-opacity': 0.96,
          },
        })
        map.addLayer({
          id: LYR.legHit,
          type: 'line',
          source: SRC.legs,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#000000',
            'line-width': 26,
            'line-opacity': 0.003,
          },
        })
        applyJobRouteVisualMode(map, mode)

        map.addSource(SRC.jLines, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.jGlow,
          type: 'line',
          source: SRC.jLines,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#7c3aed',
            'line-width': 16,
            'line-opacity': 0.42,
            'line-blur': 3,
          },
        })
        map.addLayer({
          id: LYR.jCore,
          type: 'line',
          source: SRC.jLines,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#5b21b6', 'line-width': 5, 'line-opacity': 0.98 },
        })

        map.addSource(SRC.jStops, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.jStop,
          type: 'circle',
          source: SRC.jStops,
          paint: {
            'circle-radius': 12,
            'circle-color': '#a78bfa',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        })
        map.addLayer({
          id: LYR.jStopLab,
          type: 'symbol',
          source: SRC.jStops,
          layout: {
            'text-field': ['to-string', ['get', 'seq']],
            'text-size': 11,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#1e1b4b' },
        })

        map.addSource(SRC.gpsTrail, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.gpsTrail,
          type: 'line',
          source: SRC.gpsTrail,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#7c3aed',
            'line-width': 4,
            'line-opacity': 0.85,
          },
        })

        map.addSource(SRC.gpsStops, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.gpsStops,
          type: 'circle',
          source: SRC.gpsStops,
          paint: {
            'circle-radius': 8,
            'circle-color': '#f59e0b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        })

        map.addSource(SRC.drivers, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.drv,
          type: 'circle',
          source: SRC.drivers,
          paint: {
            'circle-radius': 20,
            'circle-color': '#2563eb',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          },
        })
        map.addLayer({
          id: LYR.drvLab,
          type: 'symbol',
          source: SRC.drivers,
          layout: {
            'text-field': ['get', 'initials'],
            'text-size': 12,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#ffffff' },
        })

        map.addSource(SRC.traveled, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.traveledCore,
          type: 'line',
          source: SRC.traveled,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#1d4ed8',
            'line-width': 6,
            'line-opacity': 0.95,
          },
        })

        map.addSource(SRC.remaining, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.remainingCore,
          type: 'line',
          source: SRC.remaining,
          layout: LEG_LAYOUT,
          paint: {
            'line-color': '#93c5fd',
            'line-width': 4,
            'line-opacity': 0.45,
            'line-dasharray': [1.5, 1.2],
          },
        })

        map.addSource(SRC.heatmap, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: LYR.heatmap,
          type: 'heatmap',
          source: SRC.heatmap,
          maxzoom: 14,
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 2.2],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(34,197,94,0)',
              0.35,
              'rgba(34,197,94,0.55)',
              0.65,
              'rgba(249,115,22,0.75)',
              1,
              'rgba(239,68,68,0.9)',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 12, 32],
            'heatmap-opacity': 0.65,
          },
        })

        setStyleReady(true)
      } catch {
        /* ignore */
      }
    }

    map.on('load', addOperationalLayers)

    return () => {
      setStyleReady(false)
      for (const m of jobMarkersRef.current) {
        try {
          m.remove()
        } catch {
          /* ignore */
        }
      }
      jobMarkersRef.current = []
      for (const m of driverMarkersRef.current) {
        try {
          m.remove()
        } catch {
          /* ignore */
        }
      }
      driverMarkersRef.current = []
      driverMarkerElsRef.current = {}
      try {
        map.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
    }
  }, [token])

  /** Push GeoJSON into sources whenever data or readiness changes (fixes stale empty map bug). */
  useEffect(() => {
    flushSources()
  }, [flushSources])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const showJobs = mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
    const showJ = mode === 'journeys'
    const showD = mode === 'drivers'
    const showProgress = showJobs && useRouteProgress && mode === 'active'
    const hideStdLegs = showProgress

    const vis = (show) => (show ? 'visible' : 'none')
    try {
      for (const id of [LYR.legShadow, LYR.legGlow, LYR.legCasing, LYR.legCore, LYR.legHit]) {
        map.setLayoutProperty(id, 'visibility', vis(showJobs && !hideStdLegs))
      }
      map.setLayoutProperty(LYR.traveledCore, 'visibility', vis(showProgress))
      map.setLayoutProperty(LYR.remainingCore, 'visibility', vis(showProgress))
      map.setLayoutProperty(LYR.heatmap, 'visibility', vis(showHeatmap && showJobs))
      map.setLayoutProperty(LYR.jGlow, 'visibility', vis(showJ))
      map.setLayoutProperty(LYR.jCore, 'visibility', vis(showJ))
      map.setLayoutProperty(LYR.jStop, 'visibility', vis(showJ))
      map.setLayoutProperty(LYR.jStopLab, 'visibility', vis(showJ))

      const useDomDrivers = (animatedDrivers?.length ?? 0) > 0
      map.setLayoutProperty(LYR.drv, 'visibility', vis(showD && !useDomDrivers))
      map.setLayoutProperty(LYR.drvLab, 'visibility', vis(showD && !useDomDrivers))
    } catch {
      /* layers not mounted */
    }
  }, [mode, styleReady, useRouteProgress, showHeatmap, animatedDrivers?.length])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    applyJobRouteVisualMode(map, mode)
  }, [mode, styleReady])

  const lastFitSigRef = useRef('')

  /** Reliable DOM markers for job pickups / deliveries — not affected by clustering or symbol fonts. */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    for (const m of jobMarkersRef.current) {
      try {
        m.remove()
      } catch {
        /* ignore */
      }
    }
    jobMarkersRef.current = []

    const showJobs =
      mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
    if (!showJobs || !jobPoints?.features?.length) {
      setDomMarkerCount(0)
      return
    }

    let placed = 0
    for (const f of jobPoints.features) {
      if (!f || f.geometry?.type !== 'Point') continue
      const c = f.geometry.coordinates
      if (!Array.isArray(c) || c.length < 2) continue
      const lng = Number(c[0])
      const lat = Number(c[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      /** Guard obviously wrong order (some bad geocoders return [lat,lng]) */
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) continue

      const pid = String(f.properties?.quoteId ?? '').trim()
      if (!pid) continue
      const kindRaw = String(f.properties?.kind ?? f.properties?.pointKind ?? '').toLowerCase()
      const kind = kindRaw === 'delivery' ? 'delivery' : 'pickup'

      const ref = String(f.properties?.jobRef ?? '').trim() || pid.slice(0, 8)
      const num = String(f.properties?.pointNum ?? (kind === 'pickup' ? '1' : '2'))
      const hi = highlightSet.has(pid)

      const tone = String(f.properties?.dispatchTone ?? 'waiting')
      const el = buildJobMarkerElement(pid, kind, ref, num, hi, tone)
      const pick = () => {
        try {
          onPickQuote(pid)
        } catch {
          /* ignore */
        }
      }
      el.addEventListener('click', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        pick()
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', pitchAlignment: 'map', rotationAlignment: 'map' })
        .setLngLat([lng, lat])
        .addTo(map)

      marker.getElement().style.zIndex = hi ? '12' : '10'
      jobMarkersRef.current.push(marker)
      placed += 1
    }
    setDomMarkerCount(placed)
  }, [styleReady, mode, jobPoints, highlightSet, onPickQuote])

  /** Smooth animated driver DOM markers (all modes when GPS available). */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    const list = animatedDrivers || []
    const activeIds = new Set(list.map((d) => String(d.driverId)))
    driverMarkersRef.current = []

    for (const id of Object.keys(driverMarkerElsRef.current)) {
      if (!activeIds.has(id)) {
        try {
          driverMarkerElsRef.current[id]?.remove()
        } catch {
          /* ignore */
        }
        delete driverMarkerElsRef.current[id]
      }
    }

    for (const d of list) {
      const id = String(d.driverId)
      if (!Number.isFinite(d.lng) || !Number.isFinite(d.lat)) continue
      const hi = String(focusedDriverId) === id
      let marker = driverMarkerElsRef.current[id]
      if (!marker) {
        const el = buildDriverMarkerElement({
          driverId: id,
          name: d.name,
          initials: d.initials,
          bearing: d.bearing,
          moving: d.moving,
          status: d.status,
          etaLabel: d.etaLabel,
          online: d.online,
          isFocused: hi,
          stale: d.stale,
        })
        el.addEventListener('click', (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          onPickDriver(id)
        })
        marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([d.lng, d.lat]).addTo(map)
        marker.getElement().style.zIndex = hi ? '20' : '15'
        driverMarkerElsRef.current[id] = marker
      } else {
        marker.setLngLat([d.lng, d.lat])
      }
      driverMarkersRef.current.push(marker)
    }
  }, [styleReady, animatedDrivers, focusedDriverId, onPickDriver])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    const showJobs =
      mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
    const sig = [
      mode,
      showJobs ? jobPoints?.features?.length ?? 0 : 0,
      showJobs ? jobLegs?.features?.length ?? 0 : 0,
      mode === 'journeys' ? journeyStops?.features?.length ?? 0 : 0,
      mode === 'drivers' ? drivers?.features?.length ?? 0 : 0,
    ].join('|')
    if (sig === lastFitSigRef.current) return
    lastFitSigRef.current = sig

    const idle = () => {
      try {
        const merged = new mapboxgl.LngLatBounds()
        let n = 0

        function extendPoint(lng, lat) {
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
          merged.extend([lng, lat])
          n += 1
        }

        function extendFc(fc) {
          for (const f of fc?.features || []) {
            const g = f.geometry
            if (!g) continue
            if (g.type === 'Point') {
              const c = g.coordinates
              if (Array.isArray(c) && c.length >= 2) extendPoint(Number(c[0]), Number(c[1]))
            } else if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
              for (const c of g.coordinates) {
                if (Array.isArray(c) && c.length >= 2) extendPoint(Number(c[0]), Number(c[1]))
              }
            }
          }
        }

        if (showJobs) {
          extendFc(jobPoints)
          extendFc(jobLegs)
        } else if (mode === 'journeys') {
          extendFc(journeyStops)
        } else if (mode === 'drivers') {
          extendFc(drivers)
          for (const d of animatedDrivers || []) {
            if (Number.isFinite(d.lng) && Number.isFinite(d.lat)) extendPoint(d.lng, d.lat)
          }
        }
        if (useRouteProgress && mode === 'active') {
          extendFc(routeTraveled)
          extendFc(routeRemaining)
        }

        if (n > 0 && !merged.isEmpty()) {
          map.fitBounds(merged, { padding: 88, maxZoom: 12.5, duration: 650, essential: true })
        }
      } catch {
        /* ignore */
      }
    }
    if (map.loaded()) map.once('idle', idle)
    else map.once('load', () => map.once('idle', idle))
  }, [styleReady, mode, jobPoints, jobLegs, journeyStops, drivers, animatedDrivers, routeTraveled, routeRemaining, useRouteProgress])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const showJobs =
      mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
    if (!showJobs) return

    const ids = highlightQuoteIds.length > 0 ? highlightQuoteIds : null

    try {
      if (!ids) {
        map.setPaintProperty(LYR.legShadow, 'line-opacity', 0.22)
        map.setPaintProperty(LYR.legShadow, 'line-width', 14)
        map.setPaintProperty(LYR.legGlow, 'line-opacity', 0.28)
        map.setPaintProperty(LYR.legGlow, 'line-width', 12)
        map.setPaintProperty(LYR.legCasing, 'line-opacity', 0.92)
        map.setPaintProperty(LYR.legCasing, 'line-width', 7)
        map.setPaintProperty(LYR.legCore, 'line-opacity', 0.96)
        map.setPaintProperty(LYR.legCore, 'line-width', 4.5)
        return
      }

      const inSel = ['in', ['get', 'quoteId'], ['literal', ids]]
      map.setPaintProperty(LYR.legShadow, 'line-opacity', ['case', inSel, 0.32, 0.12])
      map.setPaintProperty(LYR.legShadow, 'line-width', ['case', inSel, 17, 11])

      map.setPaintProperty(LYR.legGlow, 'line-opacity', ['case', inSel, 0.42, 0.14])
      map.setPaintProperty(LYR.legGlow, 'line-width', ['case', inSel, 15, 9])

      map.setPaintProperty(LYR.legCasing, 'line-opacity', ['case', inSel, 1, 0.55])
      map.setPaintProperty(LYR.legCasing, 'line-width', ['case', inSel, 8.5, 5.5])

      map.setPaintProperty(LYR.legCore, 'line-opacity', ['case', inSel, 1, 0.38])
      map.setPaintProperty(LYR.legCore, 'line-width', ['case', inSel, 6.2, 3.4])
    } catch {
      /* ignore */
    }
  }, [mode, styleReady, highlightQuoteIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    const showJobs =
      mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'

    const onJobSurfaceClick = (e) => {
      if (!showJobs) return

      const lineHits = map.queryRenderedFeatures(e.point, { layers: [LYR.legHit] })
      for (const f of lineHits) {
        const id = f?.properties?.quoteId != null ? String(f.properties.quoteId) : ''
        if (id) {
          e.originalEvent?.stopPropagation?.()
          onPickQuote(id)
          return
        }
      }
    }

    const onJourneyClick = (ev) => {
      if (mode !== 'journeys') return
      const feats = map.queryRenderedFeatures(ev.point, { layers: [LYR.jStop, LYR.jCore] })
      for (const f of feats) {
        const id = f?.properties?.journeyId != null ? String(f.properties.journeyId) : ''
        if (id) {
          onPickJourney(id)
          return
        }
      }
    }

    const onDriverClick = (ev) => {
      if (mode !== 'drivers') return
      const feats = map.queryRenderedFeatures(ev.point, { layers: [LYR.drv, LYR.drvLab] })
      const f = feats[0]
      const id = f?.properties?.driverId != null ? String(f.properties.driverId) : ''
      if (id) onPickDriver(id)
    }

    const ptr = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const def = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', onJobSurfaceClick)
    map.on('click', onJourneyClick)
    map.on('click', onDriverClick)
    map.on('mouseenter', LYR.legHit, ptr)
    map.on('mouseleave', LYR.legHit, def)
    map.on('mouseenter', LYR.jStop, ptr)
    map.on('mouseleave', LYR.jStop, def)
    map.on('mouseenter', LYR.drv, ptr)
    map.on('mouseleave', LYR.drv, def)
    map.on('mouseenter', LYR.drvLab, ptr)
    map.on('mouseleave', LYR.drvLab, def)

    return () => {
      map.off('click', onJobSurfaceClick)
      map.off('click', onJourneyClick)
      map.off('click', onDriverClick)
      map.off('mouseenter', LYR.legHit, ptr)
      map.off('mouseleave', LYR.legHit, def)
      map.off('mouseenter', LYR.jStop, ptr)
      map.off('mouseleave', LYR.jStop, def)
      map.off('mouseenter', LYR.drv, ptr)
      map.off('mouseleave', LYR.drv, def)
      map.off('mouseenter', LYR.drvLab, ptr)
      map.off('mouseleave', LYR.drvLab, def)
    }
  }, [mode, styleReady, onPickQuote, onPickJourney, onPickDriver])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ro = new ResizeObserver(() => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!token) {
    return (
      <div className="flex min-h-[520px] flex-1 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-950">
        Set <code className="rounded bg-white px-1.5 py-0.5 text-amber-900">VITE_MAPBOX_TOKEN</code> to enable the
        operations map.
      </div>
    )
  }

  return (
    <div className="relative isolate min-h-[520px] flex-1 overflow-visible rounded-2xl border border-slate-300/90 bg-white shadow-md ring-1 ring-slate-900/[0.06]">
      <div ref={containerRef} className="relative z-0 h-full min-h-[520px] w-full overflow-hidden rounded-2xl" />
      {token && (
        <div
          role="status"
          aria-label="Operations map diagnostics"
          className="pointer-events-none absolute bottom-3 left-3 z-[10002] max-w-[min(calc(100%-1rem),19rem)] rounded-lg bg-slate-900/92 px-2.5 py-2 font-mono text-[10px] leading-snug text-white shadow-xl ring-1 ring-white/10"
        >
          <span className="font-bold uppercase tracking-wide text-amber-200">Map debug </span>
          <span className="text-emerald-200">(remove later)</span>
          <dl className="mt-1.5 grid gap-x-3 gap-y-1 [grid-template-columns:auto_1fr]">
            {diagnostics
              ? Object.entries(diagnostics).map(([k, v]) => (
                  <FragmentRow key={k} k={k} v={v} />
                ))
              : null}
            <dt className="font-semibold text-slate-300">dom_markers</dt>
            <dd className="text-right tabular-nums text-amber-100">{domMarkerCount}</dd>
            <dt className="font-semibold text-slate-300">style_ready</dt>
            <dd className="text-right">{styleReady ? 'yes' : 'no'}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ k, v }) {
  return (
    <>
      <dt className="font-semibold text-slate-300">{k}</dt>
      <dd className="break-words text-right text-slate-50">{String(v)}</dd>
    </>
  )
}
