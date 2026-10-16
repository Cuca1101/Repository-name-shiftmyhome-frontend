import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Lock, Plus, Trash2 } from 'lucide-react'
import robotoUrl from '../assets/fonts/Roboto-Regular.ttf?url'
import {
  deleteFinanceDriverDay,
  deleteFinanceExpense,
  deleteFinanceIncome,
  fetchFinance,
  FinanceLockedError,
  openFinanceReceipt,
  removeFinanceReceipt,
  saveFinanceDeduction,
  saveFinanceDriver,
  saveFinanceDriverDay,
  saveFinanceExpense,
  saveFinanceIncome,
  setFinanceDriverArchived,
  uploadFinanceReceipt,
  touchFinanceSession,
  unlockFinancePin,
} from '../lib/financeProfitApi'
import {
  downloadFinanceMonthPdf,
  financePdfFontReady,
  setFinancePdfFontBase64,
} from '../lib/financeProfitPdf'
import {
  beginFinanceVisit,
  getFinanceToken,
  lockFinanceAccess,
  lockFinanceKeepalive,
} from '../lib/financeSession'
import {
  applyFinanceDayDraft,
  blankDriverDraftRow,
  buildFinanceDayDraft,
  calendarCells,
  driverCountLabel,
  filterFinanceRange,
  financeAmountPence,
  financeDayDraftSignature,
  financeDraftProfitPence,
  financeFetchRanges,
  financeRowHasEntry,
  formatDeductionPercent,
  formatGbp,
  formatIsoHeading,
  formatIsoLong,
  formatMonthYear,
  inDateRange,
  inclusiveDayCount,
  isFinancePinComplete,
  isIsoDate,
  londonTodayIso,
  monthBounds,
  monthYearFromIso,
  normalizeFinancePin,
  parseDeductionPercent,
  penceToAmount,
  profitTextClass,
  readDeductionPercent,
  shiftMonth,
  shiftWeek,
  summarizeFinance,
  validateFinanceDayDraft,
  validateReceiptFile,
  weekRangeContaining,
} from '../lib/financeProfit'

const EMPTY = {
  categories: [],
  sources: [],
  payees: [],
  incomes: [],
  expenses: [],
  drivers: [],
  driverDays: [],
  deductionPercent: 25,
}
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 sm:text-sm'
const cellInput =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25'
const moneyInput = `${cellInput} text-right tabular-nums`

function financeClientKey(key) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(key || ''))
    ? key
    : crypto.randomUUID()
}

async function ignoreMissingRecord(action) {
  try {
    return await action()
  } catch (error) {
    if (/not found/i.test(error?.message || '')) return undefined
    throw error
  }
}
const buttonClass =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const primaryButton = `${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`
const quietButton = `${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`

function isLockedError(error) {
  return error instanceof FinanceLockedError || error?.code === 'FINANCE_LOCKED'
}

function mergeFinance(parts) {
  const byId = (rows) => {
    const map = new Map()
    for (const row of rows) map.set(String(row.id), row)
    return [...map.values()]
  }
  const last = parts[parts.length - 1] || EMPTY
  return {
    categories: last.categories || [],
    sources: last.sources || [],
    payees: last.payees || [],
    drivers: last.drivers || [],
    deductionPercent: last.deductionPercent ?? 25,
    incomes: byId(parts.flatMap((part) => part.incomes || [])),
    expenses: byId(parts.flatMap((part) => part.expenses || [])),
    driverDays: byId(parts.flatMap((part) => part.driverDays || [])),
  }
}

async function ensureFinancePdfFont() {
  if (financePdfFontReady()) return
  const response = await fetch(robotoUrl)
  if (!response.ok) throw new Error('Could not prepare the PDF.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  setFinancePdfFontBase64(btoa(binary))
}

function DialogShell({ title, children, onClose, busy = false, stacked = false }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'Escape' || busy) return
      if (stacked) event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, stacked)
    return () => window.removeEventListener('keydown', onKey, stacked)
  }, [busy, onClose, stacked])

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4 ${stacked ? 'z-[90]' : 'z-[80]'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={stacked ? 'finance-dialog-title-stacked' : 'finance-dialog-title'}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:p-6">
        <h2 id={stacked ? 'finance-dialog-title-stacked' : 'finance-dialog-title'} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

function FormulaCard({ label, pence, emphasize = false }) {
  return (
    <div
      className={`min-w-[7.5rem] flex-1 rounded-2xl border px-3 py-3 ${
        emphasize ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${emphasize ? profitTextClass(pence) : 'text-slate-900'}`}>
        {formatGbp(pence)}
      </p>
    </div>
  )
}

function AmountList({ title, rows, empty }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.name} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 break-words text-slate-700">{row.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatGbp(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DriverNameRow({ driver, onSave, onArchive }) {
  const [name, setName] = useState(driver.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(driver.name)
  }, [driver.name])

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <input
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        aria-label={`Name for ${driver.name}`}
        className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className={quietButton}
          disabled={saving || name.trim() === driver.name}
          onClick={() => {
            setSaving(true)
            Promise.resolve(onSave(driver, name)).finally(() => setSaving(false))
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={`${quietButton} text-red-700`} onClick={() => onArchive(driver)}>
          Archive
        </button>
      </div>
    </li>
  )
}

