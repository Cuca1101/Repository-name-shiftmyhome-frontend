/**
 * Manual Finance & Profit totals. Amounts stay in integer pence.
 * Nothing here reads bookings, jobs, payments or the driver list.
 */

export const FINANCE_TIME_ZONE = 'Europe/London'

export const FINANCE_BUCKETS = {
  diesel: 'diesel',
  driver_pay: 'driver_pay',
  helper_pay: 'helper_pay',
  other: 'other',
}

const PIN_DIGITS = 8

/** Keep typed PIN digits, including a leading zero. Never parse as a number. */
export function normalizeFinancePin(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, PIN_DIGITS)
}

export function isFinancePinComplete(pin) {
  return /^\d{8}$/.test(String(pin ?? ''))
}

export function assertFinanceUnlocked(token) {
  if (!token || String(token).length < 32) {
    const error = new Error('Finance module is locked. Enter the PIN again.')
    error.code = 'FINANCE_LOCKED'
    throw error
  }
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  const [year, month, day] = String(value).split('-').map(Number)
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** @param {unknown} amount */
export function toPence(amount) {
  const raw = String(amount ?? '').trim().replace(/£/g, '').replace(/,/g, '')
  if (!raw) return 0
  const negative = raw.startsWith('-')
  const clean = negative ? raw.slice(1) : raw
  if (!/^\d+(\.\d+)?$/.test(clean)) return 0
  const [whole, fraction = ''] = clean.split('.')
  const pence = Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
  return negative ? -pence : pence
}

/** @param {number} pence */
export function formatGbp(pence) {
  const value = Math.round(Number(pence) || 0)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const pounds = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${sign}£${pounds.toLocaleString('en-GB')}.${fraction}`
}

export function profitTone(pence) {
  if (pence > 0) return 'profit'
  if (pence < 0) return 'loss'
  return 'even'
}

export function profitTextClass(pence) {
  const tone = profitTone(pence)
  if (tone === 'profit') return 'text-emerald-700'
  if (tone === 'loss') return 'text-red-600'
  return 'text-slate-800'
}

/**
 * @param {string} raw
 * @returns {{ ok: true, amount: string } | { ok: false, error: string }}
 */
export function parseGbpInput(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/£/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Enter an amount in pounds, with up to 2 decimal places.' }
  }
  const [whole, fraction = ''] = cleaned.split('.')
  const normalized = `${String(Number(whole))}.${(fraction + '00').slice(0, 2)}`
  const pence = toPence(normalized)
  if (pence <= 0 || pence > 100000000) {
    return { ok: false, error: 'Enter an amount greater than £0.00 and up to £1,000,000.00.' }
  }
  return { ok: true, amount: normalized }
}

export function londonTodayIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: FINANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function shiftIsoDate(iso, days) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  return date.toISOString().slice(0, 10)
}

/** Monday–Sunday week that contains this calendar date. */
export function weekRangeContaining(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const weekday = date.getUTCDay()
  const daysFromMonday = weekday === 0 ? -6 : 1 - weekday
  const from = shiftIsoDate(iso, daysFromMonday)
  return { from, to: shiftIsoDate(from, 6) }
}

export function shiftWeek(fromIso, direction) {
  return weekRangeContaining(shiftIsoDate(fromIso, direction * 7))
}

export function monthBounds(year, month) {
  const safeYear = Number(year)
  const safeMonth = Number(month)
  const from = `${String(safeYear).padStart(4, '0')}-${String(safeMonth).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(safeYear, safeMonth, 0, 12)).getUTCDate()
  const to = `${String(safeYear).padStart(4, '0')}-${String(safeMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export function monthYearFromIso(iso) {
  const [year, month] = String(iso).split('-').map(Number)
  return { year, month }
}

export function isCurrentLondonMonth(year, month, now = new Date()) {
  const today = monthYearFromIso(londonTodayIso(now))
  return today.year === Number(year) && today.month === Number(month)
}

export function formatIsoLong(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date)
  const rest = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return `${weekday} ${rest}`
}

export function formatIsoShort(iso) {
  const [year, month, day] = String(iso).split('-')
  return `${day}/${month}/${year}`
}

export function formatMonthYear(year, month) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12))
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function financePdfFilename(year, month) {
  return `ShiftMyHome_Finance_${year}-${String(month).padStart(2, '0')}.pdf`
}

export function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1 + Number(delta), 1, 12))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

/** Monday-first month grid. Empty cells are null. */
export function calendarCells(year, month) {
  const safeYear = Number(year)
  const safeMonth = Number(month)
  const first = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 12))
  const lead = (first.getUTCDay() + 6) % 7
  const last = new Date(Date.UTC(safeYear, safeMonth, 0, 12)).getUTCDate()
  const cells = []
  for (let index = 0; index < lead; index += 1) cells.push(null)
  for (let day = 1; day <= last; day += 1) {
    cells.push(
      `${String(safeYear).padStart(4, '0')}-${String(safeMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    )
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatIsoHeading(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(date)
  const rest = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
  return `${weekday}, ${rest}`
}

export function driverCountLabel(count) {
  const total = Math.max(0, Math.round(Number(count) || 0))
  return `${total} ${total === 1 ? 'driver' : 'drivers'}`
}

/** Missing values use 25. A typed 0 stays 0. */
export function readDeductionPercent(value, fallback = 25) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  const rounded = Math.round(number * 100) / 100
  if (rounded < 0) return 0
  if (rounded > 100) return 100
  return rounded
}

export function formatDeductionPercent(percent) {
  const value = readDeductionPercent(percent)
  return `${Number(value.toFixed(2))}%`
}

/**
 * @param {string} raw
 * @returns {{ ok: true, percent: number } | { ok: false, error: string }}
 */
export function parseDeductionPercent(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/%/g, '')
    .replace(/\s/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Enter a percentage from 0 to 100, with up to 2 decimal places.' }
  }
  const percent = Math.round(Number(cleaned) * 100) / 100
  if (percent < 0 || percent > 100) {
    return { ok: false, error: 'Enter a percentage from 0 to 100.' }
  }
  return { ok: true, percent }
}

export function resolveDeductionPercent(input, percent) {
  if (percent !== undefined && percent !== null && percent !== '') return readDeductionPercent(percent)
  if (input && input.deductionPercent != null && input.deductionPercent !== '') {
    return readDeductionPercent(input.deductionPercent)
  }
  return 25
}

/**
 * Apply the percentage once to a period profit. Losses are not reduced.
 * @returns {{ deduction: number, finalAmount: number }}
 */
export function applyFinanceDeduction(profitPence, percent) {
  const profit = Math.round(Number(profitPence) || 0)
  const hundredths = Math.round(readDeductionPercent(percent) * 100)
  if (profit <= 0 || hundredths <= 0) return { deduction: 0, finalAmount: profit }
  const deduction = Math.round((profit * hundredths) / 10000)
  return { deduction, finalAmount: profit - deduction }
}

/** @param {string} raw */
export function parseGbpAllowZero(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/£/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
  if (cleaned === '') return { ok: true, amount: '0.00' }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Enter an amount in pounds, with up to 2 decimal places.' }
  }
  const [whole, fraction = ''] = cleaned.split('.')
  const normalized = `${String(Number(whole))}.${(fraction + '00').slice(0, 2)}`
  const pence = toPence(normalized)
  if (pence < 0 || pence > 100000000) {
    return { ok: false, error: 'Enter an amount from £0.00 up to £1,000,000.00.' }
  }
  return { ok: true, amount: normalized }
}

