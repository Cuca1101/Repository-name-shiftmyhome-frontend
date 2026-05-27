import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteMarketplaceJobAccepted } from './adminJobListRules'
import { resolveJobAcceptedPaymentBreakdown } from './jobAcceptedPaymentDisplay'

const STARTED_STATUS_RE =
  /\b(active|started|in progress|on the way|en route|in transit|picked up|loading|unloading|at collection|at delivery)\b/i

const ACCEPTED_ONLY_RE = /^(assigned|accepted)$/i

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} [job]
 * @param {{ assignmentStatus?: string } | null} [assignment]
 */
export function quoteJobIsStarted(q, job = null, assignment = null) {
  const op = String(mergedAdminWorkflowForQuote(q).operationalStatus || q.operational_status || '').trim()
  if (op && STARTED_STATUS_RE.test(op) && !ACCEPTED_ONLY_RE.test(op)) return true
  const assignStatus = String(assignment?.status || '').trim()
  if (assignStatus && STARTED_STATUS_RE.test(assignStatus) && !ACCEPTED_ONLY_RE.test(assignStatus)) {
    return true
  }
  const jobSt = String(job?.status || '').trim()
  if (jobSt && STARTED_STATUS_RE.test(jobSt) && !ACCEPTED_ONLY_RE.test(jobSt)) return true
  return false
}

/**
 * Traffic-light badge for Job Accepted inbox.
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} [job]
 * @param {{ assignmentStatus?: string } | null} [assignment]
 * @returns {{ label: string, tone: 'amber' | 'emerald' | 'sky' | 'slate' | 'red' }}
 */
export function jobAcceptedStatusBadge(q, job = null, assignment = null) {
  if (quoteJobIsStarted(q, job, assignment)) {
    return { label: 'Active', tone: 'emerald' }
  }
  return { label: 'Accepted', tone: 'amber' }
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} [job]
 * @param {{ assignmentStatus?: string, updated_at?: string } | null} [assignment]
 */
export function jobAcceptedTimestamps(q, job = null, assignment = null) {
  const acceptedAt = q.assigned_at ? String(q.assigned_at) : ''
  let startedAt = ''
  if (quoteJobIsStarted(q, job, assignment)) {
    startedAt =
      (assignment?.updated_at && String(assignment.updated_at)) ||
      (job?.updated_at && String(job.updated_at)) ||
      ''
  }
  return { acceptedAt, startedAt }
}

/**
 * @param {Record<string, unknown>} q
 * @param {import('./adminFleetDrivers.js').getFleetDriversCached extends Function ? ReturnType<typeof import('./data/driversRepository.js').fleetDriverToAdminRecord> : never} [driverRec]
 */
export function resolveAssignedDriverDisplay(q, driverRec = null) {
  const merged = mergedAdminWorkflowForQuote(q)
  const name =
    String(q.assigned_driver_name || merged.assignedDriver || '').trim() ||
    (driverRec?.name ? String(driverRec.name) : '')
  const phone = driverRec?.phone ? String(driverRec.phone).trim() : ''
  const email = driverRec?.email ? String(driverRec.email).trim() : ''
  const marketplaceAccepted = quoteMarketplaceJobAccepted(q)
  const partner = String(q.assigned_partner_company || merged.assignedPartnerCompany || '').trim()
  return { name, phone, email, marketplaceAccepted, partner }
}

/**
 * @param {Record<string, unknown>} q
 * @returns {{ label: 'Driver payout' | 'Accepted for', amount: number } | null}
 */
export function resolveJobAcceptedPayoutDisplay(q) {
  const b = resolveJobAcceptedPaymentBreakdown(q)
  if (b.driverPayout == null) return null
  return { label: 'Driver payout', amount: b.driverPayout }
}