function DriverManager({ drivers, onClose, onCreate, onRename, onArchive }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const active = drivers.filter((driver) => !driver.archived).sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
  const archived = drivers.filter((driver) => driver.archived).sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))

  async function create(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onCreate(name)
      setName('')
    } catch (createError) {
      setError(createError?.message || 'Could not save that driver.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogShell title="Manage drivers" onClose={onClose}>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Save a name once, then use it on any date. Archiving hides the name from the list and keeps every past day.
      </p>
      <form onSubmit={create} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="New driver name"
          aria-label="New driver name"
          className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save driver'}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-slate-100">
        {active.length === 0 ? <li className="py-3 text-sm text-slate-500">No saved drivers yet.</li> : null}
        {active.map((driver) => (
          <DriverNameRow
            key={driver.id}
            driver={driver}
            onSave={async (item, nextName) => {
              setError('')
              try {
                await onRename(item, nextName)
              } catch (renameError) {
                setError(renameError?.message || 'Could not rename that driver.')
              }
            }}
            onArchive={onArchive}
          />
        ))}
      </ul>
      {archived.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900">Archived</h3>
          <ul className="mt-1 divide-y divide-slate-100">
            {archived.map((driver) => (
              <li key={driver.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-700">{driver.name}</span>
                <button type="button" className={quietButton} onClick={() => onArchive(driver, false)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" className={quietButton} onClick={onClose}>
          Close
        </button>
      </div>
    </DialogShell>
  )
}

export default function FinanceProfitAdmin() {
  const today = londonTodayIso()
  const todayParts = monthYearFromIso(today)
  const [phase, setPhase] = useState('locked')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const unlockingRef = useRef(false)
  const [records, setRecords] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [scope, setScope] = useState('day')
  const [week, setWeek] = useState(() => weekRangeContaining(today))
  const [calendarYear, setCalendarYear] = useState(todayParts.year)
  const [calendarMonth, setCalendarMonth] = useState(todayParts.month)
  const [customFrom, setCustomFrom] = useState(monthBounds(todayParts.year, todayParts.month).from)
  const [customTo, setCustomTo] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [modal, setModal] = useState(null)
  const [pendingArchive, setPendingArchive] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [percentInput, setPercentInput] = useState('25')
  const [percentError, setPercentError] = useState('')
  const [dayActionError, setDayActionError] = useState('')
  const [savingDay, setSavingDay] = useState(false)
  const [pendingLeave, setPendingLeave] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null)
  const [dayDraft, setDayDraft] = useState(() => buildFinanceDayDraft(EMPTY, today))
  const [draftBaseline, setDraftBaseline] = useState(() => financeDayDraftSignature(buildFinanceDayDraft(EMPTY, today)))
  const percentFocused = useRef(false)
  const savedPercentRef = useRef(25)
  const loadId = useRef(0)
  const dirtyRef = useRef(false)
  const savingDayRef = useRef(false)

  const lockScreen = useCallback(() => {
    setPhase('locked')
    setPin('')
    setRecords(EMPTY)
    setModal(null)
    setPendingLeave(null)
    setPendingRemove(null)
    setPendingArchive(null)
    dirtyRef.current = false
    setLoadError('')
    setDayActionError('')
    void lockFinanceAccess()
  }, [])

  useEffect(() => {
    beginFinanceVisit()
    const onHide = (event) => {
      if (event.persisted) return
      lockFinanceKeepalive()
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void lockFinanceAccess()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'open') return undefined
    const timer = window.setInterval(() => {
      const token = getFinanceToken()
      if (!token) return
      void touchFinanceSession(token).catch((error) => {
        if (isLockedError(error)) lockScreen()
      })
    }, 4 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [phase, lockScreen])

  useEffect(() => {
    const next = readDeductionPercent(records.deductionPercent)
    savedPercentRef.current = next
    if (!percentFocused.current) setPercentInput(String(next))
  }, [records.deductionPercent])

  const customProblem = useMemo(() => {
    if (scope !== 'custom') return ''
    if (!isIsoDate(customFrom) || !isIsoDate(customTo)) return 'Enter a valid start and end date.'
    if (customFrom > customTo) return 'The start date must be on or before the end date.'
    if (inclusiveDayCount(customFrom, customTo) > 366) return 'Choose a range of 366 days or less.'
    return ''
  }, [scope, customFrom, customTo])

  const visibleMonth = useMemo(() => monthBounds(calendarYear, calendarMonth), [calendarYear, calendarMonth])
  const periodRange = useMemo(() => {
    if (scope === 'day') return isIsoDate(selectedDate) ? { from: selectedDate, to: selectedDate } : null
    if (scope === 'week') return week
    if (scope === 'custom') return customProblem ? null : { from: customFrom, to: customTo }
    return visibleMonth
  }, [scope, selectedDate, week, customProblem, customFrom, customTo, visibleMonth])

  const fetchRanges = useMemo(
    () => financeFetchRanges(periodRange, visibleMonth, selectedDate),
    [periodRange, visibleMonth, selectedDate],
  )
  const fetchKey = fetchRanges.map((range) => `${range.from}:${range.to}`).join(',')
  const fetchRangesRef = useRef(fetchRanges)
  fetchRangesRef.current = fetchRanges

  const load = useCallback(
    async (ranges, { quiet = false } = {}) => {
      const token = getFinanceToken()
      if (!token || !ranges?.length) return
      const requestId = ++loadId.current
      if (!quiet) setLoading(true)
      setLoadError('')
      try {
        const percentAtStart = savedPercentRef.current
        const parts = await Promise.all(ranges.map((range) => fetchFinance(token, range.from, range.to)))
        if (requestId !== loadId.current || !getFinanceToken()) return
        const merged = mergeFinance(parts)
        if (savedPercentRef.current !== percentAtStart) merged.deductionPercent = savedPercentRef.current
        setRecords(merged)
      } catch (error) {
        if (requestId !== loadId.current) return
        if (isLockedError(error)) {
          lockScreen()
          return
        }
        setLoadError(error?.message || 'Could not load finance records.')
      } finally {
        if (requestId === loadId.current) setLoading(false)
      }
    },
    [lockScreen],
  )

  useEffect(() => {
    if (phase !== 'open' || !fetchKey) return
    void load(fetchRangesRef.current)
  }, [phase, fetchKey, load])

  const dayDirty = financeDayDraftSignature(dayDraft) !== draftBaseline
  dirtyRef.current = dayDirty

  useEffect(() => {
    if (phase !== 'open') return
    if (dirtyRef.current) return
    const next = buildFinanceDayDraft(records, selectedDate)
    setDayDraft(next)
    setDraftBaseline(financeDayDraftSignature(next))
  }, [records, selectedDate, phase])

  useEffect(() => {
    if (!dayDirty) return undefined
    const onLeave = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dayDirty])

  const parsedPercent = parseDeductionPercent(percentInput)
  const activePercent = parsedPercent.ok ? parsedPercent.percent : readDeductionPercent(records.deductionPercent)
  const liveRecords = useMemo(
    () => applyFinanceDayDraft(records, selectedDate, dayDraft),
    [records, selectedDate, dayDraft],
  )
  const summary = useMemo(() => {
    if (!periodRange) return summarizeFinance({ categories: liveRecords.categories, deductionPercent: activePercent }, activePercent)
    return summarizeFinance(filterFinanceRange(liveRecords, periodRange.from, periodRange.to), activePercent)
  }, [liveRecords, periodRange, activePercent])
  const monthView = useMemo(
    () => summarizeFinance(filterFinanceRange(liveRecords, visibleMonth.from, visibleMonth.to), 0),
    [liveRecords, visibleMonth],
  )
  const dayByDate = useMemo(() => new Map(monthView.daily.map((day) => [day.date, day])), [monthView.daily])
  const cells = useMemo(() => calendarCells(calendarYear, calendarMonth), [calendarYear, calendarMonth])

  const activeDrivers = useMemo(
    () => records.drivers.filter((driver) => !driver.archived).sort((left, right) => left.name.localeCompare(right.name, 'en-GB')),
    [records.drivers],
  )
  const categories = useMemo(
    () => [...records.categories].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'en-GB')),
    [records.categories],
  )
  const selectedDaySummary = useMemo(
    () => summarizeFinance(filterFinanceRange(liveRecords, selectedDate, selectedDate), 0),
    [liveRecords, selectedDate],
  )
  const countedRows = dayDraft.rows.filter((row) => financeRowHasEntry(row))
  const tableTotals = countedRows.reduce(
    (totals, row) => {
      totals.income += financeAmountPence(row.income)
      totals.salary += financeAmountPence(row.salary)
      totals.diesel += financeAmountPence(row.diesel)
      totals.other += financeAmountPence(row.other)
      totals.profit += financeDraftProfitPence(row)
      return totals
    },
    { income: 0, salary: 0, diesel: 0, other: 0, profit: 0 },
  )

  async function onUnlock(event) {
    event.preventDefault()
    if (unlockingRef.current) return
    if (!isFinancePinComplete(pin)) {
      setPinError('Enter the 8-digit PIN.')
      return
    }
    unlockingRef.current = true
    setUnlocking(true)
    setPinError('')
    try {
      await unlockFinancePin(pin)
      setPin('')
      setPhase('open')
    } catch (error) {
      setPinError(error?.message || 'Incorrect PIN.')
    } finally {
      unlockingRef.current = false
      setUnlocking(false)
    }
  }

  async function afterChange(iso, { keepModal = false } = {}) {
    if (!getFinanceToken()) {
      lockScreen()
      return
    }
    let moved = false
    if (iso && isIsoDate(iso)) {
      const outside = !fetchRanges.some((range) => inDateRange(iso, range.from, range.to))
      if (outside) {
        moved = true
        const parts = monthYearFromIso(iso)
        setSelectedDate(iso)
        setCalendarYear(parts.year)
        setCalendarMonth(parts.month)
        if (scope === 'week') setWeek(weekRangeContaining(iso))
      }
    }
    if (!keepModal) setModal(null)
    if (!moved) await load(fetchRanges, { quiet: true })
  }

  async function persistPercent() {
    const parsed = parseDeductionPercent(percentInput)
    if (!parsed.ok) {
      setPercentError(parsed.error)
      return false
    }
    setPercentError('')
    if (parsed.percent === savedPercentRef.current) return true
    const token = getFinanceToken()
    if (!token) {
      lockScreen()
      return false
    }
    const saved = await saveFinanceDeduction(token, parsed.percent)
    const next = readDeductionPercent(saved)
    savedPercentRef.current = next
    setRecords((current) => ({ ...current, deductionPercent: next }))
    setPercentInput(String(next))
    return true
  }

  function updateDriverRow(key, changes) {
    setDayDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    }))
  }

  function updateIncomeRow(key, changes) {
    setDayDraft((current) => ({
      ...current,
      incomes: current.incomes.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    }))
  }

  function updateExpenseRow(key, changes) {
    setDayDraft((current) => ({
      ...current,
      expenses: current.expenses.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    }))
  }

  async function saveDay() {
    if (savingDayRef.current) return false
    const errors = validateFinanceDayDraft(dayDraft)
    if (errors.length) {
      setDayActionError(errors[0])
      return false
    }
    const token = getFinanceToken()
    if (!token) {
      lockScreen()
      return false
    }
    savingDayRef.current = true
    setSavingDay(true)
    setDayActionError('')
    try {
      const known = new Map(records.drivers.map((driver) => [driver.name.toLocaleLowerCase('en-GB'), driver]))
      const resolved = new Map()
      async function driverIdFor(name) {
        const clean = name.trim().replace(/\s+/g, ' ')
        const key = clean.toLocaleLowerCase('en-GB')
        if (resolved.has(key)) return resolved.get(key)
        const existing = known.get(key)
        if (existing) {
          if (existing.archived) throw new Error(`${clean} is archived. Restore them in Manage drivers.`)
          resolved.set(key, existing.id)
          return existing.id
        }
        try {
          const created = await saveFinanceDriver(token, { name: clean })
          known.set(key, created)
          resolved.set(key, created.id)
          return created.id
        } catch (error) {
          if (!/already exists/i.test(error?.message || '')) throw error
          const fresh = await fetchFinance(token, selectedDate, selectedDate)
          const found = (fresh.drivers || []).find(
            (driver) => !driver.archived && driver.name.toLocaleLowerCase('en-GB') === key,
          )
          if (!found) throw error
          known.set(key, found)
          resolved.set(key, found.id)
          return found.id
        }
      }

      const prepared = {
        ...dayDraft,
        rows: dayDraft.rows.map((row) =>
          row.id || !financeRowHasEntry(row) ? row : { ...row, key: financeClientKey(row.key) },
        ),
        incomes: dayDraft.incomes.map((row) => {
          const touched = [row.source, row.amount, row.description].some((value) => String(value || '').trim())
          return row.id || !touched ? row : { ...row, key: financeClientKey(row.key) }
        }),
        expenses: dayDraft.expenses.map((row) => {
          const touched = [row.amount, row.description, row.categoryId, row.newCategory, row.payee].some((value) =>
            String(value || '').trim(),
          )
          return row.id || !touched ? row : { ...row, key: financeClientKey(row.key) }
        }),
      }
      setDayDraft(prepared)

      for (const row of prepared.rows) {
        const name = String(row.driverName || '').trim()
        if (!name) continue
        const key = name.toLocaleLowerCase('en-GB')
        if (financeRowHasEntry(row) || !known.has(key)) await driverIdFor(name)
      }

      for (const id of prepared.removedDayIds) await ignoreMissingRecord(() => deleteFinanceDriverDay(token, id))
      for (const row of prepared.rows) {
        if (row.id && !financeRowHasEntry(row)) await ignoreMissingRecord(() => deleteFinanceDriverDay(token, row.id))
      }
      for (const row of prepared.rows) {
        if (!financeRowHasEntry(row)) continue
        const name = String(row.driverName || '').trim().replace(/\s+/g, ' ')
        await saveFinanceDriverDay(token, {
          id: row.id || '',
          activity_date: selectedDate,
          driver_id: await driverIdFor(name),
          source_name: String(row.source || '').trim(),
          income_gbp: penceToAmount(financeAmountPence(row.income)),
          salary_gbp: penceToAmount(financeAmountPence(row.salary)),
          diesel_gbp: penceToAmount(financeAmountPence(row.diesel)),
          other_gbp: penceToAmount(financeAmountPence(row.other)),
          other_description: String(row.otherDescription || '').trim(),
          client_key: row.id ? '' : row.key,
        })
      }

      for (const id of prepared.removedIncomeIds) await ignoreMissingRecord(() => deleteFinanceIncome(token, id))
      for (const row of prepared.incomes) {
        const source = String(row.source || '').trim()
        const amount = String(row.amount || '').trim()
        const description = String(row.description || '').trim()
        if (!source && !amount && !description) {
          if (row.id) await ignoreMissingRecord(() => deleteFinanceIncome(token, row.id))
          continue
        }
        await saveFinanceIncome(token, {
          id: row.id || '',
          activity_date: selectedDate,
          source_name: source,
          amount_gbp: penceToAmount(financeAmountPence(row.amount)),
          description,
          client_key: row.id ? '' : row.key,
        })
      }

      for (const id of prepared.removedExpenseIds) {
        const path = await ignoreMissingRecord(() => deleteFinanceExpense(token, id))
        if (path) await removeFinanceReceipt(path)
      }
      for (const row of prepared.expenses) {
        const amount = String(row.amount || '').trim()
        const description = String(row.description || '').trim()
        const categoryId = String(row.categoryId || '').trim()
        const newCategory = String(row.newCategory || '').trim()
        if (!amount && !description && !categoryId && !newCategory) {
          if (row.id) {
            const path = await ignoreMissingRecord(() => deleteFinanceExpense(token, row.id))
            if (path) await removeFinanceReceipt(path)
          }
          continue
        }
        await saveFinanceExpense(token, {
          id: row.id || '',
          expense_date: selectedDate,
          category_id: categoryId === '__new__' ? '' : categoryId,
          new_category_name: categoryId === '__new__' ? newCategory : '',
          amount_gbp: penceToAmount(financeAmountPence(row.amount)),
          description,
          payee_name: row.payee || '',
          receipt_path: row.receiptPath || '',
          receipt_name: row.receiptName || '',
          client_key: row.id ? '' : row.key,
        })
      }

      dirtyRef.current = false
      setDraftBaseline(financeDayDraftSignature(prepared))
      await load(fetchRangesRef.current, { quiet: true })
      return true
    } catch (error) {
      if (isLockedError(error)) lockScreen()
      else setDayActionError(error?.message || 'Could not save this day.')
      return false
    } finally {
      savingDayRef.current = false
      setSavingDay(false)
    }
  }

  function guardLeave(action) {
    if (!dayDirty) {
      action()
      return
    }
    setPendingLeave(() => action)
  }

  function discardLeave() {
    const action = pendingLeave
    if (!action) return
    dirtyRef.current = false
    setDraftBaseline(financeDayDraftSignature(dayDraft))
    setPendingLeave(null)
    action()
  }

  async function saveAndLeave() {
    const action = pendingLeave
    if (!action) return
    const saved = await saveDay()
    if (!saved) return
    setPendingLeave(null)
    action()
  }

  function onDriverName(row, value) {
    const match = activeDrivers.find((driver) => driver.name.toLocaleLowerCase('en-GB') === value.trim().toLocaleLowerCase('en-GB'))
    updateDriverRow(row.key, { driverName: value, driverId: match ? match.id : '' })
  }

  function addDriverRow() {
    setDayActionError('')
    setDayDraft((current) => ({
      ...current,
      rows: [...current.rows, blankDriverDraftRow({ key: crypto.randomUUID() })],
    }))
  }

  function addIncomeRow() {
    setDayDraft((current) => ({
      ...current,
      incomes: [...current.incomes, { key: crypto.randomUUID(), id: '', source: '', amount: '', description: '' }],
    }))
  }

  function addExpenseRow() {
    setDayDraft((current) => ({
      ...current,
      expenses: [
        ...current.expenses,
        {
          key: crypto.randomUUID(),
          id: '',
          categoryId: '',
          newCategory: '',
          amount: '',
          description: '',
          payee: '',
          receiptPath: '',
          receiptName: '',
        },
      ],
    }))
  }

  function dropDriverRow(row) {
    setDayDraft((current) => ({
      ...current,
      rows: current.rows.filter((item) => item.key !== row.key),
      removedDayIds: row.id ? [...current.removedDayIds, row.id] : current.removedDayIds,
    }))
  }

  function dropIncomeRow(row) {
    setDayDraft((current) => ({
      ...current,
      incomes: current.incomes.filter((item) => item.key !== row.key),
      removedIncomeIds: row.id ? [...current.removedIncomeIds, row.id] : current.removedIncomeIds,
    }))
  }

  function dropExpenseRow(row) {
    if (!row.id && row.receiptPath) void removeFinanceReceipt(row.receiptPath)
    setDayDraft((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.key !== row.key),
      removedExpenseIds: row.id ? [...current.removedExpenseIds, row.id] : current.removedExpenseIds,
    }))
  }

  function askRemove(kind, row) {
    const touched =
      kind === 'driver'
        ? Boolean(row.id) || financeRowHasEntry(row)
        : kind === 'income'
          ? Boolean(row.id) || [row.source, row.amount, row.description].some((value) => String(value || '').trim())
          : Boolean(row.id) ||
            [row.amount, row.description, row.categoryId, row.newCategory, row.payee, row.receiptName].some((value) =>
              String(value || '').trim(),
            )
    if (!touched) {
      if (kind === 'driver') dropDriverRow(row)
      else if (kind === 'income') dropIncomeRow(row)
      else dropExpenseRow(row)
      return
    }
    setPendingRemove({ kind, row })
  }

  function confirmPendingRemove() {
    const target = pendingRemove
    if (!target) return
    setPendingRemove(null)
    if (target.kind === 'driver') dropDriverRow(target.row)
    else if (target.kind === 'income') dropIncomeRow(target.row)
    else dropExpenseRow(target.row)
  }

  async function attachReceipt(row, file) {
    const check = validateReceiptFile(file)
    if (!check.ok) {
      setDayActionError(check.error)
      return
    }
    const token = getFinanceToken()
    if (!token) {
      lockScreen()
      return
    }
    setDayActionError('')
    try {
      const uploaded = await uploadFinanceReceipt(file)
      if (row.receiptPath && row.receiptPath !== uploaded.path) await removeFinanceReceipt(row.receiptPath)
      updateExpenseRow(row.key, { receiptPath: uploaded.path, receiptName: uploaded.name })
    } catch (error) {
      if (isLockedError(error)) lockScreen()
      else setDayActionError(error?.message || 'Could not attach the receipt.')
    }
  }

  async function confirmArchive() {
    if (!pendingArchive || archiving) return
    const token = getFinanceToken()
    setArchiving(true)
    setLoadError('')
    try {
      await setFinanceDriverArchived(token, pendingArchive.driver.id, pendingArchive.archived)
      setPendingArchive(null)
      await afterChange('', { keepModal: true })
    } catch (error) {
      if (isLockedError(error)) lockScreen()
      else setLoadError(error?.message || 'Could not update that driver.')
      setPendingArchive(null)
    } finally {
      setArchiving(false)
    }
  }

  async function onDownloadPdf() {
    if (pdfBusy) return
    const token = getFinanceToken()
    if (!token) {
      lockScreen()
      return
    }
    setPdfBusy(true)
    setLoadError('')
    try {
      if (dayDirty) {
        const savedDay = await saveDay()
        if (!savedDay) return
      }
      const percentSaved = await persistPercent()
      if (!percentSaved) return
      await ensureFinancePdfFont()
      const bounds = monthBounds(calendarYear, calendarMonth)
      const fresh = await fetchFinance(token, bounds.from, bounds.to)
      downloadFinanceMonthPdf({
        token,
        year: calendarYear,
        month: calendarMonth,
        generatedAt: new Date().toISOString(),
        deductionPercent: fresh.deductionPercent,
        ...fresh,
      })
    } catch (error) {
      if (isLockedError(error)) lockScreen()
      else setLoadError(error?.message || 'Could not download the PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  function goToday() {
    const iso = londonTodayIso()
    guardLeave(() => {
      const parts = monthYearFromIso(iso)
      setSelectedDate(iso)
      setCalendarYear(parts.year)
      setCalendarMonth(parts.month)
      setWeek(weekRangeContaining(iso))
    })
  }

  function moveCalendar(delta) {
    const next = shiftMonth(calendarYear, calendarMonth, delta)
    setCalendarYear(next.year)
    setCalendarMonth(next.month)
  }

  function moveWeek(direction) {
    const next = shiftWeek(week.from, direction)
    const nextDate = selectedDate >= next.from && selectedDate <= next.to ? selectedDate : next.from
    const apply = () => {
      setWeek(next)
      setSelectedDate(nextDate)
      const parts = monthYearFromIso(next.from)
      setCalendarYear(parts.year)
      setCalendarMonth(parts.month)
    }
    if (nextDate !== selectedDate) guardLeave(apply)
    else apply()
  }

  function selectDay(iso) {
    if (iso === selectedDate) return
    guardLeave(() => {
      setSelectedDate(iso)
      setDayActionError('')
      if (scope === 'week') setWeek(weekRangeContaining(iso))
    })
  }

  if (phase !== 'open') {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Finance & Profit is locked</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Enter the PIN to view or change records. Nothing is loaded until you unlock.
            </p>
          </div>
        </div>
        <form onSubmit={onUnlock} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="finance-pin">
            PIN
            <input
              id="finance-pin"
              data-testid="finance-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              pattern="[0-9]*"
              value={pin}
              onChange={(event) => {
                setPin(normalizeFinancePin(event.target.value))
                setPinError('')
              }}
              className={fieldClass}
            />
          </label>
          {pinError ? (
            <p className="text-sm text-red-700" role="alert">
              {pinError}
            </p>
          ) : null}
          <button type="submit" data-testid="finance-unlock" className={`${primaryButton} w-full`} disabled={unlocking}>
            {unlocking ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    )
  }

  const periodTitle =
    scope === 'day' ? 'Daily calculation' : scope === 'week' ? 'Weekly calculation' : scope === 'month' ? 'Monthly calculation' : 'Custom range calculation'
  const periodLabel =
    scope === 'day'
      ? formatIsoHeading(selectedDate)
      : scope === 'week'
        ? `${formatIsoLong(week.from)} – ${formatIsoLong(week.to)}`
        : scope === 'custom' && periodRange
          ? `${formatIsoLong(periodRange.from)} – ${formatIsoLong(periodRange.to)}`
          : formatMonthYear(calendarYear, calendarMonth)
  const selectedOutside = Boolean(periodRange && isIsoDate(selectedDate) && !inDateRange(selectedDate, periodRange.from, periodRange.to))
  const finalTone = summary.finalAmount < 0 ? 'bg-red-700' : 'bg-emerald-600'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Manual records</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="finance-pdf" className={primaryButton} onClick={() => void onDownloadPdf()} disabled={pdfBusy}>
            <Download className="h-4 w-4" aria-hidden />
            {pdfBusy ? 'Preparing PDF…' : 'Download monthly PDF'}
          </button>
          <button type="button" className={quietButton} onClick={() => guardLeave(lockScreen)}>
            <Lock className="h-4 w-4" aria-hidden />
            Lock
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reporting period">
          {[
            ['day', 'Day'],
            ['week', 'Week'],
            ['month', 'Month'],
            ['custom', 'Custom range'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              data-testid={`finance-scope-${value}`}
              onClick={() => setScope(value)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${
                scope === value ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {scope === 'week' ? (
          <div className="flex items-center gap-2">
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveWeek(-1)}>
              Previous week
            </button>
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveWeek(1)}>
              Next week
            </button>
          </div>
        ) : null}
      </div>

      {scope === 'custom' ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            From
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className={fieldClass} />
          </label>
        </div>
      ) : null}
      {customProblem ? <p className="text-sm text-red-700">{customProblem}</p> : null}
      <p className="text-xs leading-relaxed text-slate-500">
        Weeks run Monday to Sunday, Europe/London. Totals follow the selected period. The monthly PDF uses {formatMonthYear(calendarYear, calendarMonth)}.
      </p>

      {loadError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}

      <div className="grid gap-4 xl:grid-cols-[17.5rem_minmax(0,1fr)] xl:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="finance-calendar">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700" onClick={() => moveCalendar(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="min-w-0 text-center">
              <h2 className="truncate text-sm font-bold text-slate-900">{formatMonthYear(calendarYear, calendarMonth)}</h2>
              <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={goToday}>
                Today
              </button>
            </div>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700" onClick={() => moveCalendar(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-0.5">
                {day.slice(0, 2)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, index) => {
              if (!iso) return <div key={`blank-${index}`} className="h-9 rounded-md bg-slate-50/70" />
              const day = dayByDate.get(iso)
              const populated = Boolean(day && (day.drivers > 0 || day.income !== 0 || day.totalExpenses !== 0))
              const selected = iso === selectedDate
              const inWeek = scope === 'week' && inDateRange(iso, week.from, week.to)
              const inCustom = scope === 'custom' && periodRange && inDateRange(iso, periodRange.from, periodRange.to)
              const dayNumber = Number(iso.slice(-2))
              return (
                <button
                  key={iso}
                  type="button"
                  data-testid={`finance-day-${iso}`}
                  aria-pressed={selected}
                  aria-label={
                    populated
                      ? `${formatIsoHeading(iso)}. ${driverCountLabel(day.drivers)}. Income ${formatGbp(day.income)}. Expenses ${formatGbp(day.totalExpenses)}. Profit ${formatGbp(day.profit)}.`
                      : formatIsoHeading(iso)
                  }
                  onClick={() => selectDay(iso)}
                  className={`flex h-9 flex-col items-center justify-center rounded-md border text-xs leading-none ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-800 ring-1 ring-emerald-500'
                      : populated
                        ? 'border-emerald-200 bg-emerald-50/70 font-semibold text-slate-800'
                        : inWeek || inCustom
                          ? 'border-emerald-100 bg-emerald-50/40 text-slate-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  } ${iso === today && !selected ? 'text-emerald-700' : ''}`}
                >
                  {dayNumber}
                </button>
              )
            })}
          </div>
          <button type="button" className="mt-3 text-sm font-semibold text-emerald-700 hover:underline" onClick={() => setModal({ type: 'drivers' })}>
            Manage drivers
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" data-testid="finance-day-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{formatIsoHeading(selectedDate)}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {driverCountLabel(countedRows.length)} included. Empty rows stay as names until you enter an amount or mark Worked.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dayDirty ? (
                <p className="text-sm font-semibold text-amber-700" data-testid="finance-unsaved" role="status">
                  Unsaved changes
                </p>
              ) : null}
              <button type="button" data-testid="finance-save-day" className={primaryButton} onClick={() => void saveDay()} disabled={savingDay || loading || !dayDirty}>
                {savingDay ? 'Saving…' : 'Save day'}
              </button>
            </div>
          </div>
          {dayActionError ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {dayActionError}
            </p>
          ) : null}

          <datalist id="finance-driver-names">
            {activeDrivers.map((driver) => (
              <option key={driver.id} value={driver.name} />
            ))}
          </datalist>
          <datalist id="finance-income-sources">
            {records.sources.map((source) => (
              <option key={source.id} value={source.name} />
            ))}
          </datalist>

          <fieldset disabled={savingDay || loading} className="mt-3 min-w-0 border-0 p-0 disabled:opacity-70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm" data-testid="finance-day-table">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="min-w-[10rem] px-1.5 py-2">Driver name</th>
                  <th className="min-w-[9rem] px-1.5 py-2">Income source</th>
                  <th className="min-w-[6.5rem] px-1.5 py-2 text-right">Income (£)</th>
                  <th className="min-w-[6.5rem] px-1.5 py-2 text-right">Salary (£)</th>
                  <th className="min-w-[6.5rem] px-1.5 py-2 text-right">Diesel (£)</th>
                  <th className="min-w-[9rem] px-1.5 py-2 text-right">Other expenses (£)</th>
                  <th className="min-w-[6.5rem] px-1.5 py-2 text-right">Profit (£)</th>
                  <th className="min-w-[8.5rem] px-1.5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dayDraft.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-1.5 py-4 text-sm text-slate-500">
                      No driver rows yet. Add a row and type a name, or save drivers in Manage drivers.
                    </td>
                  </tr>
                ) : null}
                {dayDraft.rows.map((row) => {
                  const profit = financeDraftProfitPence(row)
                  const counted = financeRowHasEntry(row)
                  return (
                    <tr key={row.key} className={`border-b border-slate-100 ${counted ? 'bg-white' : 'bg-slate-50/60'}`}>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Driver name${row.driverName ? ` ${row.driverName}` : ''}`}
                          list="finance-driver-names"
                          value={row.driverName}
                          maxLength={80}
                          onChange={(event) => onDriverName(row, event.target.value)}
                          className={cellInput}
                          placeholder="Select or type a name"
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Income source for ${row.driverName || 'this driver'}`}
                          list="finance-income-sources"
                          value={row.source}
                          maxLength={80}
                          onChange={(event) => updateDriverRow(row.key, { source: event.target.value })}
                          className={cellInput}
                          placeholder="Source"
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Income for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.income}
                          onChange={(event) => updateDriverRow(row.key, { income: event.target.value })}
                          className={moneyInput}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Salary for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.salary}
                          onChange={(event) => updateDriverRow(row.key, { salary: event.target.value })}
                          className={moneyInput}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Diesel for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.diesel}
                          onChange={(event) => updateDriverRow(row.key, { diesel: event.target.value })}
                          className={moneyInput}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Other expenses for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.other}
                          onChange={(event) => updateDriverRow(row.key, { other: event.target.value })}
                          className={moneyInput}
                        />
                        {String(row.other || '').trim() || String(row.otherDescription || '').trim() ? (
                          <input
                            aria-label={`Other expenses description for ${row.driverName || 'this driver'}`}
                            value={row.otherDescription}
                            maxLength={240}
                            onChange={(event) => updateDriverRow(row.key, { otherDescription: event.target.value })}
                            className={`${cellInput} mt-1 text-xs`}
                            placeholder="Description"
                          />
                        ) : null}
                      </td>
                      <td className={`px-1.5 py-1.5 text-right font-semibold tabular-nums ${counted ? profitTextClass(profit) : 'text-slate-400'}`}>
                        {counted ? formatGbp(profit) : '—'}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={row.worked}
                              onChange={(event) => updateDriverRow(row.key, { worked: event.target.checked })}
                            />
                            Worked
                          </label>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                            aria-label={`Remove ${row.driverName || 'this driver'} from this day`}
                            onClick={() => askRemove('driver', row)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900">
                  <td className="px-1.5 py-2" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{formatGbp(tableTotals.income)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{formatGbp(tableTotals.salary)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{formatGbp(tableTotals.diesel)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{formatGbp(tableTotals.other)}</td>
                  <td className={`px-1.5 py-2 text-right tabular-nums ${profitTextClass(tableTotals.profit)}`}>{formatGbp(tableTotals.profit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" data-testid="finance-add-driver-row" className={`${quietButton} mt-3 border-emerald-200 text-emerald-800`} onClick={addDriverRow}>
            + Add driver row
          </button>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Additional income</p>
                <button type="button" className={`${quietButton} border-emerald-200 px-3 text-emerald-800`} onClick={addIncomeRow}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add income
                </button>
              </div>
              {dayDraft.incomes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No additional income on this day.</p> : null}
              <ul className="mt-2 space-y-2">
                {dayDraft.incomes.map((row) => (
                  <li key={row.key} className="grid grid-cols-[minmax(0,1.2fr)_6.5rem_auto] gap-2">
                    <input
                      aria-label="Additional income source"
                      list="finance-income-sources"
                      value={row.source}
                      maxLength={80}
                      placeholder="Source"
                      onChange={(event) => updateIncomeRow(row.key, { source: event.target.value })}
                      className={cellInput}
                    />
                    <input
                      aria-label="Additional income amount"
                      inputMode="decimal"
                      value={row.amount}
                      placeholder="0.00"
                      onChange={(event) => updateIncomeRow(row.key, { amount: event.target.value })}
                      className={moneyInput}
                    />
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50" aria-label="Remove additional income" onClick={() => askRemove('income', row)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                    <input
                      aria-label="Additional income description"
                      value={row.description}
                      maxLength={240}
                      placeholder="Description (optional)"
                      onChange={(event) => updateIncomeRow(row.key, { description: event.target.value })}
                      className={`${cellInput} col-span-3`}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Additional expenses</p>
                <button type="button" className={`${quietButton} border-emerald-200 px-3 text-emerald-800`} onClick={addExpenseRow}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add expense
                </button>
              </div>
              {dayDraft.expenses.length === 0 ? <p className="mt-2 text-sm text-slate-500">No additional expenses on this day.</p> : null}
              <ul className="mt-2 space-y-2">
                {dayDraft.expenses.map((row) => (
                  <li key={row.key} className="space-y-2 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_6.5rem_auto] gap-2">
                      <select
                        aria-label="Additional expense category"
                        value={row.categoryId}
                        onChange={(event) => updateExpenseRow(row.key, { categoryId: event.target.value })}
                        className={cellInput}
                      >
                        <option value="">Category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                        <option value="__new__">New category</option>
                      </select>
                      <input
                        aria-label="Additional expense amount"
                        inputMode="decimal"
                        value={row.amount}
                        placeholder="0.00"
                        onChange={(event) => updateExpenseRow(row.key, { amount: event.target.value })}
                        className={moneyInput}
                      />
                      <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50" aria-label="Remove additional expense" onClick={() => askRemove('expense', row)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {row.categoryId === '__new__' ? (
                      <input
                        aria-label="New expense category"
                        value={row.newCategory}
                        maxLength={80}
                        placeholder="Category name"
                        onChange={(event) => updateExpenseRow(row.key, { newCategory: event.target.value })}
                        className={cellInput}
                      />
                    ) : null}
                    <input
                      aria-label="Additional expense description"
                      value={row.description}
                      maxLength={240}
                      placeholder="Description (optional)"
                      onChange={(event) => updateExpenseRow(row.key, { description: event.target.value })}
                      className={cellInput}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        {row.receiptName || 'Attach receipt'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (file) void attachReceipt(row, file)
                          }}
                        />
                      </label>
                      {row.receiptPath ? (
                        <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => void openFinanceReceipt(row.receiptPath).catch((error) => setDayActionError(error?.message || 'Could not open the receipt.'))}>
                          View receipt
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          </fieldset>

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['Total income', selectedDaySummary.income],
              ['Total expenses', selectedDaySummary.expenses],
              ['Profit before deduction', selectedDaySummary.profit],
            ].map(([label, amount]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className={`mt-1 text-lg font-bold tabular-nums ${label.startsWith('Profit') ? profitTextClass(amount) : 'text-slate-900'}`}>
                  {formatGbp(amount)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Manually entered. A new name is saved for later dates when you save this day.</p>
          {selectedOutside ? (
            <p className="mt-2 text-xs text-slate-500">This day is outside the selected range. The period totals below stay on that range.</p>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">{periodTitle}</h2>
          <p className="text-sm font-medium text-slate-600">{periodLabel}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-center">
          <FormulaCard label="Total income" pence={summary.income} />
          <span className="hidden text-xl text-slate-300 xl:block" aria-hidden>−</span>
          <FormulaCard label="Total salaries" pence={summary.salaries} />
          <span className="hidden text-xl text-slate-300 xl:block" aria-hidden>−</span>
          <FormulaCard label="Total diesel" pence={summary.diesel} />
          <span className="hidden text-xl text-slate-300 xl:block" aria-hidden>−</span>
          <FormulaCard label="Total other expenses" pence={summary.other} />
          <span className="hidden text-xl text-slate-300 xl:block" aria-hidden>=</span>
          <FormulaCard label="Profit before deduction" pence={summary.profit} emphasize />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {formatGbp(summary.income)} − {formatGbp(summary.salaries)} − {formatGbp(summary.diesel)} − {formatGbp(summary.other)} = {formatGbp(summary.profit)}
        </p>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="text-sm font-medium text-slate-700" htmlFor="finance-deduction">
            Deduction (%)
            <span className="mt-1 flex items-center gap-2">
              <input
                id="finance-deduction"
                data-testid="finance-deduction"
                inputMode="decimal"
                value={percentInput}
                onFocus={() => {
                  percentFocused.current = true
                }}
                onBlur={() => {
                  percentFocused.current = false
                  void persistPercent().catch((error) => {
                    if (isLockedError(error)) lockScreen()
                    else setPercentError(error?.message || 'Could not save the percentage.')
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                onChange={(event) => {
                  setPercentInput(event.target.value)
                  setPercentError('')
                }}
                className="h-11 w-20 rounded-xl border border-slate-200 px-3 text-center text-sm font-semibold"
              />
              <span>%</span>
              <span className="font-semibold tabular-nums text-slate-900">= {formatGbp(summary.deduction)}</span>
            </span>
          </label>
          {percentError ? <p className="text-sm text-red-700">{percentError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className={`rounded-2xl px-5 py-4 text-white ${finalTone}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Final amount remaining</p>
              <p className="mt-1 text-3xl font-bold tabular-nums" data-testid="finance-final">
                {formatGbp(summary.finalAmount)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold tabular-nums text-slate-800">
                {formatGbp(summary.profit)} − {formatGbp(summary.deduction)} = {formatGbp(summary.finalAmount)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Percentage applied after expenses.</p>
              {summary.profit < 0 ? <p className="mt-1 text-xs text-red-700">The deduction is £0.00 while there is a loss.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <AmountList title="Income by source" rows={summary.sources} empty="No income in this period." />
        <AmountList title="Salaries by driver" rows={summary.salariesByDriver} empty="No salaries in this period." />
        <AmountList title="Other expenses by category" rows={summary.otherCategories} empty="No other expenses in this period." />
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Period totals</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {[
              ['Diesel', summary.diesel],
              ['Total expenses', summary.expenses],
              ['Profit before deduction', summary.profit],
              [`Deduction (${formatDeductionPercent(summary.deductionPercent)})`, summary.deduction],
              ['Final amount remaining', summary.finalAmount],
            ].map(([label, amount]) => (
              <li key={label} className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-700">{label}</span>
                <span className={`font-semibold tabular-nums ${label.startsWith('Profit') || label.startsWith('Final') ? profitTextClass(amount) : 'text-slate-900'}`}>
                  {formatGbp(amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {modal?.type === 'drivers' ? (
        <DriverManager
          drivers={records.drivers}
          onClose={() => setModal(null)}
          onCreate={async (name) => {
            const token = getFinanceToken()
            await saveFinanceDriver(token, { name })
            await afterChange('', { keepModal: true })
          }}
          onRename={async (driver, name) => {
            const token = getFinanceToken()
            await saveFinanceDriver(token, { id: driver.id, name })
            await afterChange('', { keepModal: true })
          }}
          onArchive={(driver, archived = true) => setPendingArchive({ driver, archived })}
        />
      ) : null}

      {pendingLeave ? (
        <DialogShell title="Save this day first?" onClose={() => !savingDay && setPendingLeave(null)} busy={savingDay}>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {formatIsoHeading(selectedDate)} has unsaved changes. Save them before leaving this day, or discard them.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={quietButton} disabled={savingDay} onClick={() => setPendingLeave(null)}>
              Cancel
            </button>
            <button type="button" className={quietButton} disabled={savingDay} onClick={discardLeave}>
              Discard
            </button>
            <button type="button" className={primaryButton} disabled={savingDay} onClick={() => void saveAndLeave()}>
              {savingDay ? 'Saving…' : 'Save and continue'}
            </button>
          </div>
        </DialogShell>
      ) : null}

      {pendingRemove ? (
        <DialogShell
          title={pendingRemove.kind === 'driver' ? 'Remove this driver from the day?' : 'Remove this entry?'}
          onClose={() => setPendingRemove(null)}
        >
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {pendingRemove.kind === 'driver'
              ? `Remove ${pendingRemove.row.driverName || 'this driver'} from ${formatIsoHeading(selectedDate)}? The saved driver stays in the list. Save day to keep this change.`
              : 'Remove this entry from the day? Save day to keep this change.'}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={quietButton} onClick={() => setPendingRemove(null)}>
              Cancel
            </button>
            <button type="button" className={`${buttonClass} bg-red-700 text-white hover:bg-red-600`} onClick={confirmPendingRemove}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </button>
          </div>
        </DialogShell>
      ) : null}

      {pendingArchive ? (
        <DialogShell
          title={pendingArchive.archived ? 'Archive this driver?' : 'Restore this driver?'}
          onClose={() => !archiving && setPendingArchive(null)}
          busy={archiving}
          stacked
        >
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {pendingArchive.archived
              ? `Archive ${pendingArchive.driver.name}? Past days stay in the records. The name is hidden from the saved driver list until you restore it.`
              : `Restore ${pendingArchive.driver.name} to the saved driver list? Past figures stay as they are.`}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={quietButton} disabled={archiving} onClick={() => setPendingArchive(null)}>
              Cancel
            </button>
            <button type="button" className={primaryButton} disabled={archiving} onClick={() => void confirmArchive()}>
              {archiving ? 'Saving…' : pendingArchive.archived ? 'Archive' : 'Restore'}
            </button>
          </div>
        </DialogShell>
      ) : null}
    </div>
  )
}