export function driverDayProfitPence(row) {
  return (
    toPence(row?.income_gbp) +
    toPence(row?.another_income_gbp) -
    toPence(row?.salary_gbp) -
    toPence(row?.diesel_gbp) -
    toPence(row?.other_gbp)
  )
}

export function financeAmountPence(raw) {
  const parsed = parseGbpAllowZero(raw)
  return parsed.ok ? toPence(parsed.amount) : 0
}

export function penceToAmount(pence) {
  const value = Math.round(Number(pence) || 0)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

function draftMoney(amount) {
  const text = String(amount ?? '').trim()
  if (!text || financeAmountPence(text) === 0) return ''
  return text
}

export const FINANCE_INCOME_SOURCE_PRESETS = ['ShiftMyHome', 'AnyVan', 'ShiftMyHome + AnyVan']

/** A saved custom source reopens as Other plus the typed name. Presets stay selected. */
export function splitIncomeSource(stored) {
  const name = String(stored || '').trim().replace(/\s+/g, ' ')
  if (!name) return { choice: '', custom: '' }
  if (FINANCE_INCOME_SOURCE_PRESETS.includes(name)) return { choice: name, custom: '' }
  return { choice: 'other', custom: name }
}

/** The name stored on the day. Other keeps the typed name, never the word Other. */
export function resolveIncomeSource(row) {
  const choice = String(row?.sourceChoice || '')
  if (choice === 'other') return String(row?.sourceCustom || '').trim().replace(/\s+/g, ' ')
  if (FINANCE_INCOME_SOURCE_PRESETS.includes(choice)) return choice
  return String(row?.source || '').trim().replace(/\s+/g, ' ')
}

export function blankDriverDraftRow(partial = {}) {
  const attendance = partial.attendance || (partial.worked ? 'worked' : 'not_set')
  const parsed = splitIncomeSource(partial.source || '')
  const sourceChoice = partial.sourceChoice ?? parsed.choice
  const sourceCustom = partial.sourceCustom ?? (sourceChoice === 'other' ? parsed.custom : '')
  return {
    key: partial.key || '',
    id: partial.id || '',
    driverId: partial.driverId || '',
    driverName: partial.driverName || '',
    sourceChoice,
    sourceCustom,
    source: sourceChoice === 'other' ? sourceCustom : sourceChoice || parsed.choice,
    income: partial.income || '',
    anotherIncome: partial.anotherIncome || '',
    salary: partial.salary || '',
    diesel: partial.diesel || '',
    other: partial.other || '',
    otherDescription: partial.otherDescription || '',
    attendance,
    worked: attendance === 'worked',
  }
}

/** Draft rows use Not set until Worked or Did not work is chosen. A stored row without a status is a legacy worked day. */
export function rowAttendance(row, { stored = false } = {}) {
  if (row?.attendance === 'worked' || row?.attendance === 'absent' || row?.attendance === 'not_set') return row.attendance
  if (row?.worked) return 'worked'
  return stored ? 'worked' : 'not_set'
}

export function financeRowHasAmounts(row) {
  if (!row) return false
  if (String(row.sourceChoice || '').trim() || String(row.source || '').trim()) return true
  if (String(row.otherDescription || '').trim()) return true
  return ['income', 'anotherIncome', 'salary', 'diesel', 'other'].some((key) => financeAmountPence(row[key]) > 0)
}

/** A stored Worked or Did not work row is an entry. An unticked row is not stored until Save day. */
export function financeRowHasEntry(row) {
  if (!row) return false
  const attendance = rowAttendance(row)
  if (attendance === 'worked' || attendance === 'absent') return true
  if (String(row.sourceChoice || '').trim()) return true
  return financeRowHasAmounts(row)
}

/**
 * Save day confirms every named driver still on the day.
 * Unticked drivers are stored as Worked, including £0. Did not work stays absent.
 * Opening a date does not use this, so an unsaved day creates no worked records.
 */
export function financeRowsConfirmedOnSave(rows, removedDayIds = []) {
  const removed = new Set((removedDayIds || []).filter(Boolean))
  return (rows || []).flatMap((row) => {
    const driverName = String(row?.driverName || '').trim().replace(/\s+/g, ' ')
    if (!driverName || removed.has(row?.id)) return []
    const attendance = rowAttendance(row) === 'absent' ? 'absent' : 'worked'
    return [{ ...row, driverName, attendance, worked: attendance === 'worked' }]
  })
}

export function financeDraftProfitPence(row) {
  return (
    financeAmountPence(row?.income) +
    financeAmountPence(row?.anotherIncome) -
    financeAmountPence(row?.salary) -
    financeAmountPence(row?.diesel) -
    financeAmountPence(row?.other)
  )
}

function draftFromSavedDay(row, driverId = '') {
  const attendance = rowAttendance(row, { stored: true })
  const absent = attendance === 'absent'
  const sourceParts = splitIncomeSource(absent ? '' : row.source_name)
  return blankDriverDraftRow({
    key: row.id || `saved-${driverId || row.driver_name}`,
    id: row.id || '',
    driverId: row.driver_id || driverId,
    driverName: row.driver_name || '',
    sourceChoice: sourceParts.choice,
    sourceCustom: sourceParts.custom,
    source: sourceParts.choice === 'other' ? sourceParts.custom : sourceParts.choice,
    income: absent ? '' : draftMoney(row.income_gbp),
    anotherIncome: absent ? '' : draftMoney(row.another_income_gbp),
    salary: absent ? '' : draftMoney(row.salary_gbp),
    diesel: absent ? '' : draftMoney(row.diesel_gbp),
    other: absent ? '' : draftMoney(row.other_gbp),
    otherDescription: absent ? '' : row.other_description || '',
    attendance,
  })
}

/**
 * Every active saved driver is a row on the selected date.
 * A driver without a record for that date stays empty. Amounts are never copied from another date.
 */
export function buildFinanceDayDraft(records, date) {
  const savedDays = (records?.driverDays || [])
    .filter((row) => row.activity_date === date)
    .sort(
      (left, right) =>
        String(left.driver_name).localeCompare(String(right.driver_name), 'en-GB') ||
        String(left.id).localeCompare(String(right.id)),
    )
  const unused = [...savedDays]
  const activeDrivers = (records?.drivers || [])
    .filter((driver) => !driver.archived)
    .sort((left, right) => String(left.name).localeCompare(String(right.name), 'en-GB'))
  const rows = activeDrivers.map((driver) => {
    const byId = unused.findIndex((row) => row.driver_id && row.driver_id === driver.id)
    const byName =
      byId >= 0
        ? -1
        : unused.findIndex(
            (row) => String(row.driver_name || '').trim().toLocaleLowerCase('en-GB') === driver.name.toLocaleLowerCase('en-GB'),
          )
    const matchIndex = byId >= 0 ? byId : byName
    if (matchIndex >= 0) {
      const [saved] = unused.splice(matchIndex, 1)
      return draftFromSavedDay(saved, driver.id)
    }
    return blankDriverDraftRow({
      key: `placeholder-${driver.id}`,
      driverId: driver.id,
      driverName: driver.name,
      attendance: 'not_set',
    })
  })
  for (const saved of unused) rows.push(draftFromSavedDay(saved))

  return {
    date,
    rows,
    incomes: (records?.incomes || [])
      .filter((row) => row.activity_date === date)
      .map((row) => ({
        key: row.id,
        id: row.id,
        source: row.source_name || '',
        amount: draftMoney(row.amount_gbp),
        description: row.description || '',
      })),
    expenses: (records?.expenses || [])
      .filter((row) => row.expense_date === date)
      .map((row) => ({
        key: row.id,
        id: row.id,
        categoryId: row.category_id || '',
        newCategory: '',
        amount: draftMoney(row.amount_gbp),
        description: row.description || '',
        payee: row.payee_name || '',
        receiptPath: row.receipt_path || '',
        receiptName: row.receipt_name || '',
      })),
    removedDayIds: [],
    removedIncomeIds: [],
    removedExpenseIds: [],
  }
}

export function financeDayDraftSignature(draft) {
  const clean = (value) => String(value || '').trim()
  return JSON.stringify({
    rows: (draft?.rows || []).map((row) => ({
      id: row.id || '',
      driverId: row.driverId || '',
      driverName: clean(row.driverName),
      sourceChoice: row.sourceChoice || '',
      sourceCustom: clean(row.sourceCustom),
      source: clean(resolveIncomeSource(row)),
      income: clean(row.income),
      anotherIncome: clean(row.anotherIncome),
      salary: clean(row.salary),
      diesel: clean(row.diesel),
      other: clean(row.other),
      otherDescription: clean(row.otherDescription),
      attendance: rowAttendance(row),
    })),
    incomes: (draft?.incomes || []).map((row) => ({
      id: row.id || '',
      source: clean(row.source),
      amount: clean(row.amount),
      description: clean(row.description),
    })),
    expenses: (draft?.expenses || []).map((row) => ({
      id: row.id || '',
      categoryId: row.categoryId || '',
      newCategory: clean(row.newCategory),
      amount: clean(row.amount),
      description: clean(row.description),
      payee: clean(row.payee),
      receiptPath: row.receiptPath || '',
      receiptName: clean(row.receiptName),
    })),
    removedDayIds: [...(draft?.removedDayIds || [])].sort(),
    removedIncomeIds: [...(draft?.removedIncomeIds || [])].sort(),
    removedExpenseIds: [...(draft?.removedExpenseIds || [])].sort(),
  })
}

export function validateFinanceDayDraft(draft) {
  const errors = []
  const seen = new Set()
  for (const row of draft?.rows || []) {
    const name = String(row.driverName || '').trim().replace(/\s+/g, ' ')
    if (!name && !financeRowHasEntry(row)) continue
    if (!name) errors.push('Enter a driver name for each completed row.')
    else if (name.length > 80) errors.push('Enter a driver name up to 80 characters.')
    else {
      const key = name.toLocaleLowerCase('en-GB')
      if (seen.has(key)) errors.push(`${name} is on this day more than once.`)
      seen.add(key)
    }
    if (rowAttendance(row) === 'absent') continue
    if (row.sourceChoice === 'other' && !String(row.sourceCustom || '').trim()) {
      errors.push(`Enter an income source${name ? ` for ${name}` : ''}.`)
    }
    if (resolveIncomeSource(row).length > 80) errors.push('Enter an income source up to 80 characters.')
    for (const [label, value] of [
      ['Income', row.income],
      ['Another income', row.anotherIncome],
      ['Salary', row.salary],
      ['Diesel', row.diesel],
      ['Other expenses', row.other],
    ]) {
      const parsed = parseGbpAllowZero(value)
      if (!parsed.ok) errors.push(`${label}: ${parsed.error}`)
    }
    if (financeAmountPence(row.other) > 0 && !String(row.otherDescription || '').trim()) {
      errors.push(`Enter a description for other expenses${name ? ` for ${name}` : ''}.`)
    }
  }
  for (const row of draft?.incomes || []) {
    const source = String(row.source || '').trim()
    const amount = String(row.amount || '').trim()
    const description = String(row.description || '').trim()
    if (!source && !amount && !description) continue
    if (!source) errors.push('Enter a source for each additional income.')
    const parsed = parseGbpInput(amount)
    if (!parsed.ok) errors.push(`Additional income: ${parsed.error}`)
  }
  for (const row of draft?.expenses || []) {
    const amount = String(row.amount || '').trim()
    const description = String(row.description || '').trim()
    const categoryId = String(row.categoryId || '').trim()
    const newCategory = String(row.newCategory || '').trim()
    if (!amount && !description && !categoryId && !newCategory) continue
    if (!categoryId && !newCategory) errors.push('Choose a category for each additional expense.')
    if (categoryId === '__new__' && !newCategory) errors.push('Enter a name for the new expense category.')
    const parsed = parseGbpInput(amount)
    if (!parsed.ok) errors.push(`Additional expense: ${parsed.error}`)
  }
  return errors
}

/** Replace the selected day's saved rows with the draft so totals follow what is on screen. */
export function applyFinanceDayDraft(records, date, draft) {
  const source = records || {}
  if (!draft) return source
  const categories = new Map((source.categories || []).map((category) => [String(category.id), category]))
  const removedDays = new Set(draft.removedDayIds || [])
  const driverDays = [
    ...(source.driverDays || []).filter((row) => row.activity_date !== date),
    ...(draft.rows || []).filter((row) => financeRowHasEntry(row) && !removedDays.has(row.id)).map((row) => {
      const attendance = rowAttendance(row)
      const absent = attendance === 'absent'
      return {
        id: row.id || row.key,
        activity_date: date,
        driver_id: row.driverId || '',
        driver_name: String(row.driverName || '').trim() || 'Not named',
        source_name: absent ? '' : resolveIncomeSource(row),
        income_gbp: absent ? '0.00' : penceToAmount(financeAmountPence(row.income)),
        another_income_gbp: absent ? '0.00' : penceToAmount(financeAmountPence(row.anotherIncome)),
        salary_gbp: absent ? '0.00' : penceToAmount(financeAmountPence(row.salary)),
        diesel_gbp: absent ? '0.00' : penceToAmount(financeAmountPence(row.diesel)),
        other_gbp: absent ? '0.00' : penceToAmount(financeAmountPence(row.other)),
        other_description: absent ? '' : String(row.otherDescription || '').trim(),
        attendance,
      }
    }),
  ]
  const incomes = [
    ...(source.incomes || []).filter((row) => row.activity_date !== date),
    ...(draft.incomes || [])
      .filter((row) => String(row.source || '').trim() && financeAmountPence(row.amount) > 0)
      .map((row) => ({
        id: row.id || row.key,
        activity_date: date,
        source_name: String(row.source || '').trim(),
        amount_gbp: penceToAmount(financeAmountPence(row.amount)),
        description: String(row.description || '').trim(),
      })),
  ]
  const expenses = [
    ...(source.expenses || []).filter((row) => row.expense_date !== date),
    ...(draft.expenses || [])
      .filter((row) => financeAmountPence(row.amount) > 0 && (row.categoryId || String(row.newCategory || '').trim()))
      .map((row) => {
        const category = categories.get(String(row.categoryId))
        const custom = String(row.newCategory || '').trim()
        return {
          id: row.id || row.key,
          expense_date: date,
          category_id: row.categoryId || '',
          category_name: category?.name || custom || 'Other expenses',
          bucket: row.categoryId === '__new__' ? 'other' : category?.bucket || 'other',
          amount_gbp: penceToAmount(financeAmountPence(row.amount)),
          description: String(row.description || '').trim(),
          payee_name: row.payee || '',
        }
      }),
  ]
  return { ...source, driverDays, incomes, expenses }
}

/** Keep edits when the saved-driver list changes, and add any new name as an empty row. */
export function reconcileFinanceDayDraft(clean, dirty) {
  if (!dirty || dirty.date !== clean?.date) return clean
  const cleanByDriver = new Map((clean.rows || []).filter((row) => row.driverId).map((row) => [row.driverId, row]))
  const seen = new Set()
  const rows = (dirty.rows || []).map((row) => {
    if (row.driverId) seen.add(row.driverId)
    const fresh = row.driverId ? cleanByDriver.get(row.driverId) : null
    return fresh ? { ...row, driverName: fresh.driverName } : row
  })
  for (const row of clean.rows || []) {
    if (!row.driverId || row.id || seen.has(row.driverId)) continue
    rows.push(row)
  }
  return {
    ...dirty,
    rows,
  }
}

export function isoDatesInclusive(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return []
  const dates = []
  let cursor = from
  while (cursor <= to && dates.length < 400) {
    dates.push(cursor)
    cursor = shiftIsoDate(cursor, 1)
  }
  return dates
}

export function formatWeekdayDate(iso) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date)
  const rest = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
  return `${weekday} ${rest}`
}

