import { endOfDayUK, startOfDayUK, ukCalendarYmd } from './formatDateDisplay.js'

function ukMonthStartYmd() {
  const ymd = ukCalendarYmd()
  return `${ymd.slice(0, 7)}-01`
}

/** @typedef {'today'|'7d'|'30d'|'90d'|'month'|'year'} AnalyticsRangePreset */

/**
 * @param {AnalyticsRangePreset} preset
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function analyticsDateRange(preset) {
  const end = endOfDayUK()
  const start = startOfDayUK()

  switch (preset) {
    case 'today':
      return { start, end, label: 'Today' }
    case '7d': {
      const s = startOfDayUK(new Date(end.getTime() - 6 * 86400000))
      return { start: s, end, label: 'Last 7 days' }
    }
    case '30d': {
      const s = startOfDayUK(new Date(end.getTime() - 29 * 86400000))
      return { start: s, end, label: 'Last 30 days' }
    }
    case '90d': {
      const s = startOfDayUK(new Date(end.getTime() - 89 * 86400000))
      return { start: s, end, label: 'Last 90 days' }
    }
    case 'month': {
      const ymd = ukMonthStartYmd()
      const s = startOfDayUK(new Date(`${ymd}T12:00:00Z`))
      return { start: s, end, label: 'This month' }
    }
    case 'year': {
      const y = ukCalendarYmd().slice(0, 4)
      const s = startOfDayUK(new Date(`${y}-01-01T12:00:00Z`))
      return { start: s, end, label: 'This year' }
    }
    default: {
      const s = startOfDayUK(new Date(end.getTime() - 29 * 86400000))
      return { start: s, end, label: 'Last 30 days' }
    }
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
