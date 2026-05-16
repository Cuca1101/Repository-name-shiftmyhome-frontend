import { formatDriveDuration } from './operationsMapDirections'

/**
 * @param {number} seconds
 * @param {{ delayed?: boolean, trafficExtraMin?: number }} [opts]
 */
export function formatEtaBadge(seconds, opts = {}) {
  if (opts.delayed) return 'Delayed'
  if (opts.trafficExtraMin != null && opts.trafficExtraMin >= 12) {
    return `Traffic +${Math.round(opts.trafficExtraMin)}m`
  }
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds <= 120) return 'Arriving now'
  const min = Math.max(1, Math.round(seconds / 60))
  if (min < 60) return `${min} min away`
  return `${formatDriveDuration(seconds)} away`
}

/**
 * @param {number} lng
 * @param {number} lat
 */
export function etaCoordKey(lng, lat) {
  return `${Number(lng).toFixed(4)},${Number(lat).toFixed(4)}`
}

/**
 * @param {string} driverId
 * @param {string} targetKind pickup|delivery
 * @param {{ lng: number, lat: number }} from
 * @param {{ lng: number, lat: number }} to
 */
export function etaCacheKey(driverId, targetKind, from, to) {
  return `eta|${driverId}|${targetKind}|${etaCoordKey(from.lng, from.lat)}|${etaCoordKey(to.lng, to.lat)}`
}
