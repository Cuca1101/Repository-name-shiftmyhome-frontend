/**
 * Mapbox Geocoding + Directions (REST). All functions fail soft (return null / empty / catch).
 */

const UK_POSTCODE_IN_TEXT = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i
/** Reject street matches that land far from the stated UK postcode (e.g. "29 Carnoustie DD7…" → London). */
const POSTCODE_ANCHOR_MAX_METRES = 40000

export function metersToMiles(meters) {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return 0
  return Math.round(meters * 0.000621371 * 10) / 10
}

/**
 * @param {unknown} text
 * @returns {string} normalised "AB12 3CD" or ""
 */
export function extractUkPostcode(text) {
  const m = String(text || '').match(UK_POSTCODE_IN_TEXT)
  if (!m) return ''
  const compact = m[1].replace(/\s+/g, '').toUpperCase()
  if (compact.length < 5) return ''
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

function metresBetweenPoints(a, b) {
  const earth = 6371000
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * @param {string} query
 * @param {string} token
 * @param {{ proximity?: { lng: number, lat: number } | null, types?: string, limit?: number }} [opts]
 * @returns {Promise<Array<{ lng: number, lat: number, placeName: string, types: string[] }>>}
 */
async function fetchGeocodeFeatures(query, token, opts = {}) {
  if (!query?.trim() || !token) return []
  try {
    const path = encodeURIComponent(query.trim())
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('limit', String(Math.max(1, Math.min(10, Number(opts.limit) || 5))))
    url.searchParams.set('country', 'gb')
    if (opts.types) url.searchParams.set('types', opts.types)
    if (opts.proximity && Number.isFinite(opts.proximity.lng) && Number.isFinite(opts.proximity.lat)) {
      url.searchParams.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`)
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || [])
      .map((f) => {
        const c = f.center
        if (!Array.isArray(c) || c.length < 2) return null
        return {
          lng: c[0],
          lat: c[1],
          placeName: String(f.place_name || f.text || ''),
          types: Array.isArray(f.place_type) ? f.place_type.map(String) : [],
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * @param {string} postcode
 * @param {string} token
 * @returns {Promise<{ lng: number, lat: number, placeName: string } | null>}
 */
async function geocodeUkPostcodeAnchor(postcode, token) {
  const pc = extractUkPostcode(postcode) || String(postcode || '').trim()
  if (!pc) return null
  const features = await fetchGeocodeFeatures(pc, token, { types: 'postcode', limit: 1 })
  const hit = features[0]
  if (!hit) return null
  return { lng: hit.lng, lat: hit.lat, placeName: hit.placeName }
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
 * UK-aware geocode. When the query includes a postcode, that postcode anchors the result
 * so incomplete lines like "29 Carnoustie DD7 7DQ" do not snap to "Carnoustie Drive, London".
 *
 * @param {string} query
 * @param {string} token
 * @param {{ proximity?: { lng: number, lat: number } | null }} [opts]
 * @returns {Promise<{ lng: number, lat: number } | null>}
 */
export async function geocodeAddress(query, token, opts = {}) {
  const text = String(query || '').trim()
  if (!text || !token) return null

  const postcode = extractUkPostcode(text)
  const proximityHint =
    opts.proximity && Number.isFinite(opts.proximity.lng) && Number.isFinite(opts.proximity.lat)
      ? { lng: opts.proximity.lng, lat: opts.proximity.lat, placeName: '' }
      : null

  // Parallel: postcode anchor + street query (filters reject London namesakes of Scottish streets).
  const [anchorFromPostcode, features] = await Promise.all([
    postcode ? geocodeUkPostcodeAnchor(postcode, token) : Promise.resolve(null),
    fetchGeocodeFeatures(text, token, {
      proximity: proximityHint,
      limit: postcode ? 5 : 1,
    }),
  ])
  const anchor = anchorFromPostcode || proximityHint

  if (postcode && anchor) {
    const compactPc = postcode.replace(/\s+/g, '')
    const near = features.filter(
      (f) => metresBetweenPoints(f, anchor) <= POSTCODE_ANCHOR_MAX_METRES,
    )
    const matchingName = near.find((f) =>
      f.placeName.replace(/\s+/g, '').toUpperCase().includes(compactPc),
    )
    const preferred =
      matchingName ||
      near.find((f) => f.types.includes('address')) ||
      near[0]
    if (preferred) return { lng: preferred.lng, lat: preferred.lat }
    // Street match was nowhere near the postcode (classic London false positive) — use postcode.
    return { lng: anchor.lng, lat: anchor.lat }
  }

  const first = features[0]
  return first ? { lng: first.lng, lat: first.lat } : null
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
