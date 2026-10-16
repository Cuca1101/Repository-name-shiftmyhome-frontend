/**
 * Finance & Profit totals, week boundaries and monthly PDF.
 * Run: node scripts/test-finance-profit.mjs
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const {
  applyFinanceDeduction,
  assertFinanceUnlocked,
  calendarCells,
  applyFinanceDayDraft,
  buildFinanceDayDraft,
  driverDayProfitPence,
  filterFinanceRange,
  financeAmountPence,
  financeDraftProfitPence,
  financeRowHasEntry,
  financeRowsConfirmedOnSave,
  validateFinanceDayDraft,
  financeFetchRanges,
  financePdfFilename,
  formatGbp,
  formatIsoHeading,
  inclusiveDayCount,
  isFinancePinComplete,
  isIsoDate,
  londonTodayIso,
  monthBounds,
  normalizeFinancePin,
  parseDeductionPercent,
  parseGbpAllowZero,
  parseGbpInput,
  periodDriverReport,
  profitTone,
  resolveIncomeSource,
  rowAttendance,
  splitIncomeSource,
  shiftWeek,
  summarizeFinance,
  toPence,
  weekRangeContaining,
  weeklyAttendance,
} = await import('../src/lib/financeProfit.js')

const { renderFinanceMonthPdf, setFinancePdfFontBase64 } = await import('../src/lib/financeProfitPdf.js')
const { fetchFinance } = await import('../src/lib/financeProfitApi.js')

let failed = 0
function assert(condition, message) {
  if (!condition) {
    failed += 1
    console.error(`FAIL: ${message}`)
  }
}

const categories = [
  { id: 'diesel', name: 'Diesel', bucket: 'diesel' },
  { id: 'driver', name: 'Driver pay', bucket: 'driver_pay' },
  { id: 'helper', name: 'Helper pay', bucket: 'helper_pay' },
  { id: 'parking', name: 'Parking', bucket: 'other' },
  { id: 'insurance', name: 'Insurance', bucket: 'other' },
  { id: 'tea', name: 'Office tea', bucket: 'other' },
]

const legacy = summarizeFinance({
  categories,
  incomes: [
    { activity_date: '2026-10-16', source_name: 'AnyVan', amount_gbp: '600.00' },
    { activity_date: '2026-10-16', source_name: 'ShiftMyHome', amount_gbp: '400.00' },
  ],
  expenses: [
    { expense_date: '2026-10-16', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '150.00' },
    { expense_date: '2026-10-16', category_id: 'driver', bucket: 'driver_pay', category_name: 'Driver pay', amount_gbp: '140.00', payee_name: 'Alex' },
    { expense_date: '2026-10-12', category_id: 'driver', bucket: 'driver_pay', category_name: 'Driver pay', amount_gbp: '100.00', payee_name: 'Alex' },
    { expense_date: '2026-10-16', category_id: 'helper', bucket: 'helper_pay', category_name: 'Helper pay', amount_gbp: '100.00', payee_name: 'Sam' },
    { expense_date: '2026-10-16', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '40.00' },
    { expense_date: '2026-10-16', category_id: 'tea', bucket: 'other', category_name: 'Office tea', amount_gbp: '20.00' },
  ],
}, 0)

assert(legacy.income === 100000, 'income is £1,000.00')
assert(legacy.diesel === 15000, 'diesel is £150.00')
assert(legacy.salaries === 34000, 'saved driver pay and helper pay stay in salaries')
assert(legacy.other === 6000, 'other expenses are £60.00')
assert(legacy.expenses === 55000, 'total expenses are £550.00')
assert(legacy.profit === 45000, 'existing records still reconcile to £450 before deduction')
assert(formatGbp(legacy.profit) === '£450.00', 'profit formats as £450.00')
assert(profitTone(legacy.profit) === 'profit', 'positive profit is a profit')
assert(legacy.sources.length === 2, 'two income sources on the same day')
const alexSalary = legacy.salariesByDriver.find((row) => row.name === 'Alex')
assert(alexSalary && alexSalary.amount === 24000, 'Alex is totalled once across the days worked')
assert(legacy.daily.length === 2, 'two working days, no extra weekly payout row')
assert(
  legacy.daily.reduce((sum, day) => sum + day.salaries, 0) === legacy.salaries,
  'period salaries equal the sum of the days',
)

const workedDay = {
  categories,
  driverDays: [
    {
      activity_date: '2026-10-16',
      driver_name: 'Alex',
      source_name: 'AnyVan',
      income_gbp: '600.00',
      salary_gbp: '120.00',
      diesel_gbp: '60.00',
      other_gbp: '20.00',
      other_description: 'Tolls',
    },
    {
      activity_date: '2026-10-16',
      driver_name: 'Mihai',
      source_name: 'ShiftMyHome',
      income_gbp: '300.00',
      salary_gbp: '80.00',
      diesel_gbp: '40.00',
      other_gbp: '30.00',
      other_description: 'Bags',
    },
  ],
  incomes: [{ activity_date: '2026-10-16', source_name: 'Direct client', amount_gbp: '100.00', description: 'Extra job' }],
  expenses: [
    { expense_date: '2026-10-16', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '50.00', description: 'Town' },
  ],
}
const worked = summarizeFinance(workedDay, 25)
assert(driverDayProfitPence(workedDay.driverDays[0]) === 40000, 'Alex profit is £400.00')
assert(driverDayProfitPence(workedDay.driverDays[1]) === 15000, 'Mihai profit is £150.00')
assert(worked.income === 100000, 'worked example income is £1,000.00')
assert(worked.salaries === 20000, 'worked example salaries are £200.00')
assert(worked.diesel === 10000, 'worked example diesel is £100.00')
assert(worked.other === 10000, 'worked example other expenses are £100.00')
assert(worked.profit === 60000, '£1,000 − £200 − £100 − £100 = £600')
assert(worked.deduction === 15000, '25% of £600 is £150')
assert(worked.finalAmount === 45000, 'final amount remaining is £450')
assert(worked.daily.length === 1 && worked.daily[0].drivers === 2, 'the day counts two drivers once')
assert(worked.sources.length === 3, 'driver sources and additional income are separate entries')
assert(
  worked.sources.reduce((sum, row) => sum + row.amount, 0) === worked.income,
  'source totals equal income with no duplicate',
)

const reused = summarizeFinance({
  driverDays: [
    { activity_date: '2026-10-16', driver_name: 'Alex', source_name: 'AnyVan', income_gbp: '600.00', salary_gbp: '120.00', diesel_gbp: '60.00', other_gbp: '20.00', other_description: 'Tolls' },
    { activity_date: '2026-10-17', driver_name: 'Alex', source_name: '', income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00', other_description: '' },
  ],
}, 25)
assert(reused.income === 60000, 'a later day does not copy the earlier income')
assert(reused.daily.find((day) => day.date === '2026-10-17').income === 0, 'the new day starts empty')
assert(reused.daily.find((day) => day.date === '2026-10-17').drivers === 1, 'the saved driver is on the new day')

const mixedDeduction = summarizeFinance({
  incomes: [{ activity_date: '2026-10-01', source_name: 'AnyVan', amount_gbp: '200.00' }],
  expenses: [{ expense_date: '2026-10-02', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '50.00' }],
}, 25)
assert(mixedDeduction.profit === 15000, 'period profit is £150.00')
assert(mixedDeduction.deduction === 3750, '25% is applied once to the period, not to the £200 day alone')
assert(applyFinanceDeduction(-8000, 25).deduction === 0, 'a loss has no deduction')
assert(applyFinanceDeduction(-8000, 25).finalAmount === -8000, 'a loss stays visible')
assert(applyFinanceDeduction(60000, 0).deduction === 0 && applyFinanceDeduction(60000, 100).finalAmount === 0, '0% and 100% stay inside the range')
const zeroPercent = parseDeductionPercent('0')
const fullPercent = parseDeductionPercent('100')
const badPercent = parseDeductionPercent('101')
assert(zeroPercent.ok && zeroPercent.percent === 0 && fullPercent.ok && fullPercent.percent === 100 && !badPercent.ok, 'deduction accepts 0 to 100')
const blankMoney = parseGbpAllowZero('')
assert(blankMoney.ok && blankMoney.amount === '0.00', 'a new driver day can save empty amounts')

const lossDay = summarizeFinance({
  categories,
  incomes: [],
  expenses: [
    { expense_date: '2026-10-17', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '80.00' },
  ],
}, 25)
assert(lossDay.profit === -8000, 'a day with expenses and no income is a loss')
assert(lossDay.deduction === 0 && lossDay.finalAmount === -8000, 'the percentage does not change a loss')
assert(profitTone(lossDay.profit) === 'loss', 'a loss is negative')
assert(lossDay.daily[0].income === 0, 'missing income is zero')

const edited = summarizeFinance({
  categories,
  incomes: [
    { activity_date: '2026-10-16', source_name: 'AnyVan', amount_gbp: '1000.00' },
  ],
  expenses: [
    { expense_date: '2026-10-16', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '200.00' },
    { expense_date: '2026-10-16', category_id: 'driver', bucket: 'driver_pay', category_name: 'Driver pay', amount_gbp: '240.00', payee_name: 'Alex' },
    { expense_date: '2026-10-16', category_id: 'helper', bucket: 'helper_pay', category_name: 'Helper pay', amount_gbp: '100.00', payee_name: 'Sam' },
    { expense_date: '2026-10-16', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '60.00' },
  ],
}, 0)
assert(edited.profit === 40000, 'editing diesel from 150 to 200 recalculates profit to £400')

const removed = summarizeFinance({
  categories,
  incomes: [{ activity_date: '2026-10-16', source_name: 'AnyVan', amount_gbp: '1000.00' }],
  expenses: [
    { expense_date: '2026-10-16', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '150.00' },
    { expense_date: '2026-10-16', category_id: 'driver', bucket: 'driver_pay', category_name: 'Driver pay', amount_gbp: '240.00', payee_name: 'Alex' },
    { expense_date: '2026-10-16', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '60.00' },
  ],
}, 0)
assert(removed.salaries === 24000 && removed.profit === 55000, `deleting helper pay recalculates to £550 (salaries ${removed.salaries}, profit ${removed.profit})`)

const october = weekRangeContaining('2026-10-16')
assert(october.from === '2026-10-12' && october.to === '2026-10-18', '16 Oct 2026 sits in Mon 12–Sun 18')
const nextWeek = shiftWeek(october.from, 1)
assert(nextWeek.from === '2026-10-19' && nextWeek.to === '2026-10-25', 'next week starts 19 Oct')
const previousWeek = shiftWeek(nextWeek.from, -1)
assert(previousWeek.from === october.from && previousWeek.to === october.to, 'previous week returns')

const yearTurn = weekRangeContaining('2026-01-01')
assert(yearTurn.from === '2025-12-29' && yearTurn.to === '2026-01-04', 'week crosses the year boundary')
const afterYear = shiftWeek(yearTurn.from, 1)
assert(afterYear.from === '2026-01-05' && afterYear.to === '2026-01-11', 'next week is in the new year')

const octoberBounds = monthBounds(2026, 10)
assert(octoberBounds.from === '2026-10-01' && octoberBounds.to === '2026-10-31', 'October 2026')
assert(inclusiveDayCount(octoberBounds.from, octoberBounds.to) === 31, 'October has 31 days')
assert(monthBounds(2024, 2).to === '2024-02-29', 'leap day')
assert(monthBounds(2026, 12).to === '2026-12-31', 'December ends on the 31st')
assert(monthBounds(2027, 1).from === '2027-01-01', 'January follows December')

const mixed = {
  categories,
  incomes: [
    { activity_date: '2026-10-16', source_name: 'AnyVan', amount_gbp: '1000.00', description: 'October job' },
    { activity_date: '2026-09-30', source_name: 'Old source', amount_gbp: '50.00', description: 'OUTSIDE-MONTH' },
    { activity_date: '2026-11-01', source_name: 'Next', amount_gbp: '20.00', description: 'OUTSIDE-MONTH' },
  ],
  expenses: [
    { expense_date: '2026-10-16', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '150.00' },
    { expense_date: '2026-10-16', category_id: 'driver', bucket: 'driver_pay', category_name: 'Driver pay', amount_gbp: '240.00', payee_name: 'Alex' },
    { expense_date: '2026-10-16', category_id: 'helper', bucket: 'helper_pay', category_name: 'Helper pay', amount_gbp: '100.00', payee_name: 'Sam' },
    { expense_date: '2026-10-16', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '60.00', description: 'Town parking' },
    { expense_date: '2025-12-31', category_id: 'diesel', bucket: 'diesel', category_name: 'Diesel', amount_gbp: '10.00', description: 'OUTSIDE-MONTH' },
  ],
}
const octoberOnly = filterFinanceRange(mixed, octoberBounds.from, octoberBounds.to)
const octoberSummary = summarizeFinance(octoberOnly, 0)
assert(octoberSummary.profit === 45000, 'month filter keeps the £450 example')
assert(!octoberOnly.incomes.some((row) => row.description === 'OUTSIDE-MONTH'), 'September and November income stay out')
assert(!octoberOnly.expenses.some((row) => row.description === 'OUTSIDE-MONTH'), 'other months stay out of October')

assert(londonTodayIso(new Date('2026-06-15T23:30:00Z')) === '2026-06-16', 'London date uses Europe/London')
assert(normalizeFinancePin('09121987') === '09121987', 'leading zero stays in the PIN')
assert(normalizeFinancePin('09121987999') === '09121987', 'PIN keeps 8 digits')
assert(isFinancePinComplete('09121987') && !isFinancePinComplete('9121987'), '7 digits are not a complete PIN')
assert(!isIsoDate('2026-02-31') && isIsoDate('2026-10-16'), 'invalid calendar dates are rejected')
const badAmount = parseGbpInput('10.555')
const zeroAmount = parseGbpInput('0')
const okAmount = parseGbpInput('£1,000.50')
assert(!badAmount.ok && !zeroAmount.ok && okAmount.ok && okAmount.amount === '1000.50', 'amount validation')
assert(toPence('1000.10') === 100010, 'pence keep two decimal places')

let locked = false
try {
  assertFinanceUnlocked('')
} catch (error) {
  locked = error.code === 'FINANCE_LOCKED'
}
assert(locked, 'empty token cannot read finance data')

let apiLocked = false
try {
  await fetchFinance('', '2026-10-01', '2026-10-31')
} catch (error) {
  apiLocked = error.code === 'FINANCE_LOCKED'
}
assert(apiLocked, 'the list API refuses to run without a PIN session')

let pdfLocked = false
try {
  renderFinanceMonthPdf({ year: 2026, month: 10, incomes: [], expenses: [], categories })
} catch (error) {
  pdfLocked = error.code === 'FINANCE_LOCKED'
}
assert(pdfLocked, 'PDF export refuses to run without a PIN session')

const font = readFileSync(new URL('../src/assets/fonts/Roboto-Regular.ttf', import.meta.url))
setFinancePdfFontBase64(font.toString('base64'))
const token = 'a'.repeat(32)
const many = Array.from({ length: 40 }, (_, index) => ({
  expense_date: `2026-10-${String((index % 28) + 1).padStart(2, '0')}`,
  category_id: 'parking',
  bucket: 'other',
  category_name: 'Parking',
  amount_gbp: '12.50',
  description: `Receipt line ${index + 1} with a long note so the table has to wrap and move onto the next page without cutting the amount.`,
  payee_name: index % 2 === 0 ? 'Alex' : 'Sam',
}))
const pdf = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  ...octoberOnly,
})
const pdfBytes = Buffer.from(pdf.bytes)
const drawn = pdf.drawn.join('\n')
assert(pdf.filename === 'ShiftMyHome_Finance_2026-10.pdf', 'PDF filename')
assert(financePdfFilename(2026, 10) === pdf.filename, 'filename helper')
assert(pdfBytes.subarray(0, 5).toString() === '%PDF-', 'file is a PDF')
assert(drawn.includes('ShiftMyHome'), 'PDF names ShiftMyHome')
assert(drawn.includes('October 2026'), 'PDF names the month')
assert(drawn.includes('Month in progress'), 'current month is marked Month in progress')
assert(!/\btax\b/i.test(drawn), 'PDF does not call the deduction tax')
assert(!drawn.includes('Lună'), 'PDF stays in English')
assert(drawn.includes('AnyVan'), 'PDF lists the income source')
assert(drawn.includes('£450.00'), 'PDF shows the £450 profit')
assert(drawn.includes('£1,000.00'), 'PDF does not cut the income amount')
assert(drawn.includes('Alex') && drawn.includes('Sam'), 'PDF lists saved salary names')
assert(!drawn.includes('OUTSIDE-MONTH'), 'PDF excludes other months')
assert(drawn.includes('Page 1 of'), 'PDF has page numbers')

const paged = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  categories,
  incomes: octoberOnly.incomes,
  expenses: [...octoberOnly.expenses, ...many],
})
assert(paged.drawn.filter((line) => line === 'Category').length >= 2, 'expense header repeats on the next page')
assert(paged.drawn.join('\n').includes('£12.50'), 'paged amounts stay intact')

const closedMonth = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 9,
  generatedAt: '2026-10-16T12:00:00Z',
  incomes: mixed.incomes,
  expenses: mixed.expenses,
  categories,
})
assert(!closedMonth.drawn.join('\n').includes('Month in progress'), 'a finished month is not marked in progress')
assert(closedMonth.drawn.join('\n').includes('OUTSIDE-MONTH') === false || closedMonth.summary.income === 5000, 'September export is September only')
assert(closedMonth.summary.income === 5000, 'September income is the September row only')

const migration = readFileSync(new URL('../supabase/migrations/142_finance_profit.sql', import.meta.url), 'utf8')
assert(migration.includes("extensions.crypt('09121987'"), 'PIN is hashed on the server')
assert(!migration.includes('finance_pin_hash text not null default \'09121987\''), 'plain PIN is not a column default')
assert(migration.includes("v_pin !~ '^[0-9]{8}$'"), 'PIN stays an 8-digit text value')
assert(migration.includes('revoke all on table public.finance_income from public, anon, authenticated'), 'income table is closed to the browser')
assert(migration.includes('finance_guard'), 'list and save require an unlock session')
assert(!/quote_id|job_id|driver_id/.test(migration), 'finance tables are not linked to bookings, jobs or drivers')

const migration143 = readFileSync(new URL('../supabase/migrations/143_finance_profit_drivers.sql', import.meta.url), 'utf8')
assert(migration143.includes('references public.finance_drivers (id)'), 'daily records point at the finance driver list')
assert(!/references\s+public\.drivers\b/i.test(migration143), 'saved drivers are not platform drivers')
assert(!/public\.quotes|public\.jobs|public\.customers|quote_id|job_id/i.test(migration143), 'daily records are not linked to bookings or jobs')
assert(migration143.includes('perform public.finance_guard(p_token)'), 'new finance requests require the PIN session')
assert(migration143.includes('revoke all on table public.finance_driver_days from public, anon, authenticated'), 'driver days are closed to the browser')
assert(migration143.includes("values ('default', 25)"), 'deduction starts at 25%')
assert(migration143.includes('deduction_percent >= 0 and deduction_percent <= 100'), 'deduction stays between 0 and 100')
assert(migration143.includes('income_gbp = v_income'), 'a saved day stores the amounts entered for that day')
assert(!migration143.includes("'Alex'") && !migration143.includes("'Mihai'") && !migration143.includes('AnyVan'), 'live data is not seeded with the sample day')
const archiveFn = migration143.slice(
  migration143.indexOf('function public.finance_set_driver_archived'),
  migration143.indexOf('function public.finance_save_driver_day'),
)
assert(archiveFn.includes('set archived_at'), 'delete driver deactivates the finance driver')
assert(!/delete\s+from\s+public\.finance_driver_days/i.test(archiveFn), 'deleting a driver does not remove daily records')

const octoberCells = calendarCells(2026, 10)
assert(octoberCells[0] === null && octoberCells[3] === '2026-10-01', 'October 2026 starts on Thursday')
assert(formatIsoHeading('2026-10-16') === 'Friday, 16 October', '16 October 2026 is a Friday')
const wideRanges = financeFetchRanges(
  { from: '2020-01-01', to: '2020-12-31' },
  { from: '2026-10-01', to: '2026-10-31' },
  '2026-10-16',
)
assert(wideRanges.length === 2, 'a distant custom range is not joined into one oversized request')
assert(wideRanges.every((range) => inclusiveDayCount(range.from, range.to) <= 800), 'each finance request stays within the server limit')

const workedPdf = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  deductionPercent: 25,
  ...workedDay,
})
const workedText = workedPdf.drawn.join('\n')
assert(workedPdf.summary.profit === 60000 && workedPdf.summary.finalAmount === 45000, 'PDF totals match the month on screen')
assert(workedText.includes('£1,000.00') && workedText.includes('£200.00') && workedText.includes('£600.00'), 'PDF shows the worked calculation')
assert(workedText.includes('£150.00') && workedText.includes('£450.00'), 'PDF shows the 25% deduction and final amount')
assert(workedText.includes('Alex') && workedText.includes('Mihai') && workedText.includes('AnyVan') && workedText.includes('ShiftMyHome'), 'PDF lists both driver records')
assert(workedText.includes('Direct client') && workedText.includes('Parking'), 'PDF lists additional income and expenses')
assert(workedText.includes('Deduction (25%)') && workedText.includes('Final amount remaining'), 'PDF names the percentage and the final amount')
assert(!/\btax\b/i.test(workedText), 'worked PDF does not call the deduction tax')

const savedNames = ['Alex', 'Mihai', 'Dan', 'Ion', 'Paul', 'Radu'].map((name, index) => ({
  id: `driver-${index + 1}`,
  name,
  archived: false,
}))
const blankDay = {
  drivers: savedNames,
  driverDays: [],
  incomes: [],
  expenses: [],
  categories,
}
const placeholders = buildFinanceDayDraft(blankDay, '2026-10-17')
assert(placeholders.rows.length === 6, 'an empty day lists every saved driver')
assert(
  placeholders.rows.every((row) => !row.id && row.income === '' && row.salary === '' && row.diesel === '' && row.other === '' && !row.worked),
  'placeholder rows have no amounts and are not marked worked',
)
assert(placeholders.rows.every((row) => !financeRowHasEntry(row)), 'an unfilled driver is not an entry')
const placeholderApplied = applyFinanceDayDraft(blankDay, '2026-10-17', placeholders)
assert(placeholderApplied.driverDays.length === 0, 'placeholders do not create driver-day records')
assert(
  summarizeFinance(placeholderApplied, 25).income === 0 && summarizeFinance(placeholderApplied, 25).daily.length === 0,
  'empty names do not change the day totals',
)

const savedDraft = buildFinanceDayDraft(
  { ...blankDay, driverDays: workedDay.driverDays, incomes: workedDay.incomes, expenses: workedDay.expenses },
  '2026-10-16',
)
assert(savedDraft.rows.length === 6, 'a saved day still lists every saved driver')
const alexRow = savedDraft.rows.find((row) => row.driverName === 'Alex')
const mihaiRow = savedDraft.rows.find((row) => row.driverName === 'Mihai')
const danRow = savedDraft.rows.find((row) => row.driverName === 'Dan')
assert(alexRow && financeAmountPence(alexRow.income) === 60000 && alexRow.salary === '120.00', 'Alex reopens with the saved income and salary')
assert(mihaiRow && financeAmountPence(mihaiRow.income) === 30000 && mihaiRow.otherDescription === 'Bags', 'Mihai reopens with the saved figures')
assert(danRow && !danRow.id && danRow.income === '' && rowAttendance(danRow) === 'not_set', 'a driver without a record stays empty and Not set')
assert(rowAttendance(alexRow) === 'worked', 'an existing daily record stays Worked')

const reopened = applyFinanceDayDraft(
  { ...blankDay, driverDays: workedDay.driverDays, incomes: workedDay.incomes, expenses: workedDay.expenses },
  '2026-10-16',
  savedDraft,
)
const reopenedSummary = summarizeFinance(reopened, 25)
assert(reopenedSummary.income === 100000 && reopenedSummary.profit === 60000 && reopenedSummary.finalAmount === 45000, 'reopening a day keeps the saved totals')

const editedDraft = {
  ...savedDraft,
  rows: savedDraft.rows.map((row) => (row.driverName === 'Alex' ? { ...row, income: '700' } : row)),
}
const alexEdited = editedDraft.rows.find((row) => row.driverName === 'Alex')
assert(financeDraftProfitPence(alexEdited) === 50000, 'changing income to £700 updates that row to £500 profit')
const editedSummary = summarizeFinance(
  applyFinanceDayDraft(
    { ...blankDay, driverDays: workedDay.driverDays, incomes: workedDay.incomes, expenses: workedDay.expenses },
    '2026-10-16',
    editedDraft,
  ),
  25,
)
assert(editedSummary.income === 110000 && editedSummary.profit === 70000, 'editing one amount updates the day and period profit')
assert(editedSummary.deduction === 17500 && editedSummary.finalAmount === 52500, 'the percentage follows the edited profit once')
assert(
  editedSummary.daily.length === 1 && editedSummary.daily[0].drivers === 2,
  'the edited day still counts each saved driver once',
)

const nextDay = buildFinanceDayDraft(
  { ...blankDay, driverDays: workedDay.driverDays, incomes: workedDay.incomes, expenses: workedDay.expenses },
  '2026-10-18',
)
assert(
  nextDay.rows.length === 6 && nextDay.rows.every((row) => row.income === '' && row.salary === '' && row.diesel === '' && row.other === ''),
  'another date shows the saved names with empty amounts',
)
const nextApplied = applyFinanceDayDraft(
  { ...blankDay, driverDays: workedDay.driverDays, incomes: workedDay.incomes, expenses: workedDay.expenses },
  '2026-10-18',
  nextDay,
)
assert(
  nextApplied.driverDays.length === 2 && nextApplied.driverDays.every((row) => row.activity_date === '2026-10-16'),
  'the next day does not copy the earlier amounts',
)

const workedOnly = {
  ...placeholders.rows[0],
  attendance: 'worked',
  worked: true,
}
assert(financeRowHasEntry(workedOnly), 'marking a driver as worked stores that row')
const absentOnly = { ...placeholders.rows[2], attendance: 'absent' }
assert(financeRowHasEntry(absentOnly), 'Did not work is stored even with no amounts')
const notSetOnly = placeholders.rows[3]
assert(!financeRowHasEntry(notSetOnly), 'Not set with no amounts is not stored')
const withFigures = { ...placeholders.rows[1], income: '10' }
assert(financeRowHasEntry(withFigures), 'a figure marks the row as an entry')

const fourDrivers = ['Alex', 'Mihai', 'Dan', 'Ion'].map((name, index) => ({ id: `four-${index + 1}`, name, archived: false }))
const fourDate = '2026-10-16'
const fourBlank = { drivers: fourDrivers, driverDays: [], incomes: [], expenses: [], categories }
const fourDraft = buildFinanceDayDraft(fourBlank, fourDate)
assert(applyFinanceDayDraft(fourBlank, fourDate, fourDraft).driverDays.length === 0, 'opening a date does not create worked-day records')
const fourTicked = {
  ...fourDraft,
  rows: fourDraft.rows.map((row) => (row.driverName === 'Ion' ? { ...row, attendance: 'absent', sourceChoice: 'other', sourceCustom: '' } : row)),
}
const fourErrors = validateFinanceDayDraft(fourTicked)
assert(!fourErrors.some((error) => error.includes('income source')), 'an absent driver does not need an income source')
const fourConfirmed = financeRowsConfirmedOnSave(fourTicked.rows)
assert(fourConfirmed.filter((row) => row.attendance === 'worked').length === 3, 'saving records the three unticked drivers as Worked')
assert(fourConfirmed.filter((row) => row.attendance === 'absent').length === 1, 'saving records the ticked driver as absent')
assert(fourConfirmed.every((row) => row.attendance === 'worked' || row.driverName === 'Ion'), 'only the ticked driver is absent')
const fourSaved = applyFinanceDayDraft(fourBlank, fourDate, { ...fourTicked, rows: fourConfirmed })
assert(fourSaved.driverDays.filter((row) => row.attendance === 'worked').length === 3, 'three worked records are stored')
assert(
  fourSaved.driverDays.filter((row) => row.attendance === 'absent' && row.income_gbp === '0.00' && row.another_income_gbp === '0.00').length === 1,
  'the absent driver is stored with zero amounts',
)
const fourWeek = weeklyAttendance(fourSaved, weekRangeContaining(fourDate).from, weekRangeContaining(fourDate).to)
assert(fourWeek.rows.find((row) => row.name === 'Ion').daysWorked === 0, 'Did not work is excluded from days worked')
assert(
  fourWeek.rows.filter((row) => row.name !== 'Ion').every((row) => row.daysWorked === 1),
  'only the saved Worked dates are counted',
)
const fourReopened = buildFinanceDayDraft(fourSaved, fourDate)
assert(rowAttendance(fourReopened.rows.find((row) => row.driverName === 'Ion')) === 'absent', 'reopening restores Did not work')
assert(
  fourReopened.rows.filter((row) => row.driverName !== 'Ion').every((row) => rowAttendance(row) === 'worked'),
  'reopening restores the unticked drivers as Worked',
)
const fourLive = applyFinanceDayDraft(fourBlank, fourDate, {
  ...fourDraft,
  rows: fourDraft.rows.map((row) => (row.driverName === 'Alex' ? { ...row, income: '15' } : row)),
})
assert(summarizeFinance(fourLive, 0).income === 1500, 'entered figures update the total before the day is saved')
assert(
  weeklyAttendance(fourLive, weekRangeContaining(fourDate).from, weekRangeContaining(fourDate).to).rows.every((row) => row.daysWorked === 0),
  'unsaved figures are not counted as a worked day',
)

const removedDriverDay = {
  drivers: [
    { id: 'alex', name: 'Alex', archived: false },
    { id: 'mia', name: 'Mia', archived: true },
  ],
  driverDays: [
    {
      id: 'mia-day',
      activity_date: '2026-10-16',
      driver_id: 'mia',
      driver_name: 'Mia',
      source_name: 'AnyVan',
      income_gbp: '100.00',
      another_income_gbp: '20.00',
      salary_gbp: '30.00',
      diesel_gbp: '10.00',
      other_gbp: '5.00',
      other_description: 'Tolls',
      attendance: 'worked',
    },
  ],
  incomes: [],
  expenses: [],
}
const removedHistory = buildFinanceDayDraft(removedDriverDay, '2026-10-16')
const miaHistory = removedHistory.rows.find((row) => row.driverName === 'Mia')
assert(miaHistory && miaHistory.id === 'mia-day' && miaHistory.anotherIncome === '20.00', 'a removed driver stays on dates that already have a record')
assert(rowAttendance(miaHistory) === 'worked' && miaHistory.salary === '30.00' && miaHistory.diesel === '10.00' && miaHistory.other === '5.00', 'attendance and costs stay on that record')
assert(driverDayProfitPence(removedDriverDay.driverDays[0]) === 7500, 'profit still includes another income after the driver is removed from the active list')
const removedNextDay = buildFinanceDayDraft(removedDriverDay, '2026-10-17')
assert(removedNextDay.rows.some((row) => row.driverName === 'Alex') && !removedNextDay.rows.some((row) => row.driverName === 'Mia'), 'a removed driver is left out of a new day')
const removedSummary = summarizeFinance(removedDriverDay, 0)
assert(removedSummary.income === 12000 && removedSummary.profit === 7500, 'historical income and profit stay in the summary')
const removedWeek = weeklyAttendance(removedDriverDay, '2026-10-12', '2026-10-18')
assert(removedWeek.rows.find((row) => row.name === 'Mia').daysWorked === 1, 'days worked stay counted for a removed driver')

const weekReportRecords = {
  drivers: [
    { id: 'alex', name: 'Alex', archived: false },
    { id: 'mia', name: 'Mia', archived: true },
    { id: 'ion', name: 'Ion', archived: false },
  ],
  driverDays: [
    { activity_date: '2026-10-12', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '600.00', another_income_gbp: '0.00', salary_gbp: '120.00', diesel_gbp: '60.00', other_gbp: '20.00' },
    { activity_date: '2026-10-13', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '0.00', another_income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2026-10-14', driver_id: 'mia', driver_name: 'Mia', attendance: 'worked', income_gbp: '100.00', another_income_gbp: '20.00', salary_gbp: '30.00', diesel_gbp: '10.00', other_gbp: '5.00' },
    { activity_date: '2026-10-15', driver_id: 'ion', driver_name: 'Ion', attendance: 'absent', income_gbp: '80.00', salary_gbp: '10.00', diesel_gbp: '5.00', other_gbp: '1.00' },
    { activity_date: '2026-10-19', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '50.00', another_income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
  ],
  incomes: [{ activity_date: '2026-10-12', source_name: 'Direct client', amount_gbp: '100.00', description: 'Extra job' }],
  expenses: [{ expense_date: '2026-10-12', category_id: 'parking', bucket: 'other', category_name: 'Parking', amount_gbp: '50.00', description: 'Town' }],
}
const weekBounds = weekRangeContaining('2026-10-16')
const weekDrivers = periodDriverReport(weekReportRecords, weekBounds.from, weekBounds.to)
const alexWeekReport = weekDrivers.find((row) => row.name === 'Alex')
const miaWeekReport = weekDrivers.find((row) => row.name === 'Mia')
assert(weekBounds.from === '2026-10-12' && weekBounds.to === '2026-10-18', 'the report week is Monday to Sunday')
assert(alexWeekReport && alexWeekReport.daysWorked === 2 && alexWeekReport.income === 60000, 'worked days with £0 income still count, and the next week stays out')
assert(miaWeekReport && miaWeekReport.archived && miaWeekReport.another === 2000 && miaWeekReport.profit === 7500, 'an archived driver keeps another income and profit')
assert(!weekDrivers.some((row) => row.name === 'Ion'), 'Did not work is left out of the driver report')
const weekSummary = summarizeFinance(filterFinanceRange(weekReportRecords, weekBounds.from, weekBounds.to), 25)
assert(weekSummary.income === 82000, 'driver income, another income and additional income are counted once')
assert(weekSummary.expenses === 29500 && weekSummary.profit === 52500, 'weekly profit is total income minus total expenses')
assert(weekSummary.deduction === 13125 && weekSummary.finalAmount === 39375, 'the percentage is applied once to the weekly profit')
assert(weekDrivers.reduce((sum, row) => sum + row.income + row.another, 0) + 10000 === weekSummary.income, 'additional income is separate from the driver rows and still in the week total')
const removedPdf = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  ...removedDriverDay,
})
const removedDrawn = removedPdf.drawn.join('\n')
assert(removedDrawn.includes('Mia'), 'the PDF keeps a removed driver who has saved records')
assert(removedDrawn.includes('£20.00'), 'the PDF keeps that driver’s another income')
const duplicateNames = validateFinanceDayDraft({
  rows: [
    { driverName: 'Alex', source: '', income: '10', salary: '', diesel: '', other: '', otherDescription: '', worked: false },
    { driverName: 'alex', source: '', income: '5', salary: '', diesel: '', other: '', otherDescription: '', worked: false },
  ],
  incomes: [],
  expenses: [],
})
assert(duplicateNames.some((error) => error.includes('more than once')), 'the same driver cannot be completed twice on one day')
const missingOther = validateFinanceDayDraft({
  rows: [{ driverName: 'Alex', source: '', income: '', salary: '', diesel: '', other: '20', otherDescription: '', worked: false }],
  incomes: [],
  expenses: [],
})
assert(missingOther.some((error) => error.includes('description for other expenses')), 'other expenses need a description')

const yearWeek = weekRangeContaining('2026-01-01')
assert(yearWeek.from === '2025-12-29' && yearWeek.to === '2026-01-04', 'the attendance week crosses the year')
const attendanceRecords = {
  drivers: [
    { id: 'alex', name: 'Alex', archived: false },
    { id: 'mia', name: 'Mia', archived: false },
  ],
  driverDays: [
    { activity_date: '2025-12-29', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2025-12-30', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '10.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2025-12-31', driver_id: 'alex', driver_name: 'Alex', attendance: 'not_set', income_gbp: '50.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2026-01-01', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2026-01-02', driver_id: 'alex', driver_name: 'Alex', attendance: 'worked', income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    { activity_date: '2026-01-03', driver_id: 'alex', driver_name: 'Alex', attendance: 'absent', income_gbp: '80.00', salary_gbp: '10.00', diesel_gbp: '5.00', other_gbp: '1.00' },
    { activity_date: '2026-01-04', driver_id: 'mia', driver_name: 'Mia', attendance: 'not_set', income_gbp: '20.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
  ],
}
const weekRows = weeklyAttendance(attendanceRecords, yearWeek.from, yearWeek.to)
const alexWeek = weekRows.rows.find((row) => row.name === 'Alex')
const miaWeek = weekRows.rows.find((row) => row.name === 'Mia')
assert(weekRows.dates.length === 7 && weekRows.dates[0] === '2025-12-29' && weekRows.dates[6] === '2026-01-04', 'the week lists Monday to Sunday')
assert(alexWeek && alexWeek.daysWorked === 4, 'Monday, Tuesday, Thursday and Friday count as 4 days worked')
assert(alexWeek.cells[2] === 'not_set' && alexWeek.cells[5] === 'absent', 'income does not turn Not set into Worked, and Did not work stays separate')
assert(miaWeek && miaWeek.daysWorked === 0, 'Not set is not counted as a worked day')
const absentSummary = summarizeFinance(
  {
    driverDays: [
      { activity_date: '2026-01-03', driver_name: 'Alex', attendance: 'absent', income_gbp: '80.00', salary_gbp: '10.00', diesel_gbp: '5.00', other_gbp: '1.00' },
    ],
  },
  0,
)
assert(absentSummary.income === 0 && absentSummary.expenses === 0 && absentSummary.daily.length === 0, 'Did not work creates no income or costs')
const zeroWorked = summarizeFinance(
  {
    driverDays: [
      { activity_date: '2026-01-01', driver_name: 'Alex', attendance: 'worked', income_gbp: '0.00', salary_gbp: '0.00', diesel_gbp: '0.00', other_gbp: '0.00' },
    ],
  },
  0,
)
assert(zeroWorked.daily.length === 1 && zeroWorked.daily[0].drivers === 1 && zeroWorked.income === 0, 'Worked with £0 income still counts as a worked day')
const monthAttendance = weeklyAttendance(attendanceRecords, '2026-01-01', '2026-01-31')
const alexJanuary = monthAttendance.rows.find((row) => row.name === 'Alex')
assert(alexJanuary.daysWorked === 2, 'a monthly report counts only Worked dates inside that month')

const customSource = 'Facebook Marketplace'
assert(splitIncomeSource('ShiftMyHome + AnyVan').choice === 'ShiftMyHome + AnyVan', 'the combined source stays a preset')
assert(splitIncomeSource(customSource).choice === 'other' && splitIncomeSource(customSource).custom === customSource, 'a saved custom name reopens as Other')
assert(resolveIncomeSource({ sourceChoice: 'other', sourceCustom: customSource }) === customSource, 'Other stores the typed name')
assert(resolveIncomeSource({ sourceChoice: 'AnyVan', sourceCustom: customSource }) === 'AnyVan', 'a preset is stored as itself')
const missingCustom = validateFinanceDayDraft({
  rows: [{ driverName: 'Alex', sourceChoice: 'other', sourceCustom: '  ', income: '10', salary: '', diesel: '', other: '', otherDescription: '', attendance: 'worked' }],
  incomes: [],
  expenses: [],
})
assert(missingCustom.some((error) => error.includes('Enter an income source for Alex')), 'Other needs a name before saving')
const sourceDrivers = [
  { id: 'alex', name: 'Alex', archived: false },
  { id: 'mia', name: 'Mia', archived: false },
]
const savedCustomDay = {
  drivers: sourceDrivers,
  driverDays: [
    {
      id: 'day-alex',
      activity_date: '2026-10-16',
      driver_id: 'alex',
      driver_name: 'Alex',
      source_name: customSource,
      income_gbp: '40.00',
      salary_gbp: '0.00',
      diesel_gbp: '0.00',
      other_gbp: '0.00',
      attendance: 'worked',
    },
  ],
  incomes: [{ activity_date: '2026-10-16', source_name: customSource, amount_gbp: '10.00', description: 'Extra' }],
  expenses: [],
}
const restoredSourceDay = buildFinanceDayDraft(savedCustomDay, '2026-10-16')
const alexReopened = restoredSourceDay.rows.find((row) => row.driverName === 'Alex')
assert(alexReopened.sourceChoice === 'other' && alexReopened.sourceCustom === customSource, 'reopening the date restores the custom source')
const nextSourceDay = buildFinanceDayDraft(savedCustomDay, '2026-10-17')
assert(nextSourceDay.rows.every((row) => !row.sourceChoice && !row.sourceCustom), 'another date does not copy the income source')
const savedFromOther = applyFinanceDayDraft(savedCustomDay, '2026-10-16', {
  ...restoredSourceDay,
  rows: restoredSourceDay.rows.map((row) =>
    row.driverName === 'Mia'
      ? { ...row, sourceChoice: 'ShiftMyHome + AnyVan', income: '25', attendance: 'worked' }
      : row,
  ),
})
const customSummary = summarizeFinance(savedFromOther, 0)
const customBucket = customSummary.sources.find((row) => row.name === customSource)
assert(customBucket && customBucket.amount === 5000, 'the custom source is totalled once across the driver and the extra income')
assert(!customSummary.sources.some((row) => row.name === 'Other'), 'summaries do not keep the word Other')
assert(customSummary.income === 7500, 'preset and custom income are both included once')
const customPdf = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  ...savedFromOther,
})
const customDrawn = customPdf.drawn.join('\n')
assert(customDrawn.includes(customSource), 'the PDF prints the custom income source')
assert(customDrawn.includes('ShiftMyHome + AnyVan'), 'the PDF prints the combined income source')

const anotherDay = {
  drivers: [{ id: 'alex', name: 'Alex', archived: false }],
  driverDays: [
    {
      id: 'day-another',
      activity_date: '2026-10-16',
      driver_id: 'alex',
      driver_name: 'Alex',
      source_name: 'AnyVan',
      income_gbp: '600.00',
      another_income_gbp: '50.00',
      salary_gbp: '120.00',
      diesel_gbp: '60.00',
      other_gbp: '20.00',
      other_description: 'Tolls',
      attendance: 'worked',
    },
  ],
  incomes: [{ id: 'extra', activity_date: '2026-10-16', source_name: 'Direct client', amount_gbp: '100.00', description: 'Extra job' }],
  expenses: [],
}
assert(financeAmountPence('') === 0, 'an empty another income field is zero')
assert(driverDayProfitPence(anotherDay.driverDays[0]) === 45000, 'profit is income plus another income, minus salary, diesel and other expenses')
const anotherSummary = summarizeFinance(anotherDay, 0)
assert(anotherSummary.income === 75000, 'another income is included once in total income')
assert(anotherSummary.sources.find((row) => row.name === 'AnyVan').amount === 65000, 'another income stays with that driver source')
assert(anotherSummary.sources.find((row) => row.name === 'Direct client').amount === 10000, 'additional income is a separate entry')
assert(
  anotherSummary.sources.reduce((sum, row) => sum + row.amount, 0) === anotherSummary.income,
  'source totals still equal income once',
)
const restoredAnother = buildFinanceDayDraft(anotherDay, '2026-10-16')
const alexAnother = restoredAnother.rows.find((row) => row.driverName === 'Alex')
assert(alexAnother.anotherIncome === '50.00', 'reopening the date restores another income')
assert(buildFinanceDayDraft(anotherDay, '2026-10-17').rows.every((row) => !row.anotherIncome), 'another date does not copy another income')
const savedAnother = applyFinanceDayDraft(anotherDay, '2026-10-16', {
  ...restoredAnother,
  rows: restoredAnother.rows.map((row) => (row.driverName === 'Alex' ? { ...row, anotherIncome: '' } : row)),
})
assert(savedAnother.driverDays.find((row) => row.driver_name === 'Alex').another_income_gbp === '0.00', 'a cleared another income field saves as zero')
assert(savedAnother.incomes.length === 1 && savedAnother.incomes[0].source_name === 'Direct client', 'another income is not copied into additional income')
const anotherPdf = renderFinanceMonthPdf({
  token,
  year: 2026,
  month: 10,
  generatedAt: '2026-10-16T12:00:00Z',
  ...anotherDay,
})
const anotherDrawn = anotherPdf.drawn.join('\n')
assert(anotherDrawn.includes('Another income'), 'the PDF lists another income on the driver record')
assert(anotherDrawn.includes('£50.00'), 'the PDF shows the another income amount')
assert(anotherDrawn.includes('Extra job'), 'additional income stays in its own section')
assert(anotherDrawn.split('£50.00').length === 2, 'the another income amount is printed once')

const migration144 = readFileSync(new URL('../supabase/migrations/144_finance_driver_attendance.sql', import.meta.url), 'utf8')
assert(migration144.includes("attendance in ('worked', 'absent')"), 'attendance is Worked or Did not work')
assert(!/references\s+public\.drivers\b/i.test(migration144), 'attendance stays on the finance driver list')
assert(workedText.includes('Attendance') && workedText.includes('Days worked'), 'the monthly PDF includes attendance totals')
const migration145 = readFileSync(new URL('../supabase/migrations/145_finance_driver_another_income.sql', import.meta.url), 'utf8')
assert(migration145.includes('another_income_gbp'), 'another income is stored on the driver day')
assert(migration145.includes("v_another := public.finance_parse_nonneg(p_payload->>'another_income_gbp')"), 'an empty another income amount is accepted as zero')
assert(!/references\s+public\.drivers\b/i.test(migration145), 'another income stays on the finance driver day')

if (failed > 0) {
  console.error(`${failed} finance check(s) failed`)
  process.exit(1)
}
console.log('Finance & Profit checks passed')
