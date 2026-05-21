/**
 * Group admin job lists by move date for list-view sections.
 */

/** @typedef {'today'|'tomorrow'|'upcoming'|'past'|'unknown'} MoveDateGroupKey */

export const MOVE_DATE_GROUP_ORDER = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past / Overdue' },
  { key: 'unknown', label: 'No move date' },
]

/**
 * @param {unknown} moveDate
 * @returns {MoveDateGroupKey}
 */
export function moveDateGroupKey(moveDate) {
  if (moveDate == null || moveDate === '') return 'unknown'
  const raw = String(moveDate).trim()
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(d.getTime())) return 'unknown'

  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const moveDay = startOfDay(d)

  if (moveDay.getTime() === today.getTime()) return 'today'
  if (moveDay.getTime() === tomorrow.getTime()) return 'tomorrow'
  if (moveDay.getTime() < today.getTime()) return 'past'
  return 'upcoming'
}

/** @param {Date} d */
function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {{ key: MoveDateGroupKey, label: string, jobs: Record<string, unknown>[] }[]}
 */
export function groupJobsByMoveDate(rows) {
  /** @type {Map<MoveDateGroupKey, Record<string, unknown>[]>} */
  const buckets = new Map(MOVE_DATE_GROUP_ORDER.map((g) => [g.key, []]))
  for (const q of rows) {
    const key = moveDateGroupKey(q.move_date)
    buckets.get(key).push(q)
  }
  return MOVE_DATE_GROUP_ORDER.map((g) => ({
    key: g.key,
    label: g.label,
    jobs: buckets.get(g.key),
  })).filter((s) => s.jobs.length > 0)
}
