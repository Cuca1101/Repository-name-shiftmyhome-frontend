/** Shown when the chosen move date is before today in the user's local calendar. */
export const MOVE_DATE_PAST_ERROR = 'Please choose today or a future date.'

/**
 * Today's date in the user's local timezone as `YYYY-MM-DD` (for `<input type="date" min>` and comparisons).
 * @returns {string}
 */
export function getLocalDateYYYYMMDD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * True if `isoDate` is a valid `YYYY-MM-DD` on or after local today (string compare is safe for ISO dates).
 * @param {string | undefined} isoDate
 * @returns {boolean}
 */
export function isMoveDateOnOrAfterToday(isoDate) {
  const t = (isoDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  return t >= getLocalDateYYYYMMDD()
}

const MS_48_HOURS = 48 * 60 * 60 * 1000

/**
 * £50 deposit is only offered when the move date is at least 48 hours away (local calendar).
 * Uses start of move day (00:00 local) vs current time.
 * @param {string | undefined} isoDate `YYYY-MM-DD`
 * @returns {boolean}
 */
export function isDepositPaymentAllowedForMoveDate(isoDate) {
  const t = (isoDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return true
  const [y, m, d] = t.split('-').map(Number)
  const moveStart = new Date(y, m - 1, d, 0, 0, 0, 0)
  const msUntilMove = moveStart.getTime() - Date.now()
  return msUntilMove >= MS_48_HOURS
}
