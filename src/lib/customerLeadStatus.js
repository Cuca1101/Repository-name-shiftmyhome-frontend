/** Customer lead status labels and abandonment rules (display + admin filters). */

export const CUSTOMER_LEAD_STATUSES = [
  'new_lead',
  'quote_started',
  'quote_viewed',
  'payment_started',
  'abandoned',
  'payment_failed',
  'converted_to_booking',
]

export const CUSTOMER_LEAD_STATUS_LABELS = {
  new_lead: 'New Lead',
  quote_started: 'Quote Started',
  quote_viewed: 'Quote Viewed',
  payment_started: 'Payment Started',
  abandoned: 'Abandoned',
  payment_failed: 'Payment Failed',
  converted_to_booking: 'Converted To Booking',
}

/** Idle time before a lead is treated as abandoned for recovery (15 minutes). */
export const CUSTOMER_LEAD_ABANDON_MS = 15 * 60 * 1000

const STATUS_RANK = {
  new_lead: 1,
  quote_started: 2,
  quote_viewed: 3,
  payment_started: 4,
  abandoned: 5,
  payment_failed: 5,
  converted_to_booking: 6,
}

/**
 * @param {string} lastActivityAt
 * @returns {boolean}
 */
export function isCustomerLeadInactive(lastActivityAt) {
  const t = new Date(lastActivityAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t > CUSTOMER_LEAD_ABANDON_MS
}

/**
 * @param {{ status?: string, last_activity_at?: string }} row
 * @returns {keyof typeof CUSTOMER_LEAD_STATUS_LABELS}
 */
export function effectiveCustomerLeadStatus(row) {
  const raw = String(row?.status || 'new_lead')
  if (raw === 'converted_to_booking' || raw === 'abandoned' || raw === 'payment_failed') return raw
  if (
    (raw === 'new_lead' ||
      raw === 'quote_started' ||
      raw === 'quote_viewed' ||
      raw === 'payment_started') &&
    isCustomerLeadInactive(row.last_activity_at)
  ) {
    return 'abandoned'
  }
  return /** @type {keyof typeof CUSTOMER_LEAD_STATUS_LABELS} */ (raw)
}

/**
 * Pick the furthest status in the funnel (never downgrade converted).
 * Abandoned / payment_failed reopen to active funnel statuses on new activity
 * so resumed quotes are not trapped; terminal converted stays locked.
 * @param {string} current
 * @param {string} next
 */
export function maxCustomerLeadStatus(current, next) {
  const cur = String(current || 'new_lead')
  const nxt = String(next || 'new_lead')
  if (cur === 'converted_to_booking' || nxt === 'converted_to_booking') {
    return 'converted_to_booking'
  }
  if (cur === 'abandoned' || cur === 'payment_failed') {
    if (nxt === 'abandoned' || nxt === 'payment_failed') {
      return cur === 'payment_failed' || nxt === 'payment_failed' ? 'payment_failed' : 'abandoned'
    }
    // Reopen: active quote activity replaces frozen recovery status.
    return nxt
  }
  const curRank = STATUS_RANK[cur] ?? 0
  const nextRank = STATUS_RANK[nxt] ?? 0
  return nextRank >= curRank ? nxt : cur
}
