/** @typedef {'today'|'7d'|'30d'|'90d'|'month'|'year'} AnalyticsRangePreset */

/**
 * @param {AnalyticsRangePreset} preset
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function analyticsDateRange(preset) {
  const end = new Date()
  const start = new Date(end)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  switch (preset) {
    case 'today':
      return { start, end, label: 'Today' }
    case '7d':
      start.setDate(start.getDate() - 6)
      return { start, end, label: 'Last 7 days' }
    case '30d':
      start.setDate(start.getDate() - 29)
      return { start, end, label: 'Last 30 days' }
    case '90d':
      start.setDate(start.getDate() - 89)
      return { start, end, label: 'Last 90 days' }
    case 'month':
      start.setDate(1)
      return { start, end, label: 'This month' }
    case 'year':
      start.setMonth(0, 1)
      return { start, end, label: 'This year' }
    default:
      start.setDate(start.getDate() - 29)
      return { start, end, label: 'Last 30 days' }
  }
}

/**
 * @param {Record<string, unknown>} q
 * @returns {number}
 */
export function quoteRevenueTimestampMs(q) {
  const paid = q.paid_at ? new Date(String(q.paid_at)).getTime() : NaN
  if (Number.isFinite(paid) && paid > 0) return paid
  const created = q.created_at ? new Date(String(q.created_at)).getTime() : NaN
  return Number.isFinite(created) ? created : 0
}

/**
 * @param {Record<string, unknown>} q
 * @param {Date} start
 * @param {Date} end
 */
export function quoteInRange(q, start, end) {
  const t = quoteRevenueTimestampMs(q)
  return t >= start.getTime() && t <= end.getTime()
}
