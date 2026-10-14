/** Customer Leads list rules: Trash, move-date badges, and the 12-hour converted window. */

export const CONVERTED_LEAD_VISIBLE_MS = 12 * 60 * 60 * 1000
export const TO_CALL_WINDOW_MS = 48 * 60 * 60 * 1000

const LONDON = 'Europe/London'

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function customerLeadIsTrashed(row) {
  return Boolean(row?.deleted_at)
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function customerLeadIsConverted(row) {
  if (!row) return false
  const status = String(row.status || '')
  const effective = String(row.effective_status || status)
  if (status === 'converted_to_booking' || effective === 'converted_to_booking') return true
  return Boolean(row.converted_at)
}

/**
 * Converted leads stay on the Customer Leads list for 12 hours after converted_at.
 * A converted lead with no timestamp stays listed. This does not affect the booking.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {number | Date} [now]
 */
export function convertedLeadVisibleInCustomerLeads(row, now = Date.now()) {
  if (!customerLeadIsConverted(row)) return true
  const convertedAt = Date.parse(String(row?.converted_at || ''))
  if (!Number.isFinite(convertedAt)) return true
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  return nowMs - convertedAt < CONVERTED_LEAD_VISIBLE_MS
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} filterId
 */
export function customerLeadMatchesStatusFilter(row, filterId) {
  if (filterId === 'all' || filterId === 'trash') return true
  const effective = String(row.effective_status || row.status || '')
  if (filterId === 'new') {
    return (
      effective === 'new_lead' ||
      effective === 'quote_started' ||
      effective === 'quote_viewed' ||
      effective === 'payment_started'
    )
  }
  if (filterId === 'abandoned') return effective === 'abandoned' || effective === 'payment_failed'
  if (filterId === 'converted') return customerLeadIsConverted(row)
  return true
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} filterId
 * @param {number | Date} [now]
 */
function nowMs(now) {
  return now instanceof Date ? now.getTime() : Number(now)
}

/**
 * Real card payment. An admin Create job marks the booking paid without a Stripe charge.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function customerLeadCustomerPaid(row) {
  return Boolean(row?.customer_paid)
}

/**
 * The saved callback time has arrived and the notice has not been closed.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {number | Date} [now]
 */
export function customerLeadCallbackDue(row, now = Date.now()) {
  if (!row || customerLeadIsTrashed(row)) return false
  const at = Date.parse(String(row.callback_at || ''))
  if (!Number.isFinite(at) || at > nowMs(now)) return false
  const dismissed = Date.parse(String(row.callback_dismissed_at || ''))
  return !Number.isFinite(dismissed) || dismissed < at
}

/**
 * A new unpaid lead stays "To call" for 48 hours, until someone marks it called or the customer pays.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {number | Date} [now]
 */
export function customerLeadNeedsFirstCall(row, now = Date.now()) {
  if (!row || customerLeadIsTrashed(row) || customerLeadCustomerPaid(row) || row.called_at) return false
  const created = Date.parse(String(row.created_at || ''))
  if (!Number.isFinite(created)) return false
  return nowMs(now) - created < TO_CALL_WINDOW_MS
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @param {number | Date} [now]
 */
export function customerLeadToCall(row, now = Date.now()) {
  return customerLeadNeedsFirstCall(row, now) || customerLeadCallbackDue(row, now)
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} filterId
 * @param {number | Date} [now]
 */
export function customerLeadVisibleInList(row, filterId, now = Date.now()) {
  const trashed = customerLeadIsTrashed(row)
  if (filterId === 'trash') return trashed
  if (trashed) return false
  if (!convertedLeadVisibleInCustomerLeads(row, now)) return false
  if (filterId === 'to_call') return customerLeadToCall(row, now)
  return customerLeadMatchesStatusFilter(row, filterId)
}

/**
 * Calendar date in Europe/London as YYYY-MM-DD.
 * @param {Date} date
 */
export function londonCalendarYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * @param {string} ymd
 */
function utcDayFromYmd(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Interpret a clock time as Europe/London and return the UTC instant.
 * @param {string} ymd
 * @param {string} raw
 */
function londonDateTimeToUtcMs(ymd, raw) {
  const match = /(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || '0')
  const target = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), hour, minute, second)
  let utc = target
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc))
    const read = (type) => Number(parts.find((part) => part.type === type)?.value)
    const shown = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
    const delta = target - shown
    if (delta === 0) return utc
    utc += delta
  }
  return utc
}

/**
 * Badge for an unconverted lead, from the move date in Europe/London.
 * A date without a time becomes Expired after that London day ends.
 * @param {unknown} moveDate
 * @param {Date} [now]
 * @returns {{ label: string, tone: 'expired' | 'soon' | 'calm', highlight: boolean, daysLeft: number } | null}
 */
export function customerLeadMoveCountdown(moveDate, now = new Date()) {
  const raw = String(moveDate ?? '').trim()
  if (!raw) return null
  const ymd = raw.slice(0, 10)
  const moveDay = utcDayFromYmd(ymd)
  if (moveDay == null) return null

  const clock = new Date(now)
  const clockMatch = /(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw)
  const hasTime = Boolean(
    clockMatch &&
      !(Number(clockMatch[1]) === 0 && Number(clockMatch[2]) === 0 && Number(clockMatch[3] || '0') === 0),
  )
  if (hasTime) {
    const instant = londonDateTimeToUtcMs(ymd, raw)
    if (instant != null && clock.getTime() >= instant) {
      return { label: 'Expired', tone: 'expired', highlight: true, daysLeft: -1 }
    }
  }

  const today = utcDayFromYmd(londonCalendarYmd(clock))
  if (today == null) return null
  const daysLeft = Math.round((moveDay - today) / 86400000)
  if (daysLeft < 0) return { label: 'Expired', tone: 'expired', highlight: true, daysLeft }
  if (daysLeft === 0) return { label: 'Move date today', tone: 'soon', highlight: true, daysLeft }
  if (daysLeft === 1) return { label: '1 day left', tone: 'soon', highlight: true, daysLeft }
  if (daysLeft === 2) return { label: '2 days left', tone: 'soon', highlight: true, daysLeft }
  return { label: `${daysLeft} days left`, tone: 'calm', highlight: false, daysLeft }
}
