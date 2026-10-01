/**
 * Job-notification claim rules. A failed or stale pending claim can be retried.
 * A sent row, or a fresh pending row, must not send a second email.
 */

const TERMINAL_QUEUE_ERRORS = new Set([
  'not_paid',
  'missing_email',
  'quote_not_found',
  'missing_tracking_token',
  'no_driver',
  'already_sent',
])

export const PENDING_CLAIM_STALE_MS = 10 * 60 * 1000

export function isUniqueViolation(error) {
  if (!error) return false
  return String(error.code) === '23505' || /duplicate|unique/i.test(String(error.message || ''))
}

export function pendingClaimIsStale(createdAt, now = Date.now()) {
  const t = new Date(String(createdAt || '')).getTime()
  if (!Number.isFinite(t)) return false
  return now - t > PENDING_CLAIM_STALE_MS
}

/**
 * @returns {'already_sent' | 'in_flight' | 'reclaim'}
 */
export function notificationClaimDecision(existing, now = Date.now()) {
  if (!existing) return 'reclaim'
  const status = String(existing.delivery_status || '')
  if (status === 'sent') return 'already_sent'
  if (status === 'failed') return 'reclaim'
  if (status === 'pending' && pendingClaimIsStale(existing.created_at, now)) return 'reclaim'
  if (status === 'pending') return 'in_flight'
  return 'already_sent'
}

/** Queue row is finished. Provider failures stay unprocessed so the next cron can send once. */
export function queueProcessingIsTerminal(result) {
  if (!result) return false
  if (result.ok || result.skipped) return true
  return TERMINAL_QUEUE_ERRORS.has(String(result.error || ''))
}
