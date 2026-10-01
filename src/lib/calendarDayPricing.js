/**
 * Step 3 calendar: weekday best-price discount and daily job slots.
 * Monday = 1 … Friday = 5, Saturday = 6, Sunday = 0 (local calendar).
 */

export const WEEKDAY_BEST_PRICE_OPTIONS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
]

export const DAILY_SLOT_WEEKDAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 0, label: 'Sunday' },
]

const WEEKDAY_LABELS = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/**
 * @param {string | undefined} isoDate
 * @returns {number | null}
 */
export function isoWeekday(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(dt.getTime())) return null
  return dt.getDay()
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeWeekdayBestPricePercent(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(80, Math.round(n * 10) / 10)
}

/**
 * Weekdays that receive the best-price reduction. Monday–Friday only.
 * @param {unknown} raw
 * @returns {number[]}
 */
export function normalizeWeekdayBestPriceDays(raw) {
  const list = Array.isArray(raw) ? raw : []
  const days = [
    ...new Set(
      list
        .map((value) => Number(value))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 5),
    ),
  ]
  days.sort((a, b) => a - b)
  return days
}

/**
 * Jobs the company can take on each weekday, as saved in Pricing Engine.
 * Missing key = no limit. 0 = closed. The number is not capped in code.
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function normalizeDailyJobSlots(raw) {
  /** @type {Record<string, number>} */
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const value = /** @type {Record<string, unknown>} */ (raw)[day] ?? /** @type {Record<string, unknown>} */ (raw)[String(day)]
    if (value === '' || value == null) continue
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n < 0) continue
    out[String(day)] = n
  }
  return out
}

/**
 * @param {Record<string, unknown> | null | undefined} settings
 * @param {string | undefined} isoDate
 * @returns {{ apply: boolean, percent: number, dayLabel: string }}
 */
export function resolveWeekdayBestPriceDiscount(settings, isoDate) {
  const percent = normalizeWeekdayBestPricePercent(settings?.weekdayBestPriceDiscountPercent)
  const days = normalizeWeekdayBestPriceDays(settings?.weekdayBestPriceDays)
  const day = isoWeekday(isoDate)
  const apply = percent > 0 && day != null && days.includes(day)
  return {
    apply,
    percent: apply ? percent : 0,
    dayLabel: day != null ? WEEKDAY_LABELS[day] || '' : '',
  }
}

/**
 * Orange "Best price" days are the weekdays ticked in Pricing Engine.
 * @param {Record<string, unknown> | null | undefined} settings
 * @param {string | undefined} isoDate
 */
export function isCalendarBestPriceDate(settings, isoDate) {
  if (settings?.showCalendarBestPrice === false) return false
  const day = isoWeekday(isoDate)
  if (day == null) return false
  return normalizeWeekdayBestPriceDays(settings?.weekdayBestPriceDays).includes(day)
}

/**
 * @param {Record<string, unknown> | null | undefined} settings
 * @param {string | undefined} isoDate
 * @returns {number | null} null = unlimited
 */
export function slotCapacityForDate(settings, isoDate) {
  const day = isoWeekday(isoDate)
  if (day == null) return null
  const slots = normalizeDailyJobSlots(settings?.dailyJobSlots)
  const key = String(day)
  if (!Object.prototype.hasOwnProperty.call(slots, key)) return null
  return slots[key]
}

/**
 * @param {Record<string, unknown> | null | undefined} settings
 * @param {string} isoDate
 * @param {number} booked
 * @returns {{ limited: boolean, capacity: number | null, remaining: number | null, full: boolean }}
 */
export function resolveDaySlotAvailability(settings, isoDate, booked) {
  const capacity = slotCapacityForDate(settings, isoDate)
  if (capacity == null) {
    return { limited: false, capacity: null, remaining: null, full: false }
  }
  const used = Math.max(0, Math.floor(Number(booked) || 0))
  const remaining = Math.max(0, capacity - used)
  return {
    limited: true,
    capacity,
    remaining,
    full: remaining <= 0,
  }
}
