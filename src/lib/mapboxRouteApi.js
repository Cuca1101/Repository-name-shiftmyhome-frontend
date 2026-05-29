/**
 * Mapbox Geocoding + Directions (REST). All functions fail soft (return null / empty / catch).
 */

export function metersToMiles(meters) {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return 0
  return Math.round(meters * 0.000621371 * 10) / 10
}

/**
 * Autocomplete search (Geocoding API). Returns suggestions with coordinates for selection.
 * @param {string} query
 * @param {string} token
 * @returns {Promise<Array<{ id: string, placeName: string, lng: number, lat: number }>>}
 */
export async function searchGeocodingSuggestions(query, token) {
  if (!query?.trim() || query.trim().length < 2 || !token) return []
  try {
    const path = encodeURIComponent(query.trim())
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('autocomplete', 'true')
    url.searchParams.set('limit', '6')
    url.searchParams.set(
      'types',
      'country,region,district,place,locality,neighborhood,address,postcode',
    )
    url.searchParams.set('country', 'gb')
    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || [])
      .map((f) => {
        const c = f.center
        if (!Array.isArray(c) || c.length < 2) return null
        return {
          id: f.id,
          placeName: f.place_name || f.text || '',
          lng: c[0],
          lat: c[1],
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * @param {string} query
 * @param {string} token
 * @returns {Promise<{ lng: number, lat: number } | null>}
 */
export async function geocodeAddress(query, token) {
  if (!query?.trim() || !token) return null
  try {
    const path = encodeURIComponent(query.trim())
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('limit', '1')
    url.searchParams.set('country', 'gb')
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    const c = data.features?.[0]?.center
    if (!Array.isArray(c) || c.length < 2) return null
    return { lng: c[0], lat: c[1] }
  } catch {
    return null
  }
}

/**
 * @param {{ lng: number, lat: number }} a
 * @param {{ lng: number, lat: number }} b
 * @param {string} token
 * @returns {Promise<{ geometry: object, distanceMeters: number, durationSeconds: number } | null>}
 */
export async function fetchDrivingRoute(a, b, token) {
  if (!a || !b || !token) return null
  try {
    const coordStr = `${a.lng},${a.lat};${b.lng},${b.lat}`
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}`,
    )
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('access_token', token)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route?.geometry) return null
    return {
      geometry: route.geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    }
  } catch {
    return null
  }
}

const MAPBOX_DIRECTIONS_MAX_COORDS = 25

/**
 * Multi-waypoint driving route (Mapbox Directions API, up to 25 coordinates).
 * @param {{ lng: number, lat: number }[]} coords ordered along the journey
 * @param {string} token
 * @returns {Promise<{ geometry: object, distanceMeters: number, durationSeconds: number, legs: { duration: number, distance: number }[] } | null>}
 */
export async function fetchDrivingRouteWaypoints(coords, token) {
  if (!token || !Array.isArray(coords) || coords.length < 2) return null
  const trimmed = coords.slice(0, MAPBOX_DIRECTIONS_MAX_COORDS).filter((c) => c && Number.isFinite(c.lng) && Number.isFinite(c.lat))
  if (trimmed.length < 2) return null
  try {
    const coordStr = trimmed.map((c) => `${c.lng},${c.lat}`).join(';')
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}`)
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('access_token', token)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route?.geometry) return null
    const legs = Array.isArray(route.legs)
      ? route.legs.map((leg) => ({
          duration: typeof leg.duration === 'number' ? leg.duration : 0,
          distance: typeof leg.distance === 'number' ? leg.distance : 0,
        }))
      : []
    return {
      geometry: route.geometry,
      distanceMeters: typeof route.distance === 'number' ? route.distance : 0,
      durationSeconds: typeof route.duration === 'number' ? route.duration : 0,
      legs,
    }
  } catch {
    return null
  }
}
