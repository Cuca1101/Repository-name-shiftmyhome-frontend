/**
 * Scottish bank holidays for quote peak-date pricing (airline-style calendar surcharges).
 * Dates follow standard UK substitution rules; used only when bankHolidaySurchargePercent > 0.
 */

/** @type {Map<number, Map<string, string>>} */
const yearCache = new Map()

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * @param {Date} date
 * @param {number} deltaDays
 * @returns {Date}
 */
function addDays(date, deltaDays) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + deltaDays)
  return d
}

/**
 * @param {number} year
 * @returns {Date}
 */
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * @param {number} year
 * @param {number} month 0–11
 * @returns {Date}
 */
function firstMondayOfMonth(year, month) {
  const d = new Date(year, month, 1)
  const dow = d.getDay()
  const offset = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow
  return new Date(year, month, 1 + offset)
}

/**
 * @param {number} year
 * @param {number} month 0–11
 * @returns {Date}
 */
function lastMondayOfMonth(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  for (let day = lastDay; day >= 1; day -= 1) {
    const d = new Date(year, month, day)
    if (d.getDay() === 1) return d
  }
  return new Date(year, month, 1)
}

/**
 * @param {Map<string, string>} map
 * @param {Date} date
 * @param {string} name
 */
function addHoliday(map, date, name) {
  map.set(toIsoDate(date), name)
}

/**
 * @param {Map<string, string>} map
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day
 * @param {string} name
 */
function addObservedFixedHoliday(map, year, month, day, name) {
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()
  if (dow === 6) {
    addHoliday(map, addDays(d, 2), `${name} (substitute)`)
    return
  }
  if (dow === 0) {
    addHoliday(map, addDays(d, 1), `${name} (substitute)`)
    return
  }
  addHoliday(map, d, name)
}

/**
 * Christmas / Boxing Day — UK substitution when both fall on a weekend.
 * @param {Map<string, string>} map
 * @param {number} year
 */
function addChristmasAndBoxing(map, year) {
  const christmas = new Date(year, 11, 25)
  const boxing = new Date(year, 11, 26)
  const xd = christmas.getDay()
  const bd = boxing.getDay()

  if (xd === 5 && bd === 6) {
    addHoliday(map, christmas, 'Christmas Day')
    addHoliday(map, addDays(boxing, 2), 'Boxing Day (substitute)')
    return
  }
  if (xd === 6 && bd === 0) {
    addHoliday(map, addDays(christmas, 2), 'Christmas Day (substitute)')
    addHoliday(map, addDays(boxing, 2), 'Boxing Day (substitute)')
    return
  }
  if (xd === 0 && bd === 1) {
    addHoliday(map, addDays(christmas, 2), 'Christmas Day (substitute)')
    addHoliday(map, boxing, 'Boxing Day')
    return
  }

  addObservedFixedHoliday(map, year, 12, 25, 'Christmas Day')
  addObservedFixedHoliday(map, year, 12, 26, 'Boxing Day')
}

/**
 * @param {number} year
 * @returns {Map<string, string>}
 */
function buildScottishBankHolidaysForYear(year) {
  const map = new Map()

  addObservedFixedHoliday(map, year, 1, 1, "New Year's Day")
  addObservedFixedHoliday(map, year, 1, 2, '2nd January')
  addHoliday(map, addDays(easterSunday(year), -2), 'Good Friday')
  addHoliday(map, firstMondayOfMonth(year, 4), 'Early May bank holiday')
  addHoliday(map, lastMondayOfMonth(year, 4), 'Spring bank holiday')
  addHoliday(map, firstMondayOfMonth(year, 7), 'Summer bank holiday')
  addObservedFixedHoliday(map, year, 11, 30, "St Andrew's Day")
  addChristmasAndBoxing(map, year)

  return map
}

/**
 * @param {number} year
 * @returns {Map<string, string>}
 */
function holidaysForYear(year) {
  if (yearCache.has(year)) return yearCache.get(year)
  const map = buildScottishBankHolidaysForYear(year)
  yearCache.set(year, map)
  return map
}

/**
 * @param {string|undefined} isoDate YYYY-MM-DD
 * @returns {boolean}
 */
export function isBankHolidayDate(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const year = Number(m[1])
  if (!Number.isFinite(year)) return false
  return holidaysForYear(year).has(isoDate)
}

/**
 * @param {string|undefined} isoDate YYYY-MM-DD
 * @returns {string}
 */
export function getBankHolidayName(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const year = Number(m[1])
  if (!Number.isFinite(year)) return ''
  return holidaysForYear(year).get(isoDate) || ''
}

/**
 * Upcoming Scottish bank holidays from today (local), for admin preview.
 * @param {number} [limit]
 * @returns {{ date: string, name: string }[]}
 */
export function listUpcomingScottishBankHolidays(limit = 8) {
  const max = Math.max(1, Math.min(24, Number(limit) || 8))
  const today = new Date()
  const todayIso = toIsoDate(today)
  const startYear = today.getFullYear()
  const entries = []

  for (let year = startYear; year <= startYear + 2; year += 1) {
    for (const [date, name] of holidaysForYear(year).entries()) {
      if (date >= todayIso) entries.push({ date, name })
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date))
  return entries.slice(0, max)
}

/** Clear cached years (tests only). */
export function clearBankHolidayCache() {
  yearCache.clear()
}
