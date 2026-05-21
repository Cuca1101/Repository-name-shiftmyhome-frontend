import { geocodeAddress, fetchDrivingRouteWaypoints, metersToMiles } from './mapboxRouteApi'
import { computeJourneyTotals } from './journeyPlannerModel'

/**
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 * @param {string} token
 */
export async function geocodeStopsForJourney(stops, token) {
  if (!token) return stops.map((s) => ({ ...s }))
  const cache = new Map()
  const out = []
  for (const s of stops) {
    const key = String(s.address || '')
      .trim()
      .toLowerCase()
    if (!key || key === '—') {
      out.push({ ...s, lng: null, lat: null })
      continue
    }
    if (cache.has(key)) {
      const c = cache.get(key)
      out.push({ ...s, lng: c?.lng ?? null, lat: c?.lat ?? null })
      continue
    }
    const g = await geocodeAddress(s.address, token)
    cache.set(key, g)
    out.push({ ...s, lng: g?.lng ?? null, lat: g?.lat ?? null })
  }
  return out
}

/**
 * Recompute drive time, miles, and totals after stop list changes.
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 * @param {string} [mapboxToken]
 */
export async function recalculateJourneyRouteMetrics(stops, mapboxToken = '') {
  const token = String(mapboxToken || '').trim()
  const geo = await geocodeStopsForJourney(stops, token)

  let totalDriveSeconds = 0
  let totalMiles = 0
  /** @type {GeoJSON.LineString | null} */
  let routeGeometry = null
  let routingErr = ''

  const coords = geo
    .map((s) => ({ lng: s.lng, lat: s.lat }))
    .filter((c) => c.lng != null && c.lat != null && Number.isFinite(c.lng) && Number.isFinite(c.lat))

  if (geo.length >= 2 && coords.length < 2) {
    routingErr = 'Need at least two geocoded addresses to draw a road route.'
  } else if (coords.length >= 2 && token) {
    const route = await fetchDrivingRouteWaypoints(coords, token)
    if (route) {
      totalDriveSeconds = route.durationSeconds || 0
      totalMiles = metersToMiles(route.distanceMeters || 0)
      routeGeometry = route.geometry?.type === 'LineString' ? route.geometry : null
    } else {
      routingErr = 'Could not fetch driving route from Mapbox.'
    }
  } else if (coords.length >= 2 && !token) {
    routingErr = 'Add VITE_MAPBOX_TOKEN for driving times and map route.'
  }

  const totals = computeJourneyTotals(geo, totalDriveSeconds)

  return {
    stops: geo,
    totalDriveSeconds,
    totalMiles,
    totalServiceSeconds: totals.totalServiceSeconds,
    totalDurationSeconds: totals.totalDurationSeconds,
    jobsCount: totals.jobsCount,
    routeGeometry,
    routingErr,
  }
}
