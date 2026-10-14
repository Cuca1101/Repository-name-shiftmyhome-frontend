import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'

/** @typedef {'idle'|'assigned'|'on_route'|'arrived_pickup'|'loading'|'collected'|'in_transit'|'arrived_delivery'|'unloading'|'completed'|'offline'} DispatchDriverStatus */

function stageKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * @param {unknown} liveStatus
 * @param {unknown} operationalStatus
 * @param {number} assignedCount
 * @param {boolean} hasLiveGps
 */
export function resolveDispatchDriverStatus(liveStatus, operationalStatus, assignedCount, hasLiveGps) {
  const live = stageKey(liveStatus)
  const op = stageKey(operationalStatus)
  const has = (list) => list.includes(live) || list.includes(op)

  if (has(['offline', 'away', 'suspended', 'off_duty'])) return 'offline'
  if (live === 'available') return hasLiveGps ? 'idle' : 'offline'
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
  if (hasLiveGps && ['idle', 'available', 'standby'].includes(live)) return 'idle'
  return hasLiveGps ? 'idle' : 'offline'
}

/** @param {DispatchDriverStatus} status */
export function dispatchStatusLabel(status) {
  const labels = {
    idle: 'Idle',
    assigned: 'Assigned',
    on_route: 'Left for collection',
    arrived_pickup: 'At collection',
    loading: 'Loading',
    collected: 'Items collected',
    in_transit: 'Left for delivery',
    arrived_delivery: 'At delivery',
    unloading: 'Unloading',
    completed: 'Completed',
    offline: 'Offline',
  }
  return labels[status] || 'Unknown'
}

/** @param {DispatchDriverStatus} status */
export function dispatchStatusTone(status) {
  if (status === 'offline') return 'slate'
  if (status === 'idle') return 'amber'
  if (status === 'completed') return 'emerald'
  if (status === 'loading' || status === 'unloading' || status === 'collected' || status === 'arrived_pickup' || status === 'arrived_delivery') return 'violet'
  if (status === 'on_route' || status === 'in_transit') return 'sky'
  return 'blue'
}

/**
 * @param {Record<string, unknown>} driver
 * @param {Record<string, unknown> | null} liveRow
 * @param {Record<string, unknown>[]} assignedQuotes
 */
export function driverStatusFromContext(driver, liveRow, assignedQuotes) {
  const ops = assignedQuotes
    .map((q) => (mergedAdminWorkflowForQuote(q).operationalStatus || '').trim().toLowerCase())
    .find(Boolean)
  const hasLiveGps =
    liveRow != null && Number.isFinite(Number(liveRow.lng)) && Number.isFinite(Number(liveRow.lat))
  return resolveDispatchDriverStatus(
    liveRow?.status,
    ops,
    assignedQuotes.length,
    hasLiveGps,
  )
}