/**
 * Attendance comes only from a saved Worked or Did not work status.
 * A driver name, or an income or salary amount, does not count as a worked day.
 */
export function weeklyAttendance(records, from, to) {
  const dates = isoDatesInclusive(from, to)
  const saved = (records?.driverDays || []).filter((row) => inDateRange(row.activity_date, from, to))
  const statusByDriverDate = new Map()
  for (const row of saved) {
    statusByDriverDate.set(`${row.driver_id}|${row.activity_date}`, rowAttendance(row, { stored: true }))
  }
  const active = (records?.drivers || [])
    .filter((driver) => !driver.archived)
    .map((driver) => ({ id: driver.id, name: driver.name, archived: false }))
  const activeIds = new Set(active.map((driver) => driver.id))
  const historical = []
  const seenHistorical = new Set()
  for (const row of saved) {
    const status = rowAttendance(row, { stored: true })
    if (status === 'not_set' || !row.driver_id || activeIds.has(row.driver_id) || seenHistorical.has(row.driver_id)) continue
    seenHistorical.add(row.driver_id)
    historical.push({ id: row.driver_id, name: row.driver_name || 'Not named', archived: true })
  }
  const people = [...active, ...historical].sort((left, right) => String(left.name).localeCompare(String(right.name), 'en-GB'))
  return {
    dates,
    rows: people.map((driver) => {
      const cells = dates.map((date) => statusByDriverDate.get(`${driver.id}|${date}`) || 'not_set')
      return {
        ...driver,
        cells,
        daysWorked: cells.filter((status) => status === 'worked').length,
        daysAbsent: cells.filter((status) => status === 'absent').length,
      }
    }),
  }
}

