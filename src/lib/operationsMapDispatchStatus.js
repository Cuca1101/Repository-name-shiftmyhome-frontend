import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveDispatchDriverStatus } from './operationsMapDispatchRules.js'

export { resolveDispatchDriverStatus }

/** @typedef {'idle'|'assigned'|'on_route'|'arrived_pickup'|'loading'|'collected'|'in_transit'|'arrived_delivery'|'unloading'|'completed'|'offline'} DispatchDriverStatus */

/** @param {DispatchDriverStatus} status */
export function dispatchStatusLabel(status) {
  const labels = {
    idle: 'Idle',
    assigned: 'Assigned',
    on_route: 'Left for collection',
    arrived_pickup: 'Arrived at collection',
    loading: 'Loading',
    collected: 'Items collected',
    in_transit: 'Left for delivery',
    arrived_delivery: 'Arrived at delivery',
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
