/**
 * Split a driving route at the closest point to the driver for progress visualization.
 */

/**
 * @param {[number, number][]} coords
 * @param {{ lng: number, lat: number }} point
 */
export function closestIndexOnRoute(coords, point) {
  if (!coords?.length) return 0
  let best = 0
  let bestD = Infinity
  const plng = Number(point.lng)
  const plat = Number(point.lat)
  for (let i = 0; i < coords.length; i += 1) {
    const c = coords[i]
    if (!Array.isArray(c) || c.length < 2) continue
    const dlng = Number(c[0]) - plng
    const dlat = Number(c[1]) - plat
    const d = dlng * dlng + dlat * dlat
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/**
 * @param {[number, number][]} coords
 * @param {{ lng: number, lat: number }} driverPoint
 * @returns {{ traveled: [number, number][], remaining: [number, number][] }}
 */
export function splitRouteAtDriver(coords, driverPoint) {
  if (!coords || coords.length < 2) {
    return { traveled: [], remaining: coords || [] }
  }
  const idx = closestIndexOnRoute(coords, driverPoint)
  const traveled = coords.slice(0, idx + 1)
  const remaining = coords.slice(idx)
  if (remaining.length < 2 && traveled.length >= 2) {
    return { traveled, remaining: [traveled[traveled.length - 1], ...coords.slice(idx + 1)] }
  }
  if (traveled.length < 2 && remaining.length >= 2) {
    return { traveled: [remaining[0]], remaining }
  }
  return { traveled, remaining }
}

/**
 * @param {Record<string, { coordinates: number[][], durationSeconds?: number, distanceMeters?: number }>} routeLegByQuoteId
 * @param {Record<string, unknown>[]} activeQuotes
 * @param {Record<string, { pickup: { lng: number, lat: number }, delivery: { lng: number, lat: number } }>} coordsByQuoteId
 * @param {Record<string, { lng: number, lat: number } | null>} driverPosByDriverName
 */
export function buildActiveRouteProgressGeoJson(
  routeLegByQuoteId,
  activeQuotes,
  coordsByQuoteId,
  driverPosByDriverName,
) {
  /** @type {GeoJSON.Feature<GeoJSON.LineString>[]} */
  const traveled = []
  /** @type {GeoJSON.Feature<GeoJSON.LineString>[]} */
  const remaining = []

  for (const q of activeQuotes) {
    const id = String(q?.id ?? '')
    if (!id) continue
    const leg = routeLegByQuoteId[id]
    const coords = leg?.coordinates
    if (!coords || coords.length < 2) continue

    const driverName = String(q.assigned_driver_name || '').trim().toLowerCase()
    const driverPt = driverName ? driverPosByDriverName[driverName] : null
    if (!driverPt) continue

    const split = splitRouteAtDriver(coords, driverPt)
    const ref = String(q.quote_ref || id.slice(0, 8))
    const base = { quoteId: id, jobRef: ref }

    if (split.traveled.length >= 2) {
      traveled.push({
        type: 'Feature',
        properties: { ...base, segment: 'traveled' },
        geometry: { type: 'LineString', coordinates: split.traveled },
      })
    }
    if (split.remaining.length >= 2) {
      remaining.push({
        type: 'Feature',
        properties: { ...base, segment: 'remaining' },
        geometry: { type: 'LineString', coordinates: split.remaining },
      })
    }
  }

  return {
    traveled: { type: 'FeatureCollection', features: traveled },
    remaining: { type: 'FeatureCollection', features: remaining },
  }
}