/**
 * Drivers with at least one saved Worked date in the range, including archived drivers.
 * Days worked counts those dates, including a worked day with £0 income.
 * Another income stays on the driver. Additional income is not added here.
 */
export function periodDriverReport(records, from, to) {
  const archivedIds = new Set((records?.drivers || []).filter((driver) => driver.archived).map((driver) => driver.id))
  const byDriver = new Map()
  for (const row of records?.driverDays || []) {
    if (!inDateRange(row.activity_date, from, to)) continue
    if (rowAttendance(row, { stored: true }) !== 'worked') continue
    const id = String(row.driver_id || row.driver_name || 'unknown')
    const current = byDriver.get(id) || {
      id,
      name: row.driver_name || 'Not named',
      archived: archivedIds.has(row.driver_id),
      dates: new Set(),
      income: 0,
      another: 0,
      salary: 0,
      diesel: 0,
      other: 0,
    }
    current.name = row.driver_name || current.name
    current.archived = archivedIds.has(row.driver_id)
    current.dates.add(String(row.activity_date))
    current.income += toPence(row.income_gbp)
    current.another += toPence(row.another_income_gbp)
    current.salary += toPence(row.salary_gbp)
    current.diesel += toPence(row.diesel_gbp)
    current.other += toPence(row.other_gbp)
    byDriver.set(id, current)
  }
  return [...byDriver.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      archived: row.archived,
      daysWorked: row.dates.size,
      income: row.income,
      another: row.another,
      salary: row.salary,
      diesel: row.diesel,
      other: row.other,
      profit: row.income + row.another - row.salary - row.diesel - row.other,
    }))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), 'en-GB') || String(left.id).localeCompare(String(right.id)))
}

