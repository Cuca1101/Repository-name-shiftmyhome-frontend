import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

/**
 * Custom van pin + driver name label for the customer track map.
 * @param {{ driverName?: string, live?: boolean }} opts
 */
function buildVanMarkerElement({ driverName = '', live = false } = {}) {
  const label = String(driverName || 'Your driver').trim() || 'Your driver'
  const shortName = label.split(/\s+/)[0] || label
  const accent = live ? '#0284c7' : '#475569'
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-label', `Driver ${label}`)
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;user-select:none;'

  const van = document.createElement('div')
  van.innerHTML = `
    <svg width="52" height="36" viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="32" cy="40" rx="18" ry="3.5" fill="rgba(15,23,42,0.18)"/>
      <path d="M6 28 V16.5 C6 14 8 12 10.5 12 H34 L44 20 H54 C56.2 20 58 21.8 58 24 V28 Z" fill="${accent}"/>
      <path d="M34 12 L42.5 20 H34 Z" fill="#0369a1"/>
      <rect x="12" y="15" width="10" height="7" rx="1.5" fill="#e0f2fe"/>
      <rect x="24" y="15" width="8" height="7" rx="1.5" fill="#bae6fd"/>
      <path d="M36 15.5 L41 20 H36 Z" fill="#7dd3fc"/>
      <rect x="6" y="27" width="52" height="4" fill="#0f172a"/>
      <circle cx="18" cy="32" r="5" fill="#0f172a"/>
      <circle cx="18" cy="32" r="2.4" fill="#cbd5e1"/>
      <circle cx="48" cy="32" r="5" fill="#0f172a"/>
      <circle cx="48" cy="32" r="2.4" fill="#cbd5e1"/>
    </svg>
  `
  van.style.cssText = 'filter:drop-shadow(0 3px 6px rgba(15,23,42,0.35));line-height:0;'
  wrap.appendChild(van)

  const nameEl = document.createElement('div')
  nameEl.textContent = shortName.slice(0, 18)
  nameEl.style.cssText =
    'max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 12px Inter,Segoe UI,system-ui,sans-serif;padding:3px 8px;border-radius:9999px;background:#fff;border:1px solid rgba(15,23,42,0.12);color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,0.18);'
  wrap.appendChild(nameEl)

  if (!live) {
    const stale = document.createElement('div')
    stale.textContent = 'Last known'
    stale.style.cssText =
      'font:700 9px Inter,Segoe UI,system-ui,sans-serif;padding:1px 6px;border-radius:9999px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'
    wrap.appendChild(stale)
  }

  return wrap
}

/**
 * Customer tracking map. Recreates cleanly whenever the container remounts.
 * @param {{
 *   latitude: number,
 *   longitude: number,
 *   live?: boolean,
 *   driverName?: string,
 *   className?: string,
 * }} props
 */
export default function TrackingDriverMap({
  latitude,
  longitude,
  live = false,
  driverName = '',
  className = '',
}) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [error, setError] = useState('')
  const token = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()

  const lat = Number(latitude)
  const lng = Number(longitude)
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lng)
  const name = String(driverName || '').trim()

  useEffect(() => {
    if (!token || !coordsOk) {
      setError(!token ? 'Map token missing.' : 'Invalid coordinates.')
      return undefined
    }

    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    let resizeObserver = null
    let loadTimer = 0

    const tearDown = () => {
      try {
        markerRef.current?.remove()
      } catch {
        /* ignore */
      }
      markerRef.current = null
      try {
        mapRef.current?.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
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

    try {
      mapboxgl.accessToken = token
      host.style.width = '100%'
      host.style.minHeight = '16rem'
      host.style.height = host.style.height || '20rem'

      const map = new mapboxgl.Map({
        container: host,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lng, lat],
        zoom: 13,
        attributionControl: true,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')

      const el = buildVanMarkerElement({ driverName: name, live })
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)

      map.on('load', () => {
        if (cancelled) return
        resize()
        setError('')
      })
      map.on('error', (e) => {
        const msg = e?.error?.message || e?.message || 'Map failed to load'
        console.warn('[TrackingDriverMap]', msg, e?.error ?? e)
        if (!cancelled) setError(String(msg))
      })

      resize()
      loadTimer = window.setTimeout(resize, 50)
      window.setTimeout(resize, 250)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize())
        resizeObserver.observe(host)
      }
    } catch (ex) {
      console.error('[TrackingDriverMap] init failed', ex)
      setError(ex?.message || 'Could not start map')
      tearDown()
    }

    return () => {
      cancelled = true
      if (loadTimer) window.clearTimeout(loadTimer)
      resizeObserver?.disconnect()
      tearDown()
    }
  }, [token, coordsOk, lat, lng, live, name])

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
    <div className={className}>
      <div
        ref={hostRef}
        className="h-64 w-full overflow-hidden rounded-xl bg-slate-200 sm:h-80"
        role="img"
        aria-label={name ? `Driver ${name} on map` : 'Driver location map'}
      />
      {error ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Map could not load ({error}).{' '}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open location in Google Maps
          </a>
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
            Open in Google Maps
          </a>
        </p>
      )}
    </div>
  )
}
