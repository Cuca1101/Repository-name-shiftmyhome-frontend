/** @typedef {'idle'|'assigned'|'on_route'|'arrived_pickup'|'loading'|'collected'|'in_transit'|'arrived_delivery'|'unloading'|'completed'|'offline'} DispatchDriverStatus */

function stageKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * Job stage wins over a generic GPS status of "available".
 * @param {unknown} liveStatus
 * @param {unknown} operationalStatus
 * @param {number} assignedCount
 * @param {boolean} hasLiveGps
 * @returns {DispatchDriverStatus}
 */
export function resolveDispatchDriverStatus(liveStatus, operationalStatus, assignedCount, hasLiveGps) {
  const live = stageKey(liveStatus)
  const op = stageKey(operationalStatus)
  const has = (list) => list.includes(live) || list.includes(op)

  if (live === 'offline' || live === 'away' || live === 'suspended' || live === 'off_duty') return 'offline'
  if (has(['completed', 'done', 'finished'])) return 'completed'
  if (has(['cancelled', 'canceled'])) return 'completed'
  if (has(['unloading', 'unloading_started'])) return 'unloading'
  if (has(['arrived_delivery', 'at_delivery'])) return 'arrived_delivery'
  if (has(['loading', 'loading_started'])) return 'loading'
  if (has(['pickup_completed', 'loaded', 'collection_finished', 'items_collected'])) return 'collected'
  if (has(['in_transit', 'left_for_delivery'])) return 'in_transit'
  if (has(['arrived_pickup', 'at_collection', 'arrived'])) return 'arrived_pickup'
  if (has(['on_way', 'on_route', 'left_for_collection', 'started', 'start', 'on_the_way'])) {
    return hasLiveGps ? 'on_route' : 'assigned'
  }
  if (live === 'in_progress' || live === 'active_job' || live === 'active_job_location') {
    return hasLiveGps ? 'on_route' : 'assigned'
  }
  if (assignedCount > 0) return 'assigned'
  if (live === 'available' || live === 'idle' || live === 'standby') {
    return hasLiveGps ? 'idle' : 'offline'
  }
  return hasLiveGps ? 'idle' : 'offline'
}
