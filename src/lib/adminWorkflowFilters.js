import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  journeyPassesMarketplaceStrict,
  quoteHasInProgressWorkflowStatus,
  quoteOperationalStatusLower,
  quotePassesActiveStrict,
  quotePassesAvailableJobsStrict,
  quotePassesMarketplaceStrict,
} from './adminJobListRules'
import {
  journeyVisibleInAdminLists,
  quoteVisibleInAdminLists,
} from './adminProductionFilters'
import { shouldHideArchivedTestDemoInProduction } from './demoTestRecordDetection'

/** @param {Record<string, unknown>} q */
function quoteVisibleInProductionAdmin(q) {
  if (shouldHideArchivedTestDemoInProduction(q)) return false
  return quoteVisibleInAdminLists(q)
}

/** @param {Record<string, unknown>} job */
function jobQuoteRef(job) {
  const pi = job?.price_inputs
  if (pi && typeof pi === 'object' && pi.quoteRef != null) return String(pi.quoteRef).trim()
  return ''
}

/**
 * @param {Record<string, unknown>} quote
 * @param {Record<string, unknown>[]} jobs
 * @returns {Record<string, unknown> | null}
 */
export function findLinkedJobForQuote(quote, jobs) {
  const ref = quote?.quote_ref != null ? String(quote.quote_ref).trim() : ''
  if (!ref || !Array.isArray(jobs)) return null
  for (const j of jobs) {
    if (jobQuoteRef(j) === ref) return j
  }
  return null
}

/** @param {Record<string, unknown>} q */
function ov(q) {
  return mergedAdminWorkflowForQuote(q)
}

/**
 * Marketplace listing: visible to partners (not yet driver/partner-assigned).
 * @param {Record<string, unknown>} q
 */
export function quoteInMarketplace(q) {
  if (String(q.status) === 'Cancelled') return false
  return ov(q).marketplaceVisibility === 'visible_in_marketplace'
}

/**
 * Active: assigned to driver or partner; not completed/cancelled.
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteIsActive(q, job, assignment) {
  if (quoteIsCancelled(q, job) || quoteIsCompleted(q, job, assignment)) return false
  return quotePassesActiveStrict(q)
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
/** Driver/mobile or DB terminal completion on quotes row. */
function quoteStatusIsCompleted(q) {
  const st = String(q?.status ?? '')
    .trim()
    .toLowerCase()
  return st === 'completed'
}

/** @param {{ status?: string, completed_at?: string | null } | null | undefined} assignment */
function jobAssignmentSignalsCompleted(assignment) {
  if (!assignment) return false
  const s = String(assignment.status ?? '')
    .trim()
    .toLowerCase()
  return s === 'completed'
}

export function quoteIsCompleted(q, job, assignment) {
  if (jobAssignmentSignalsCompleted(assignment)) return true
  if (quoteStatusIsCompleted(q)) return true
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed') return true
  if (quoteHasInProgressWorkflowStatus(q)) return false
  if (String(q.status) === 'Completed') return true
  if (job && String(job.status) === 'Completed') return true
  if (q.completed_at) return true
  const o = ov(q)
  if (String(o.marketplaceVisibility || '') === 'completed') return true
  if ((o.workflowCompletedAt || '').trim()) return true
  return false
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteIsCancelled(q, job) {
  const op = quoteOperationalStatusLower(q)
  if (op === 'cancelled') return true
  if (String(q.status) === 'Cancelled') return true
  if (job && String(job.status) === 'Cancelled') return true
  if (ov(q).marketplaceVisibility === 'cancelled') return true
  if (q.cancelled_at) return true
  const o = ov(q)
  if ((o.workflowCancelledAt || '').trim()) return true
  return false
}

/**
 * Completed Jobs tab: operational completed (and legacy rows without ops set).
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteIsInCompletedJobsInbox(q, job, assignment) {
  if (jobAssignmentSignalsCompleted(assignment)) return true
  if (quoteStatusIsCompleted(q)) return true
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed') return true
  if (!op && (String(q.status) === 'Completed' || q.completed_at)) return true
  if (!op && job && String(job.status) === 'Completed') return true
  return false
}

/**
 * Cancelled Jobs tab: operational cancelled or marketplace/legacy cancelled.
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteIsInCancelledJobsInbox(q, job) {
  const op = quoteOperationalStatusLower(q)
  if (op === 'cancelled') return true
  if (ov(q).marketplaceVisibility === 'cancelled') return true
  if (!op && (String(q.status) === 'Cancelled' || q.cancelled_at)) return true
  if (!op && job && String(job.status) === 'Cancelled') return true
  return false
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterMarketplaceQuotes(quotes, jobs, assignmentsByQuoteId = {}) {
  if (!Array.isArray(quotes)) return []
  const jobRows = Array.isArray(jobs) ? jobs : []
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobRows)
    const a = assignmentsByQuoteId[String(q.id || '')]
    if (quoteIsCancelled(q, j) || quoteIsCompleted(q, j, a)) return false
    return quotePassesMarketplaceStrict(q)
  })
}

/**
 * @param {Record<string, unknown>[]} journeys
 */
export function filterMarketplaceJourneys(journeys) {
  if (!Array.isArray(journeys)) return []
  return journeys.filter((j) => {
    if (!j || typeof j !== 'object') return false
    if (!journeyVisibleInAdminLists(j)) return false
    return journeyPassesMarketplaceStrict(j)
  })
}

/**
 * Active Jobs / Job Accepted inbox — assigned, not terminal (incl. mobile assignment completed).
 *
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 * @param {Record<string, { status?: string }>} [assignmentsByQuoteId]
 */
export function filterActiveQuotes(quotes, jobs, assignmentsByQuoteId = {}) {
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobs)
    const a = assignmentsByQuoteId[String(q.id || '')]
    if (quoteIsCancelled(q, j) || quoteIsCompleted(q, j, a)) return false
    return quotePassesActiveStrict(q)
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterCompletedQuotes(quotes, jobs, assignmentsByQuoteId = {}) {
  const jobRows = Array.isArray(jobs) ? jobs : []
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobRows)
    const a = assignmentsByQuoteId[String(q.id || '')]
    if (quoteIsCancelled(q, j)) return false
    if (quotePassesActiveStrict(q) && !quoteIsCompleted(q, j, a)) return false
    return quoteIsInCompletedJobsInbox(q, j, a)
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterCancelledQuotes(quotes, jobs, assignmentsByQuoteId = {}) {
  const jobRows = Array.isArray(jobs) ? jobs : []
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobRows)
    const a = assignmentsByQuoteId[String(q.id || '')]
    if (quotePassesActiveStrict(q)) return false
    if (quotePassesAvailableJobsStrict(q)) return false
    if (quoteIsCompleted(q, j, a) && !quoteIsCancelled(q, j)) return false
    return quoteIsInCancelledJobsInbox(q, j)
  })
}

export { quoteHasAssignedDriver, quoteHasAssignedPartner } from './adminJobListRules'
