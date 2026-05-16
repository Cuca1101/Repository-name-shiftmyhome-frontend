import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { findLinkedJobForQuote, quoteIsCompleted } from './adminWorkflowFilters'

/**
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countAssignedJobsForDriver(driver, quotes, jobs) {
  void jobs
  const driverId = String(driver?.id || '').trim()
  const d = String(driver?.name || driver || '').trim().toLowerCase()
  if (!driverId && !d) return 0
  let n = 0
  for (const q of quotes) {
    const aid = String(q.assigned_driver_id || '').trim()
    if (driverId && aid === driverId) {
      n += 1
      continue
    }
    const o = mergedAdminWorkflowForQuote(q)
    if (d && (o.assignedDriver || '').trim().toLowerCase() === d) n += 1
  }
  return n
}

/**
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countCompletedJobsForDriver(driver, quotes, jobs) {
  const driverId = String(driver?.id || '').trim()
  const d = String(driver?.name || driver || '').trim().toLowerCase()
  if (!driverId && !d) return 0
  let n = 0
  for (const q of quotes) {
    const aid = String(q.assigned_driver_id || '').trim()
    const nameMatch = d && (mergedAdminWorkflowForQuote(q).assignedDriver || '').trim().toLowerCase() === d
    if (!(driverId && aid === driverId) && !nameMatch) continue
    const job = findLinkedJobForQuote(q, jobs)
    if (quoteIsCompleted(q, job)) n += 1
  }
  return n
}
