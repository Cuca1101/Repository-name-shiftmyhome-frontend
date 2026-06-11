import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { geocodeAddress } from '../../lib/mapboxRouteApi'
import {
  buildSeoCityGeocodeQuery,
  getStaticSeoCityCenter,
} from '../../lib/seo/seoCityMapCoords'

/** @param {[number, number]} center @param {number} radiusKm @param {number} [points] */
function circlePolygon(center, radiusKm, points = 64) {
  const [lng, lat] = center
  const kmPerDegLat = 110.574
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180)
  const ring = []
  for (let i = 0; i < points; i += 1) {
    const theta = (i / points) * Math.PI * 2
    ring.push([lng + (radiusKm / kmPerDegLng) * Math.cos(theta), lat + (radiusKm / kmPerDegLat) * Math.sin(theta)])
  }
  ring.push(ring[0])
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }
}

/** @param {mapboxgl.Map} map @param {number} lng @param {number} lat @param {number} radiusKm */
function fitMapToServiceCircle(map, lng, lat, radiusKm) {
  const ring = circlePolygon([lng, lat], radiusKm).geometry.coordinates[0]
  const bounds = new mapboxgl.LngLatBounds(ring[0], ring[0])
  for (const coord of ring) {
    bounds.extend(coord)
  }
  map.fitBounds(bounds, {
    padding: { top: 52, bottom: 52, left: 52, right: 52 },
    maxZoom: 11,
    duration: 0,
  })
}

/**
 * City-focused Mapbox map for SEO landing pages.
 *
 * @param {{ cityName: string, className?: string }} props
 */
export default function SeoCityMap({ cityName, className = '' }) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [label, setLabel] = useState(cityName)

  useEffect(() => {
    if (!token || !containerRef.current) {
      setStatus(token ? 'loading' : 'unavailable')
      return
    }

    let cancelled = false

    async function init() {
      setStatus('loading')
      let center = getStaticSeoCityCenter(cityName)
      if (!center) {
        const geocoded = await geocodeAddress(buildSeoCityGeocodeQuery(cityName), token)
        if (cancelled) return
        if (!geocoded) {
          setStatus('error')
          return
        }
        center = { ...geocoded, zoom: 11.2, radiusKm: 7 }
      }

      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [center.lng, center.lat],
        zoom: center.radiusKm > 0 ? Math.max(center.zoom - 1.5, 8) : center.zoom,
        interactive: true,
        attributionControl: true,
      })
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
      map.scrollZoom.disable()

      map.on('load', () => {
        if (cancelled) return

        const pin = document.createElement('div')
        pin.className = 'seo-city-map-pin'
        pin.setAttribute('aria-hidden', 'true')
        markerRef.current = new mapboxgl.Marker({ element: pin, anchor: 'bottom' })
          .setLngLat([center.lng, center.lat])
          .addTo(map)

        if (center.radiusKm > 0) {
          const sourceId = 'seo-city-area'
          map.addSource(sourceId, {
            type: 'geojson',
            data: circlePolygon([center.lng, center.lat], center.radiusKm),
          })
          map.addLayer({
            id: 'seo-city-area-fill',
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#2563eb',
              'fill-opacity': 0.22,
            },
          })
          map.addLayer({
            id: 'seo-city-area-line',
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#059669',
              'line-width': 2.5,
              'line-opacity': 0.75,
            },
          })
          fitMapToServiceCircle(map, center.lng, center.lat, center.radiusKm)
        }

        setLabel(cityName === 'Scotland' ? 'Scotland' : cityName)
        setStatus('ready')
        window.requestAnimationFrame(() => {
          try {
            map.resize()
            if (center.radiusKm > 0) {
              fitMapToServiceCircle(map, center.lng, center.lat, center.radiusKm)
            }
          } catch {
            /* ignore */
          }
        })
      })

      mapRef.current = map
    }

    init()

    return () => {
      cancelled = true
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [cityName, token])

  const heading =
    cityName === 'Scotland'
      ? 'Scotland coverage map'
      : `${cityName} service area`

  return (
    <section className={`seo-section seo-section--white ${className}`.trim()} aria-labelledby="seo-city-map-heading">
      <div className="seo-section-inner">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8">
          <div>
            <h2 id="seo-city-map-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {heading}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              {cityName === 'Scotland'
                ? 'We quote removals and man-with-van jobs across Scottish cities and towns — search your area and book online.'
                : `Local crews cover ${cityName} and nearby neighbourhoods. The map shows the area we serve for removals and van jobs in ${cityName}.`}
            </p>
            {status === 'ready' ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200/80">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Active in {label}
              </p>
            ) : null}
          </div>

          <div className="seo-city-map-shell relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-md ring-1 ring-slate-900/5">
            {!token ? (
              <div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-slate-600 sm:min-h-[340px]">
                Map preview unavailable — request a quote and we&apos;ll confirm coverage for {cityName}.
              </div>
            ) : (
              <>
                <div
                  ref={containerRef}
                  className="seo-city-map-canvas min-h-[280px] h-[280px] w-full sm:min-h-[340px] sm:h-[340px]"
                  role="img"
                  aria-label={
                    cityName === 'Scotland'
                      ? 'Map of Scotland showing ShiftMyHome coverage'
                      : `Map centred on ${cityName} showing the local service area`
                  }
                />
                {status === 'loading' ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-600">
                    Loading map…
                  </div>
                ) : null}
                {status === 'error' ? (
                  <div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-slate-600 sm:min-h-[340px]">
                    Could not load map for {cityName}. Start a quote — we&apos;ll confirm your postcode.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