export function unionIsoRange(ranges) {
  const valid = (ranges || []).filter(
    (range) => range && isIsoDate(range.from) && isIsoDate(range.to) && range.from <= range.to,
  )
  if (!valid.length) return null
  return {
    from: valid.reduce((min, range) => (range.from < min ? range.from : min), valid[0].from),
    to: valid.reduce((max, range) => (range.to > max ? range.to : max), valid[0].to),
  }
}

/** One request when the dates sit together. Separate requests when a custom range is far from the calendar. */
export function financeFetchRanges(periodRange, visibleMonth, selectedIso, ...extras) {
  const selected = isIsoDate(selectedIso) ? { from: selectedIso, to: selectedIso } : null
  const parts = [visibleMonth, periodRange, selected, ...extras].filter(
    (range) => range && isIsoDate(range.from) && isIsoDate(range.to) && range.from <= range.to,
  )
  const needed = []
  for (const range of parts) {
    if (needed.some((item) => item.from <= range.from && item.to >= range.to)) continue
    for (let index = needed.length - 1; index >= 0; index -= 1) {
      const item = needed[index]
      if (range.from <= item.from && range.to >= item.to) needed.splice(index, 1)
    }
    needed.push(range)
  }
  const union = unionIsoRange(needed)
  if (union && inclusiveDayCount(union.from, union.to) <= 800) return [union]
  return needed
}

