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
