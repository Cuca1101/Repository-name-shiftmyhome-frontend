/**
 * Calendar date display for customer emails / portals: DD/MM/YYYY.
 * Keeps ISO (YYYY-MM-DD) values in the DB — only formats for display.
 *
 * For plain YYYY-MM-DD strings, remaps day/month/year without Date parsing
 * so the calendar day never shifts across timezones.
 */

/** Calendar date for display: DD/MM/YYYY. */
export function formatDateUK(isoOrDate: unknown): string {
  if (isoOrDate == null || isoOrDate === '') return '—'
  const s = String(isoOrDate).trim()
  if (!s) return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  // Prefer leading YYYY-MM-DD (date columns, or timestamptz cast to date string).
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${d}/${m}/${y}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
