/**
 * Demo/test record detection for admin cleanup and inbox filtering.
 * Protected live bookings = Stripe payment intent or session id present only.
 */

import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { shouldApplyProductionAdminFilters } from './adminProductionMode'

/** @param {Record<string, unknown> | null | undefined} q */
export function quoteHasStripeLink(q) {
  if (!q || typeof q !== 'object') return false
  const pi = String(q.stripe_payment_intent_id || '').trim()
  const sess = String(q.stripe_session_id || '').trim()
  return pi.length > 0 || sess.length > 0
}

/** @param {Record<string, unknown> | null | undefined} q */
export function quoteMatchesDemoPatterns(q) {
  if (!q || typeof q !== 'object') return false
  if (q.is_test === true) return true
  if (q.archived_for_go_live === true) return true

  const ref = String(q.quote_ref || '')
  if (/(DEMO|TEST)/i.test(ref)) return true

  const name = String(q.full_name || q.customer_name || '')
  if (/\bdemo\b/i.test(name) || /\btest\b/i.test(name)) return true

  const email = String(q.email || '')
  if (/\bdemo\b/i.test(email) || /@test\./i.test(email)) return true

  const reason = String(q.admin_cancellation_reason || '')
  if (/\bDEMO\b/i.test(reason) || /TEST BOOKING/i.test(reason)) return true
  if (/PRE-LAUNCH TEST DATA ARCHIVED/i.test(reason)) return true

  return false
}

/**
 * DB + merged session workflow (cancellation reason may exist only in session).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function quoteMatchesDemoPatternsWithMerge(q) {
  if (quoteMatchesDemoPatterns(q)) return true
  if (!q || typeof q !== 'object') return false

  const m = mergedAdminWorkflowForQuote(q)
  const reason = String(m.adminCancellationReason || m.cancellationReason || '')
  if (/\bDEMO\b/i.test(reason) || /TEST BOOKING/i.test(reason)) return true
  if (/PRE-LAUNCH TEST DATA ARCHIVED/i.test(reason)) return true

  return false
}

/**
 * Quote archived by go-live cleanup or admin cancel (non-Stripe test booking).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isQuoteGoLiveArchived(q) {
  if (!q || typeof q !== 'object') return false
  if (q.archived_for_go_live === true) return true
  if (q.is_test === true) return true

  const op = String(q.operational_status || '').trim().toLowerCase()
  const mv = String(q.marketplace_visibility || '').trim().toLowerCase()
  if (q.cancelled_at && (op === 'cancelled' || mv === 'cancelled')) {
    if (/PRE-LAUNCH TEST DATA ARCHIVED/i.test(String(q.admin_cancellation_reason || ''))) {
      return true
    }
    if (quoteMatchesDemoPatternsWithMerge(q)) return true
  }

  return false
}

/**
 * Real live Stripe-linked booking — never hide, never bulk-archive.
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isRealCustomerBooking(q) {
  return quoteHasStripeLink(q)
}

/** @param {Record<string, unknown> | null | undefined} q */
export function isQuoteDemoOrTest(q) {
  return quoteMatchesDemoPatternsWithMerge(q) || isQuoteGoLiveArchived(q)
}

/** @param {Record<string, unknown> | null | undefined} q */
export function isQuoteLaunchArchiveCandidate(q) {
  if (!q || typeof q !== 'object') return false
  return !isRealCustomerBooking(q)
}

/** @param {Record<string, unknown> | null | undefined} q */
export function isQuoteSafeForTestArchive(q) {
  return isQuoteLaunchArchiveCandidate(q)
}

/**
 * Archived / test / demo rows hidden from workflow lists (Cancelled, Completed, etc.).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function shouldHideArchivedTestDemoInProduction(q) {
  if (!shouldApplyProductionAdminFilters()) return false
  if (!q || typeof q !== 'object') return false
  if (q.archived_for_go_live === true) return true
  if (q.is_test === true) return true
  if (quoteMatchesDemoPatternsWithMerge(q)) return true
  return false
}

/**
 * Hide from main admin inboxes (Available, Marketplace, Active, Cancelled, etc.).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function shouldHideQuoteFromAdminInbox(q) {
  if (!shouldApplyProductionAdminFilters()) return false

  if (shouldHideArchivedTestDemoInProduction(q)) return true
  if (isQuoteGoLiveArchived(q)) return true

  // Live Stripe customer bookings (not archived/demo) stay visible in workflow lists.
  if (isRealCustomerBooking(q)) return false

  const op = String(q.operational_status || '').trim().toLowerCase()
  const mv = String(q.marketplace_visibility || '').trim().toLowerCase()
  if (q.cancelled_at && (op === 'cancelled' || mv === 'cancelled')) return true

  return false
}

/** @param {Record<string, unknown>[]} quotes */
export function filterQuotesForProductionInbox(quotes) {
  if (!Array.isArray(quotes)) return []
  return quotes.filter((q) => !shouldHideQuoteFromAdminInbox(q))
}

export const filterProductionAdminQuotes = filterQuotesForProductionInbox

/** @param {Record<string, unknown>} journey */
export function shouldHideJourneyFromAdminInbox(journey) {
  if (!shouldApplyProductionAdminFilters()) return false
  if (!journey || typeof journey !== 'object') return false

  const title = String(journey.title || journey.marketplace_title || '')
  if (/(DEMO|TEST)/i.test(title)) return true
  const ref = String(journey.journey_ref || journey.ref || '')
  if (/(DEMO|TEST)/i.test(ref)) return true

  const st = String(journey.status || '').toLowerCase()
  const mv = String(journey.marketplace_visibility || '')
  if (st === 'cancelled' && mv === 'hidden_from_partners') return true

  return false
}

/** @param {Record<string, unknown>[]} journeys */
export function filterJourneysForProductionInbox(journeys) {
  if (!Array.isArray(journeys)) return []
  return journeys.filter((j) => !shouldHideJourneyFromAdminInbox(j))
}

export const filterProductionAdminJourneys = filterJourneysForProductionInbox
