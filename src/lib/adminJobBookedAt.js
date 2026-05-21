import { formatDateTimeUK } from './formatDateDisplay'

/**
 * UK booking timestamp for admin job cards: "Booked: DD/MM/YYYY HH:mm"
 * Uses paid_at when set, otherwise created_at.
 * @param {Record<string, unknown>} q
 * @returns {string|null}
 */
export function formatAdminJobBookedLine(q) {
  const iso = q.paid_at ?? q.created_at
  if (iso == null || iso === '') return null
  const formatted = formatDateTimeUK(iso)
  if (!formatted || formatted === '—') return null
  return `Booked: ${formatted.replace(', ', ' ')}`
}
