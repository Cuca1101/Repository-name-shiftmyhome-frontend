/**
 * Cheaper-date hint for the review calendar.
 * Candidates must already be priced for the same move, package, and extras.
 */

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

/**
 * @param {Array<{ moveDate: string, total: number | null, past?: boolean, full?: boolean }>} candidates
 * @param {string} selectedDate
 * @returns {{ moveDate: string, total: number, save: number } | null}
 */
export function findCheaperReviewDate(candidates, selectedDate) {
  const selected = (candidates || []).find((row) => row.moveDate === selectedDate)
  const selectedTotal = money(selected?.total)
  if (!selected || selected.past || selected.full || selectedTotal == null) return null

  let best = null
  for (const row of candidates || []) {
    if (!row || row.moveDate === selectedDate || row.past || row.full) continue
    const total = money(row.total)
    if (total == null || total >= selectedTotal - 0.009) continue
    if (!best || total < best.total) best = { moveDate: row.moveDate, total }
  }
  if (!best) return null
  return { ...best, save: money(selectedTotal - best.total) }
}
