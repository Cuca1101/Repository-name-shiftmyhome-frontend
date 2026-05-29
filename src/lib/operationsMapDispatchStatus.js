import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'

/** @typedef {'idle'|'assigned'|'on_route'|'arrived_pickup'|'loading'|'in_transit'|'arrived_delivery'|'completed'|'offline'} DispatchDriverStatus */

/**
 * @param {unknown} liveStatus
 * @param {unknown} operationalStatus
 * @param {number} assignedCount
 * @param {boolean} hasLiveGps
 */
export function resolveDispatchDriverStatus(liveStatus, operationalStatus, assignedCount, hasLiveGps) {
  const live = String(liveStatus ?? '').trim().toLowerCase()
  const op = String(operationalStatus ?? '').trim().toLowerCase()

  if (/offline|away|suspended|off_duty|off duty/.test(live)) return 'offline'
  if (/^available$/.test(live)) return hasLiveGps ? 'idle' : 'offline'
  if (/^in_progress$|active_job/.test(live)) return hasLiveGps ? 'on_route' : 'assigned'
  if (/^arrived$/.test(live)) return 'arrived_pickup'
  if (/cancelled|canceled/.test(live)) return 'completed'
  if (/completed|done|finished/.test(live) || op === 'completed') return 'completed'
  if (/arrived.*delivery|at delivery|delivered/.test(live) || op === 'arrived_delivery') return 'arrived_delivery'
  if (/in[\s_-]?transit|en[\s-]?route to delivery|to delivery/.test(live) || op === 'in_transit') return 'in_transit'
  if (/loading|load(ing)?\b/.test(live) || op === 'loading') return 'loading'
  if (/arrived.*pickup|at pickup|on site pickup/.test(live) || op === 'arrived_pickup') return 'arrived_pickup'
  if (/on[\s_-]?route|heading|driving|transit|collect|pickup/.test(live) || /route|way|pickup/.test(op)) {
    return hasLiveGps ? 'on_route' : 'assigned'
  }
  if (assignedCount > 0) return 'assigned'
  if (hasLiveGps && /idle|available|standby/.test(live)) return 'idle'
  return hasLiveGps ? 'idle' : 'offline'
}

/** @param {DispatchDriverStatus} status */
export function dispatchStatusLabel(status) {
  const labels = {
    idle: 'Idle',
    assigned: 'Assigned',
    on_route: 'On route',
    arrived_pickup: 'At pickup',
    loading: 'Loading',
    in_transit: 'In transit',
    arrived_delivery: 'At delivery',
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
  if (status === 'loading' || status === 'arrived_pickup' || status === 'arrived_delivery') return 'violet'
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
