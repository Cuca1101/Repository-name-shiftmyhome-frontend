import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { isDriverLocationStale } from '../../lib/data/driverLivePositionsRepository'
import { buildSprinterVanElement } from '../tracking/sprinterVanMarker'

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
 *   drivers?: { id: string, name?: string }[],
 * }} props
 */
export default function JourneyRouteMap({ stops, routeGeometry, className = '', drivers = [] }) {
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
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [UK_CENTER.lng, UK_CENTER.lat],
      zoom: UK_ZOOM,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    mapRef.current = map
    map.on('load', () => {
      try {
        if (!map.getSource('planner-mapbox-traffic')) {
          map.addSource('planner-mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1',
          })
          map.addLayer({
            id: 'planner-mapbox-traffic',
            type: 'line',
            source: 'planner-mapbox-traffic',
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
        const bg = s.kind === 'delivery' ? '#059669' : '#ea580c'
        const el = mkMarkerEl(String(s.sequence), bg)
        const m = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map)
        markersRef.current.push(m)
        bounds.extend([s.lng, s.lat])
      })

      let geometry = null
      if (routeGeometry && routeGeometry.type === 'LineString' && Array.isArray(routeGeometry.coordinates) && routeGeometry.coordinates.length >= 2) {
        geometry = routeGeometry
      } else if (valid.length >= 2) {
        geometry = {
          type: 'LineString',
          coordinates: valid.map((s) => [s.lng, s.lat]),
        }
      }

      if (geometry) {
        map.addSource('journey-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry,
          },
        })
        map.addLayer({
          id: 'journey-route-line',
          type: 'line',
          source: 'journey-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#0f172a', 'line-width': 5, 'line-opacity': 0.9 },
        })
        for (const ring of geometry.coordinates) {
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

  const driverKey = (drivers || []).map((d) => `${d.id}:${d.name || ''}`).join('|')
  const vanMarkersRef = useRef(/** @type {Record<string, mapboxgl.Marker>} */ ({}))
  const [driverStatus, setDriverStatus] = useState('')

  useEffect(() => {
    const map = mapRef.current
    if (!map || !tick) return undefined
    const list = (drivers || []).filter((d) => String(d?.id || '').trim())
    const active = new Set(list.map((d) => String(d.id)))
    for (const id of Object.keys(vanMarkersRef.current)) {
      if (!active.has(id)) {
        try {
          vanMarkersRef.current[id]?.remove()
        } catch {
          /* ignore */
        }
        delete vanMarkersRef.current[id]
      }
    }
    if (!list.length) {
      setDriverStatus('')
      return undefined
    }

    const firstStop = (stops || []).find(
      (s) => Number.isFinite(Number(s.lng)) && Number.isFinite(Number(s.lat)),
    )
    /** @type {Record<string, { lng: number, lat: number, live: boolean } | null>} */
    const fixes = {}
    let cancelled = false

    function paint() {
      if (cancelled || !mapRef.current) return
      let liveCount = 0
      let waiting = 0
      for (const d of list) {
        const id = String(d.id)
        const fix = fixes[id]
        const lng = fix ? fix.lng : firstStop ? Number(firstStop.lng) : null
        const lat = fix ? fix.lat : firstStop ? Number(firstStop.lat) : null
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
        const live = Boolean(fix?.live)
        if (live) liveCount += 1
        else waiting += 1
        const sig = `${d.name || ''}|${live ? 1 : 0}|${fix ? 1 : 0}`
        let marker = vanMarkersRef.current[id]
        if (!marker || marker.getElement()?.dataset.markerSig !== sig) {
          try {
            marker?.remove()
          } catch {
            /* ignore */
          }
          const el = buildSprinterVanElement({
            name: d.name || 'Driver',
            live,
            stale: Boolean(fix) && !live,
            waitingGps: !fix,
          })
          el.dataset.markerSig = sig
          marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(mapRef.current)
          marker.getElement().style.zIndex = '20'
          vanMarkersRef.current[id] = marker
        } else {
          marker.setLngLat([lng, lat])
        }
      }
      if (liveCount && !waiting) setDriverStatus(`${liveCount} driver${liveCount === 1 ? '' : 's'} live on this journey`)
      else if (waiting && !liveCount) setDriverStatus('On this journey · waiting for live GPS')
      else setDriverStatus(`${liveCount} live · ${waiting} waiting for GPS`)
    }

    paint()
    if (!isSupabaseConfigured || !supabase) return undefined

    const channels = []
    for (const d of list) {
      const id = String(d.id)
      void supabase
        .from('driver_locations')
        .select('latitude, longitude, updated_at')
        .eq('driver_id', id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data) return
          const lat = Number(data.latitude)
          const lng = Number(data.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
          const updatedAt = data.updated_at != null ? String(data.updated_at) : ''
          fixes[id] = { lng, lat, live: !isDriverLocationStale(updatedAt) }
          paint()
        })
      const channel = supabase
        .channel(`planner-track-${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${id}` },
          (payload) => {
            const row = payload.new
            const lat = Number(row?.latitude)
            const lng = Number(row?.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
            const updatedAt = row?.updated_at != null ? String(row.updated_at) : ''
            fixes[id] = { lng, lat, live: !isDriverLocationStale(updatedAt) }
            paint()
          },
        )
        .subscribe()
      channels.push(channel)
    }

    return () => {
      cancelled = true
      for (const channel of channels) {
        void supabase.removeChannel(channel)
      }
    }
  }, [tick, driverKey, stops, drivers])

  if (!token) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 ${className}`}
      >
        Map preview needs <code className="rounded bg-slate-200 px-1">VITE_MAPBOX_TOKEN</code>.
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="h-[min(58dvh,28rem)] min-h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
      />
      {driverStatus ? (
        <p className="mt-2 text-xs font-medium text-slate-600">{driverStatus}</p>
      ) : null}
    </div>
  )
}
