/**
 * User-facing UK date/time formatting. Internal storage stays ISO/UTC in the database.
 * Always display in Europe/London so admin matches UK business time (GMT/BST).
 */

export const UK_TIME_ZONE = 'Europe/London'

const UK_DATE_OPTS = {
  timeZone: UK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

const UK_DATETIME_OPTS = {
  timeZone: UK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * Calendar date for display: DD/MM/YYYY (en-GB, UK timezone).
 * Accepts stored ISO date (YYYY-MM-DD), ISO datetime, or an already-formatted UK date string.
 * @param {string | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatDateUK(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '—'
  const s = String(isoOrDate).trim()
  if (!s) return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [, y, m, d] = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) || []
    if (y && m && d) return `${d}/${m}/${y}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', UK_DATE_OPTS)
}

/**
 * Date + time for admin / receipts (en-GB, Europe/London), e.g. 30/05/2026, 14:30
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatDateTimeUK(iso) {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', UK_DATETIME_OPTS)
}

/**
 * e.g. 30 May 2026 (Europe/London)
 * @param {string | Date | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatDateMediumUK(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '—'
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate).trim())
  if (Number.isNaN(d.getTime())) return String(isoOrDate)
  return d.toLocaleDateString('en-GB', {
    timeZone: UK_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * e.g. 30 May 2026 (short month, Europe/London)
 * @param {string | Date | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatDateShortUK(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '—'
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate).trim())
  if (Number.isNaN(d.getTime())) return String(isoOrDate)
  return d.toLocaleDateString('en-GB', {
    timeZone: UK_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Calendar yyyy-mm-dd for "today" in UK (analytics filters, date inputs).
 * @param {Date} [ref]
 * @returns {string}
 */
export function ukCalendarYmd(ref = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: UK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

/**
 * @param {Date} ref
 * @returns {Date}
 */
export function startOfDayUK(ref = new Date()) {
  const ymd = ukCalendarYmd(ref)
  const [y, m, d] = ymd.split('-').map(Number)
  for (let h = -2; h < 26; h += 1) {
    const probe = new Date(Date.UTC(y, m - 1, d, h, 0, 0, 0))
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: UK_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(probe)
    const py = parts.find((p) => p.type === 'year')?.value
    const pm = parts.find((p) => p.type === 'month')?.value
    const pd = parts.find((p) => p.type === 'day')?.value
    const ph = parts.find((p) => p.type === 'hour')?.value
    if (Number(py) === y && Number(pm) === m && Number(pd) === d && ph === '00') {
      return probe
    }
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

/**
 * @param {Date} ref
 * @returns {Date}
 */
export function endOfDayUK(ref = new Date()) {
  const start = startOfDayUK(ref)
  const next = startOfDayUK(new Date(start.getTime() + 36 * 3600000))
  return new Date(next.getTime() - 1)
}
