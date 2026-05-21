import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  journeyPassesMarketplaceStrict,
  quoteOperationalStatusLower,
  quotePassesActiveStrict,
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
export function quoteIsActive(q, job) {
  if (quoteIsCancelled(q, job) || quoteIsCompleted(q, job)) return false
  return quotePassesActiveStrict(q)
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteIsCompleted(q, job) {
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed') return true
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
export function quoteIsInCompletedJobsInbox(q, job) {
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
export function filterMarketplaceQuotes(quotes, jobs) {
  if (!Array.isArray(quotes)) return []
  const jobRows = Array.isArray(jobs) ? jobs : []
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobRows)
    if (quoteIsCancelled(q, j) || quoteIsCompleted(q, j)) return false
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
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterActiveQuotes(quotes, jobs) {
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    const j = findLinkedJobForQuote(q, jobs)
    if (quoteIsCancelled(q, j) || quoteIsCompleted(q, j)) return false
    return quotePassesActiveStrict(q)
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterCompletedQuotes(quotes, jobs) {
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    return quoteIsInCompletedJobsInbox(q, findLinkedJobForQuote(q, jobs))
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function filterCancelledQuotes(quotes, jobs) {
  return quotes.filter((q) => {
    if (!quoteVisibleInProductionAdmin(q)) return false
    return quoteIsInCancelledJobsInbox(q, findLinkedJobForQuote(q, jobs))
  })
}

export { quoteHasAssignedDriver, quoteHasAssignedPartner } from './adminJobListRules'
