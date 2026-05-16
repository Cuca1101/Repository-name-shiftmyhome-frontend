/**
 * Haversine distance in metres (approximate).
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Greedy ordering: each job's pickup before its delivery; pick nearest eligible stop by haversine.
 * Time windows are not hard-constrained (v1); comment in UI.
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops must include lng/lat on each stop for best results
 * @returns {import('./journeyPlannerModel.js').JourneyStop[]} reordered shallow copies (same ids)
 */
export function optimizeStopsGreedyNearest(stops) {
  if (!Array.isArray(stops) || stops.length === 0) return []
  const list = stops.map((s) => ({ ...s }))
  const pickupDone = new Set()
  /** @type {JourneyStop[]} */
  const tour = []
  /** @param {JourneyStop} s */
  const coordsOk = (s) =>
    s.lng != null && s.lat != null && Number.isFinite(s.lng) && Number.isFinite(s.lat)

  let firstIdx = list.findIndex(coordsOk)
  if (firstIdx < 0) return list

  let current = { lng: list[firstIdx].lng, lat: list[firstIdx].lat }
  const remaining = new Set(list.map((_, i) => i))

  while (remaining.size > 0) {
    let bestI = -1
    let bestD = Infinity
    for (const i of remaining) {
      const s = list[i]
      if (s.kind === 'delivery' && !pickupDone.has(s.quoteId)) continue
      if (!coordsOk(s)) {
        if (bestI < 0) bestI = i
        continue
      }
      const d = haversineMeters(current, { lng: s.lng, lat: s.lat })
      if (d < bestD) {
        bestD = d
        bestI = i
      }
    }
    if (bestI < 0) break
    const chosen = list[bestI]
    tour.push(chosen)
    remaining.delete(bestI)
    if (chosen.kind === 'pickup') pickupDone.add(chosen.quoteId)
    if (coordsOk(chosen)) current = { lng: chosen.lng, lat: chosen.lat }
  }

  for (const i of remaining) {
    tour.push(list[i])
  }

  return tour
}
