/**
 * GPS trail analytics: stops (dwell) and deviation from planned pickup→delivery line.
 */

function toRad(d) {
  return (d * Math.PI) / 180
}

/**
 * @param {number} lng1
 * @param {number} lat1
 * @param {number} lng2
 * @param {number} lat2
 * @returns {number} metres
 */
export function haversineMetres(lng1, lat1, lng2, lat2) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * @param {{ lng: number, lat: number }} p
 * @param {{ lng: number, lat: number }} a
 * @param {{ lng: number, lat: number }} b
 */
function pointToSegmentDistanceM(p, a, b) {
  const dx = b.lng - a.lng
  const dy = b.lat - a.lat
  if (dx === 0 && dy === 0) return haversineMetres(p.lng, p.lat, a.lng, a.lat)
  const t = Math.max(
    0,
    Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy)),
  )
  const projLng = a.lng + t * dx
  const projLat = a.lat + t * dy
  return haversineMetres(p.lng, p.lat, projLng, projLat)
}

/**
 * @param {Array<{ lng: number, lat: number, recorded_at?: string }>} points
 * @param {{ lng: number, lat: number }} pickup
 * @param {{ lng: number, lat: number }} delivery
 * @param {{ thresholdM?: number }} [opts]
 */
export function analyzeRouteDeviation(points, pickup, delivery, opts = {}) {
  const thresholdM = opts.thresholdM ?? 400
  if (!points?.length || !pickup || !delivery) {
    return { maxDeviationM: 0, offRouteSamples: 0, offRoutePct: 0 }
  }
  let maxDeviationM = 0
  let offRouteSamples = 0
  for (const p of points) {
    const d = pointToSegmentDistanceM(p, pickup, delivery)
    if (d > maxDeviationM) maxDeviationM = d
    if (d > thresholdM) offRouteSamples += 1
  }
  const offRoutePct = points.length
    ? Math.round((offRouteSamples / points.length) * 100)
    : 0
  return { maxDeviationM: Math.round(maxDeviationM), offRouteSamples, offRoutePct }
}

/**
 * Cluster slow/stationary GPS into stops.
 *
 * @param {Array<{ lng: number, lat: number, recorded_at: string, speed?: number | null }>} points
 * @param {{ minDwellMs?: number, clusterRadiusM?: number }} [opts]
 */
export function detectLocationStops(points, opts = {}) {
  const minDwellMs = opts.minDwellMs ?? 3 * 60 * 1000
  const clusterRadiusM = opts.clusterRadiusM ?? 80
  if (!points?.length) return []

  const sorted = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  )

  /** @type {typeof sorted} */
  let cluster = []
  /** @type {ReturnType<typeof detectLocationStops>} */
  const stops = []

  const flushCluster = () => {
    if (cluster.length < 2) {
      cluster = []
      return
    }
    const start = cluster[0].recorded_at
    const end = cluster[cluster.length - 1].recorded_at
    const dwellMs = new Date(end).getTime() - new Date(start).getTime()
    if (dwellMs < minDwellMs) {
      cluster = []
      return
    }
    const mid = cluster[Math.floor(cluster.length / 2)]
    stops.push({
      lng: mid.lng,
      lat: mid.lat,
      startedAt: start,
      endedAt: end,
      dwellMinutes: Math.round(dwellMs / 60000),
      pointCount: cluster.length,
    })
    cluster = []
  }

  for (const p of sorted) {
    if (!cluster.length) {
      cluster.push(p)
      continue
    }
    const last = cluster[cluster.length - 1]
    const dist = haversineMetres(last.lng, last.lat, p.lng, p.lat)
    const slow = p.speed == null || Number(p.speed) < 1.5
    const lastSlow = last.speed == null || Number(last.speed) < 1.5
    if (dist <= clusterRadiusM && (slow || lastSlow)) {
      cluster.push(p)
    } else {
      flushCluster()
      cluster = [p]
    }
  }
  flushCluster()
  return stops
}

/**
 * @param {Array<{ lng: number, lat: number }>} points
 */
export function buildGpsTrailGeoJson(points) {
  const coords = (points || [])
    .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
    .map((p) => [p.lng, p.lat])
  if (coords.length < 2) {
    return { type: 'FeatureCollection', features: [] }
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'gps_trail' },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  }
}

/**
 * @param {ReturnType<typeof detectLocationStops>} stops
 */
export function buildStopMarkersGeoJson(stops) {
  return {
    type: 'FeatureCollection',
    features: (stops || []).map((s, i) => ({
      type: 'Feature',
      properties: {
        kind: 'gps_stop',
        index: i + 1,
        dwellMinutes: s.dwellMinutes,
        label: `${s.dwellMinutes} min`,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  }
}