export function inDateRange(iso, from, to) {
  return String(iso) >= String(from) && String(iso) <= String(to)
}

export function inclusiveDayCount(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86400000) + 1
}

function emptyDay(date) {
  return {
    date,
    income: 0,
    salaries: 0,
    diesel: 0,
    other: 0,
    drivers: 0,
  }
}

/** Legacy expense buckets still count once: diesel, salaries, or other expenses. */
export function expenseCountsAs(row, categories) {
  const list =
    categories instanceof Map
      ? categories
      : new Map((categories || []).map((category) => [String(category.id), category]))
  const category = list.get(String(row?.category_id))
  const bucket = row?.bucket || category?.bucket || 'other'
  if (bucket === 'diesel') return 'diesel'
  if (bucket === 'driver_pay' || bucket === 'helper_pay') return 'salary'
  return 'other'
}

export function expenseRoleLabel(row) {
  const role = expenseCountsAs(row)
  if (role === 'diesel') return 'Counted in diesel'
  if (role === 'salary') return 'Counted in salaries'
  return 'Counted in other expenses'
}

function addGrouped(map, name, pence) {
  const label = String(name || '').trim() || 'Not named'
  const key = label.toLocaleLowerCase('en-GB')
  const current = map.get(key) || { name: label, amount: 0 }
  current.amount += pence
  map.set(key, current)
}

