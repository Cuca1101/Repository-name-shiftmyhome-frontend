/**
 * User-facing UK date/time formatting. Internal storage stays ISO (YYYY-MM-DD) in the database.
 */

/**
 * Calendar date for display: DD/MM/YYYY (en-GB).
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
    const d = new Date(`${s}T12:00:00`)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Date + time for admin / receipts (en-GB), e.g. 23/05/2026, 14:30
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatDateTimeUK(iso) {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
