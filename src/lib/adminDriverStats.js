import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { findLinkedJobForQuote, quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'
import { resolveDriverPayoutSettlement } from './driverPayoutSettlement'

/**
 * @param {Record<string, unknown>} quote
 * @param {{ id?: string, name?: string }} driver
 */
function quoteMatchesDriver(quote, driver) {
  const driverId = String(driver?.id || '').trim()
  const name = String(driver?.name || '').trim().toLowerCase()
  const assignedId = String(quote.assigned_driver_id || '').trim()
  if (driverId && assignedId === driverId) return true
  if (!name) return false
  return (mergedAdminWorkflowForQuote(quote).assignedDriver || '').trim().toLowerCase() === name
}

/**
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countAssignedJobsForDriver(driver, quotes, jobs) {
  void jobs
  if (!String(driver?.id || '').trim() && !String(driver?.name || '').trim()) return 0
  let n = 0
  for (const q of quotes) {
    if (quoteMatchesDriver(q, driver)) n += 1
  }
  return n
}

/**
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countCompletedJobsForDriver(driver, quotes, jobs) {
  if (!String(driver?.id || '').trim() && !String(driver?.name || '').trim()) return 0
  let n = 0
  for (const q of quotes) {
    if (!quoteMatchesDriver(q, driver)) continue
    const job = findLinkedJobForQuote(q, jobs)
    if (quoteIsCompleted(q, job)) n += 1
  }
  return n
}

/**
 * Cancelled bookings already assigned to this driver. Uses the same match as completed jobs.
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countCancelledJobsForDriver(driver, quotes, jobs) {
  if (!String(driver?.id || '').trim() && !String(driver?.name || '').trim()) return 0
  let n = 0
  for (const q of quotes) {
    if (!quoteMatchesDriver(q, driver)) continue
    const job = findLinkedJobForQuote(q, jobs)
    if (quoteIsCancelled(q, job)) n += 1
  }
  return n
}

/**
 * Net driver payout recorded on assigned bookings. Null when no payout figure exists.
 * @param {{ id?: string, name?: string }} driver
 * @param {Record<string, unknown>[]} quotes
 * @returns {number | null}
 */
export function sumDriverEarnings(driver, quotes) {
  if (!String(driver?.id || '').trim() && !String(driver?.name || '').trim()) return null
  let total = 0
  let any = false
  for (const q of quotes) {
    if (!quoteMatchesDriver(q, driver)) continue
    const payout = resolveDriverPayoutSettlement(q, [])
    const net = payout.driverPayoutNet ?? payout.driverPayout
    const amount = Number(net)
    if (!Number.isFinite(amount)) continue
    any = true
    total += amount
  }
  return any ? total : null
}