/**
 * Profit before deduction = income + another income − salaries − diesel − other expenses.
 * Another income belongs to the driver day. It is not copied into additional income.
 * Driver-day rows and additional entries are each counted once.
 * The percentage is applied once to this profit, never per day and again on the total.
 * Earlier expense rows stay in the same totals: diesel, driver pay and helper pay count as
 * diesel or salaries. They are not linked to bookings, jobs or platform drivers.
 * @param {{ incomes?: object[], expenses?: object[], driverDays?: object[], categories?: object[], deductionPercent?: number }} input
 * @param {number} [percent]
 */
export function summarizeFinance(input, percent) {
  const source = input || {}
  const categories = new Map((source.categories || []).map((category) => [String(category.id), category]))
  const days = new Map()
  const sources = new Map()
  const salariesByDriver = new Map()
  const otherCategories = new Map()
  let income = 0
  let salaries = 0
  let diesel = 0
  let other = 0

  const dayFor = (date) => {
    if (!days.has(date)) days.set(date, emptyDay(date))
    return days.get(date)
  }

  for (const row of source.driverDays || []) {
    if (rowAttendance(row, { stored: true }) === 'absent') continue
    const date = String(row.activity_date)
    const day = dayFor(date)
    const incomePence = toPence(row.income_gbp)
    const anotherPence = toPence(row.another_income_gbp)
    const earnedPence = incomePence + anotherPence
    const salaryPence = toPence(row.salary_gbp)
    const dieselPence = toPence(row.diesel_gbp)
    const otherPence = toPence(row.other_gbp)
    day.drivers += 1
    day.income += earnedPence
    day.salaries += salaryPence
    day.diesel += dieselPence
    day.other += otherPence
    income += earnedPence
    salaries += salaryPence
    diesel += dieselPence
    other += otherPence
    if (earnedPence !== 0) addGrouped(sources, row.source_name, earnedPence)
    if (salaryPence !== 0) addGrouped(salariesByDriver, row.driver_name, salaryPence)
    if (otherPence !== 0) addGrouped(otherCategories, row.other_description || 'Other expenses', otherPence)
  }

  for (const row of source.incomes || []) {
    const pence = toPence(row.amount_gbp)
    const date = String(row.activity_date)
    income += pence
    dayFor(date).income += pence
    addGrouped(sources, row.source_name, pence)
  }

  for (const row of source.expenses || []) {
    const pence = toPence(row.amount_gbp)
    const date = String(row.expense_date)
    const day = dayFor(date)
    const role = expenseCountsAs(row, categories)
    const categoryName = row.category_name || categories.get(String(row.category_id))?.name || 'Other expenses'
    if (role === 'diesel') {
      diesel += pence
      day.diesel += pence
    } else if (role === 'salary') {
      salaries += pence
      day.salaries += pence
      addGrouped(salariesByDriver, row.payee_name || categoryName, pence)
    } else {
      other += pence
      day.other += pence
      addGrouped(otherCategories, categoryName, pence)
    }
  }

  const expenses = salaries + diesel + other
  const profit = income - expenses
  const rate = resolveDeductionPercent(source, percent)
  const applied = applyFinanceDeduction(profit, rate)
  const byAmount = (left, right) => right.amount - left.amount || left.name.localeCompare(right.name, 'en-GB')
  const daily = [...days.values()]
    .map((day) => {
      const totalExpenses = day.salaries + day.diesel + day.other
      return {
        ...day,
        totalExpenses,
        profit: day.income - totalExpenses,
      }
    })
    .sort((left, right) => left.date.localeCompare(right.date))

  return {
    income,
    salaries,
    diesel,
    other,
    expenses,
    profit,
    deductionPercent: rate,
    deduction: applied.deduction,
    finalAmount: applied.finalAmount,
    sources: [...sources.values()].sort(byAmount),
    salariesByDriver: [...salariesByDriver.values()].sort(byAmount),
    otherCategories: [...otherCategories.values()].sort(byAmount),
    daily,
  }
}

export function filterFinanceRange(records, from, to) {
  return {
    incomes: (records.incomes || []).filter((row) => inDateRange(row.activity_date, from, to)),
    expenses: (records.expenses || []).filter((row) => inDateRange(row.expense_date, from, to)),
    driverDays: (records.driverDays || []).filter((row) => inDateRange(row.activity_date, from, to)),
    categories: records.categories || [],
    deductionPercent: records?.deductionPercent,
  }
}

export function safeReceiptName(name) {
  const base = String(name || 'receipt')
    .split(/[/\\]/)
    .pop()
  const clean = String(base)
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
  return clean || 'receipt'
}

export const RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]

export function validateReceiptFile(file) {
  if (!file) return { ok: true }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'The receipt must be 10 MB or smaller.' }
  }
  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '').toLowerCase()
  const allowedByName = /\.(jpe?g|png|webp|heic|heif|pdf)$/.test(name)
  if (type && !RECEIPT_MIME_TYPES.includes(type) && !allowedByName) {
    return { ok: false, error: 'Attach a photo or PDF.' }
  }
  return { ok: true }
}
