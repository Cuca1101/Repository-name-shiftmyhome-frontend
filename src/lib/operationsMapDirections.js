/**
 * Mapbox Directions API → driving geometry + ETA (same token as Maps).
 */

/**
 * Format driving duration from Directions `duration` (seconds).
 * @param {number} seconds
 */
export function formatDriveDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const totalMin = Math.max(1, Math.round(seconds / 60))
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m <= 0) return `${h} h`
  return `${h} h ${m} min`
}

/**
 * Road route only — no chord / straight fallback (caller skips leg if null).
 * @param {{ lng: number, lat: number }} pickup
 * @param {{ lng: number, lat: number }} delivery
 * @param {string} token
 * @returns {Promise<{ coordinates: number[][], durationSeconds: number, distanceMeters: number } | null>}
 */
export async function fetchMapboxDrivingRoute(pickup, delivery, token) {
  const t = String(token || '').trim()
  if (!t) return null
  const plng = Number(pickup?.lng)
  const plat = Number(pickup?.lat)
  const dlng = Number(delivery?.lng)
  const dlat = Number(delivery?.lat)
  if (
    ![plng, plat, dlng, dlat].every((n) => Number.isFinite(n)) ||
    Math.abs(plng) > 180 ||
    Math.abs(dlng) > 180 ||
    Math.abs(plat) > 90 ||
    Math.abs(dlat) > 90
  ) {
    return null
  }

  const params = new URLSearchParams({
    access_token: t,
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
    alternatives: 'false',
  })
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${plng},${plat};${dlng},${dlat}?${params}`

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
          await new Promise((r) => setTimeout(r, 400))
          continue
        }
        return null
      }
      const json = await res.json()
      const route = json?.routes?.[0]
      if (!route) return null

      const rawCoords = route.geometry?.coordinates
      if (!Array.isArray(rawCoords) || rawCoords.length < 2) return null
      const normalized = sanitizeLineCoords(rawCoords)
      if (normalized.length < 2) return null

      const durationSeconds = Number(route.duration)
      const distanceMeters = Number(route.distance)

      return {
        coordinates: normalized,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
      }
    } catch {
      if (attempt === 0) continue
      return null
    }
  }
  return null
}

/**
 * Stable cache key when pickup/delivery positions change after re-geocode.
 */
export function operationsRouteCoordCacheKey(quoteId, pickup, delivery) {
  const id = String(quoteId || '').trim()
  const plng = Number(pickup?.lng).toFixed(5)
  const plat = Number(pickup?.lat).toFixed(5)
  const dlng = Number(delivery?.lng).toFixed(5)
  const dlat = Number(delivery?.lat).toFixed(5)
  return `${id}|${plng},${plat}|${dlng},${dlat}`
}

/** @param {unknown[][]} coords */
function sanitizeLineCoords(coords) {
  /** @type {number[][]} */
  const out = []
  for (const pt of coords) {
    if (!Array.isArray(pt) || pt.length < 2) continue
    const lng = Number(pt[0])
    const lat = Number(pt[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) continue
    out.push([lng, lat])
  }
  return out
}
