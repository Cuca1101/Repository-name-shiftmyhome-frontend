import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteMarketplaceJobAccepted } from './adminJobListRules'
import { resolveJobAcceptedPaymentBreakdown } from './jobAcceptedPaymentDisplay'

const STARTED_STATUS_RE =
  /\b(active|started|in progress|on the way|en route|in transit|picked up|loading|unloading|at collection|at delivery)\b/i

const ACCEPTED_ONLY_RE = /^(assigned|accepted)$/i

const STARTED_KEYS = new Set([
  'on_way',
  'on_the_way',
  'started',
  'start',
  'in_progress',
  'in_transit',
  'left_for_collection',
  'left_for_delivery',
  'on_way_to_delivery',
  'on_route',
  'en_route',
  'arrived',
  'arrived_pickup',
  'arrived_delivery',
  'at_collection',
  'at_delivery',
  'pickup_completed',
  'loaded',
  'collection_finished',
  'collection_complete',
  'items_collected',
  'loading',
  'loading_started',
  'unloading',
  'unloading_started',
])

/**
 * The installed app stores Start as on_way. The confirmed label is
 * "Left for collection". Both mean the driver has started.
 * @param {unknown} value
 */
function textMeansStarted(value) {
  const raw = String(value || '').trim()
  if (!raw || ACCEPTED_ONLY_RE.test(raw)) return false
  const key = raw
    .toLowerCase()
    .replace(/[·•]/g, ' ')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
  if (STARTED_KEYS.has(key)) return true
  if (
    key.startsWith('left_for_collection')
    || key.startsWith('left_for_delivery')
    || key.startsWith('arrived_at_collection')
    || key.startsWith('arrived_at_delivery')
    || key.startsWith('collection_complete')
  ) {
    return true
  }
  return STARTED_STATUS_RE.test(raw)
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} [job]
 * @param {{ status?: string, assignmentStatus?: string } | null} [assignment]
 */
export function quoteJobIsStarted(q, job = null, assignment = null) {
  const op = String(mergedAdminWorkflowForQuote(q).operationalStatus || q.operational_status || '').trim()
  if (textMeansStarted(op)) return true
  if (textMeansStarted(q?.status)) return true
  const assignStatus = String(assignment?.status || assignment?.assignmentStatus || '').trim()
  if (textMeansStarted(assignStatus)) return true
  const jobSt = String(job?.status || '').trim()
  if (textMeansStarted(jobSt)) return true
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
