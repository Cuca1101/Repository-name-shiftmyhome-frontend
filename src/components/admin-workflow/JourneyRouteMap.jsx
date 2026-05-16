import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

const UK_CENTER = { lng: -2.5, lat: 53.5 }
const UK_ZOOM = 6

/**
 * @param {string} seq
 * @param {string} bg
 */
function mkMarkerEl(seq, bg) {
  const el = document.createElement('div')
  el.textContent = seq
  el.style.width = '34px'
  el.style.height = '34px'
  el.style.borderRadius = '9999px'
  el.style.backgroundColor = bg
  el.style.color = '#fff'
  el.style.fontWeight = '700'
  el.style.fontSize = '13px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.border = '3px solid #fff'
  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.25)'
  return el
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
    if (map.getLayer('journey-route-line')) map.removeLayer('journey-route-line')
    if (map.getSource('journey-route')) map.removeSource('journey-route')
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   stops: { lng: number, lat: number, sequence: number, kind: 'pickup' | 'delivery' }[],
 *   routeGeometry: GeoJSON.LineString | GeoJSON.MultiLineString | null,
 *   className?: string,
 * }} props
 */
export default function JourneyRouteMap({ stops, routeGeometry, className = '' }) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!token) return
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
      setTick((n) => n + 1)
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
      markersRef.current = []
    }
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!token || !map) return
    const run = () => {
      if (!map.loaded()) {
        map.once('load', run)
        return
      }
      clearMarkers(markersRef)
      clearRoute(map)

      const valid = (stops || []).filter(
        (s) => s.lng != null && s.lat != null && Number.isFinite(s.lng) && Number.isFinite(s.lat),
      )
      const bounds = new mapboxgl.LngLatBounds()

      valid.forEach((s) => {
        const bg = s.kind === 'delivery' ? '#059669' : '#4f46e5'
        const el = mkMarkerEl(String(s.sequence), bg)
        const m = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map)
        markersRef.current.push(m)
        bounds.extend([s.lng, s.lat])
      })

      if (routeGeometry && routeGeometry.type === 'LineString' && Array.isArray(routeGeometry.coordinates)) {
        map.addSource('journey-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry,
          },
        })
        map.addLayer({
          id: 'journey-route-line',
          type: 'line',
          source: 'journey-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#1e293b', 'line-width': 4, 'line-opacity': 0.85 },
        })
        for (const ring of routeGeometry.coordinates) {
          if (Array.isArray(ring) && ring.length >= 2) bounds.extend(ring)
        }
      }

      if (!bounds.isEmpty()) {
        try {
          map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 })
        } catch {
          /* ignore */
        }
      } else {
        map.setCenter([UK_CENTER.lng, UK_CENTER.lat])
        map.setZoom(UK_ZOOM)
      }
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }
    run()
  }, [token, tick, stops, routeGeometry])

  if (!token) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 ${className}`}
      >
        Map preview needs <code className="rounded bg-slate-200 px-1">VITE_MAPBOX_TOKEN</code>.
      </div>
    )
  }

  return <div ref={containerRef} className={`min-h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${className}`} />
}
