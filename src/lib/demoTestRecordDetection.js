/**
 * Demo/test record detection for admin cleanup and inbox filtering.
 * Mirrors supabase quote_row_is_demo_booking rules where noted; never treats Stripe-linked rows as disposable.
 */

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

  const ref = String(q.quote_ref || '')
  if (/(DEMO|TEST)/i.test(ref)) return true

  const name = String(q.full_name || q.customer_name || '')
  if (/\bdemo\b/i.test(name) || /\btest\b/i.test(name)) return true

  const email = String(q.email || '')
  if (/\bdemo\b/i.test(email) || /@test\./i.test(email)) return true

  const reason = String(q.admin_cancellation_reason || '')
  if (/\bDEMO\b/i.test(reason) || /TEST BOOKING/i.test(reason)) return true

  return false
}

/**
 * Real paid customer booking — never hide, never bulk-archive.
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isRealCustomerBooking(q) {
  if (!q || typeof q !== 'object') return false
  if (quoteHasStripeLink(q)) return true

  const ps = String(q.payment_status || '').toLowerCase()
  const paid = ps === 'paid' || ps === 'deposit_paid' || q.paid_at != null
  if (paid && !quoteMatchesDemoPatterns(q)) return true

  return false
}

/**
 * Legacy alias used across admin.
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isQuoteDemoOrTest(q) {
  return quoteMatchesDemoPatterns(q)
}

/**
 * Pre-launch row: safe to archive unless Stripe-linked or paid real customer.
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isQuoteLaunchArchiveCandidate(q) {
  if (!q || typeof q !== 'object') return false
  return !isRealCustomerBooking(q)
}

/**
 * Safe to soft-archive (cancel) in bulk cleanup — never real Stripe/paid customers.
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isQuoteSafeForTestArchive(q) {
  return isQuoteLaunchArchiveCandidate(q)
}

/**
 * Hide from main admin inboxes in production (Available, Marketplace, Active, etc.).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function shouldHideQuoteFromAdminInbox(q) {
  if (isRealCustomerBooking(q)) return false
  if (q.is_test === true) return true
  if (quoteMatchesDemoPatterns(q)) return true
  return false
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
export function filterQuotesForProductionInbox(quotes) {
  if (!Array.isArray(quotes)) return []
  return quotes.filter((q) => !shouldHideQuoteFromAdminInbox(q))
}

/**
 * @param {Record<string, unknown>} journey
 */
export function shouldHideJourneyFromAdminInbox(journey) {
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

/**
 * @param {Record<string, unknown>[]} journeys
 */
export function filterJourneysForProductionInbox(journeys) {
  if (!Array.isArray(journeys)) return []
  return journeys.filter((j) => !shouldHideJourneyFromAdminInbox(j))
}
