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
  FINANCE_INCOME_SOURCE_PRESETS,
  financeAmountPence,
  financeDayDraftSignature,
  financeDraftProfitPence,
  financeFetchRanges,
  financeRowHasAmounts,
  financeRowHasEntry,
  financeRowsConfirmedOnSave,
  formatDeductionPercent,
  formatWeekdayDate,
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
  periodDriverReport,
  profitTextClass,
  readDeductionPercent,
  resolveIncomeSource,
  reconcileFinanceDayDraft,
  rowAttendance,
  shiftIsoDate,
  shiftMonth,
  summarizeFinance,
  toPence,
  validateFinanceDayDraft,
  validateReceiptFile,
  weekRangeContaining,
  weeklyAttendance,
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
  'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25'
const moneyInput = `${cellInput} text-right tabular-nums`
const dayCellInput =
  'h-8 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-1 text-[11px] leading-tight text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/25'
const dayMoneyInput = `${dayCellInput} text-right tabular-nums`
const dayHead =
  'px-1 py-1.5 align-bottom text-[10px] font-bold uppercase leading-tight tracking-tight text-slate-500 sm:text-[11px]'

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
      className={`min-w-[6.75rem] max-w-full flex-1 basis-[8.5rem] rounded-2xl border px-2.5 py-2.5 sm:px-3 sm:py-3 ${
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

function PeriodDriverTable({ rows }) {
  return (
    <div className="finance-table-scroll mt-3">
      <table className="finance-fit-table finance-period-table text-left text-xs" data-testid="finance-driver-report">
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200">
            <th className={`${dayHead} text-left`}>Driver name</th>
            <th className={`${dayHead} text-right`}>Days worked</th>
            <th className={`${dayHead} text-right`}>Income (£)</th>
            <th className={`${dayHead} text-right`}>Another income (£)</th>
            <th className={`${dayHead} text-right`}>Salary (£)</th>
            <th className={`${dayHead} text-right`}>Diesel (£)</th>
            <th className={`${dayHead} text-right`}>Other expenses (£)</th>
            <th className={`${dayHead} text-right`}>Profit before deduction</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-1 py-4 text-sm text-slate-500">
                No drivers worked in this period.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-1 py-1.5 font-semibold text-slate-900">
                <span className="block truncate" title={row.name}>{row.name}</span>
                {row.archived ? <span className="text-[11px] font-medium text-slate-500">Archived</span> : null}
              </td>
              <td className="px-1 py-1.5 text-right tabular-nums">{row.daysWorked}</td>
              <td className="px-1 py-1.5 text-right text-[11px] tabular-nums sm:text-xs">{formatGbp(row.income)}</td>
              <td className="px-1 py-1.5 text-right text-[11px] tabular-nums sm:text-xs">{formatGbp(row.another)}</td>
              <td className="px-1 py-1.5 text-right text-[11px] tabular-nums sm:text-xs">{formatGbp(row.salary)}</td>
              <td className="px-1 py-1.5 text-right text-[11px] tabular-nums sm:text-xs">{formatGbp(row.diesel)}</td>
              <td className="px-1 py-1.5 text-right text-[11px] tabular-nums sm:text-xs">{formatGbp(row.other)}</td>
              <td className={`px-1 py-1.5 text-right text-[11px] font-semibold tabular-nums sm:text-xs ${profitTextClass(row.profit)}`}>{formatGbp(row.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordList({ title, rows, empty, render, amount }) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : null}
      <ul className="mt-2 divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id || `${render(row)}-${amount(row)}`} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 break-words text-slate-700">{render(row)}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatGbp(amount(row))}</span>
          </li>
        ))}
      </ul>
    </section>
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

function DriverNameRow({ driver, onSave, onDelete }) {
  const [name, setName] = useState(driver.name)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(driver.name)
  }, [driver.name])

  if (!editing) {
    return (
      <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 break-words text-sm font-semibold text-slate-900">{driver.name}</span>
        <div className="flex gap-2">
          <button type="button" className={quietButton} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className={`${quietButton} text-red-700`} onClick={() => onDelete(driver)}>
            Delete driver
          </button>
        </div>
      </li>
    )
  }

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
          disabled={saving || !name.trim() || name.trim() === driver.name}
          onClick={() => {
            setSaving(true)
            Promise.resolve(onSave(driver, name))
              .then((saved) => {
                if (saved !== false) setEditing(false)
              })
              .finally(() => setSaving(false))
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className={quietButton}
          disabled={saving}
          onClick={() => {
            setName(driver.name)
            setEditing(false)
          }}
        >
          Cancel
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
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Enter a driver name.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onCreate(cleanName)
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
        Add a name here. It is saved immediately and stays available on every date. No income or expenses are created. Delete driver removes the name from new days and keeps past attendance and figures.
      </p>
      <form onSubmit={create} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Driver name"
          aria-label="Driver name"
          className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
        <button type="submit" className={primaryButton} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Add driver'}
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
                return true
              } catch (renameError) {
                setError(renameError?.message || 'Could not rename that driver.')
                return false
              }
            }}
            onDelete={onArchive}
          />
        ))}
      </ul>
      {archived.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900">Removed from the active list</h3>
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
  const [editingDay, setEditingDay] = useState(false)
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
  const [pendingAttendance, setPendingAttendance] = useState(null)
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
  const reportWeek = useMemo(() => weekRangeContaining(selectedDate), [selectedDate])
  const periodRange = useMemo(() => {
    if (scope === 'day') return isIsoDate(selectedDate) ? { from: selectedDate, to: selectedDate } : null
    if (scope === 'week') return reportWeek
    if (scope === 'custom') return customProblem ? null : { from: customFrom, to: customTo }
    return visibleMonth
  }, [scope, selectedDate, reportWeek, customProblem, customFrom, customTo, visibleMonth])

  const fetchRanges = useMemo(
    () => financeFetchRanges(periodRange, visibleMonth, selectedDate, scope === 'week' ? reportWeek : null),
    [periodRange, visibleMonth, selectedDate, scope, reportWeek],
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
    const clean = buildFinanceDayDraft(records, selectedDate)
    const cleanSignature = financeDayDraftSignature(clean)
    if (!dirtyRef.current) {
      setDayDraft(clean)
      setDraftBaseline(cleanSignature)
      return
    }
    setDayDraft((dirty) => {
      const next = reconcileFinanceDayDraft(clean, dirty)
      return financeDayDraftSignature(next) === financeDayDraftSignature(dirty) ? dirty : next
    })
    setDraftBaseline(cleanSignature)
  }, [records, selectedDate, phase])

  useEffect(() => {
    setEditingDay(false)
  }, [selectedDate])

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
  const savedDayRecords = useMemo(
    () => filterFinanceRange(records, selectedDate, selectedDate),
    [records, selectedDate],
  )
  const dayHasSavedRecords =
    savedDayRecords.driverDays.length > 0 || savedDayRecords.incomes.length > 0 || savedDayRecords.expenses.length > 0
  const historyMode = dayHasSavedRecords && !editingDay
  const summary = useMemo(() => {
    const source = scope === 'day' && !historyMode ? liveRecords : records
    if (!periodRange) return summarizeFinance({ categories: source.categories, deductionPercent: activePercent }, activePercent)
    return summarizeFinance(filterFinanceRange(source, periodRange.from, periodRange.to), activePercent)
  }, [records, liveRecords, periodRange, activePercent, scope, historyMode])
  const monthView = useMemo(
    () => summarizeFinance(filterFinanceRange(records, visibleMonth.from, visibleMonth.to), 0),
    [records, visibleMonth],
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
    () => summarizeFinance(filterFinanceRange(historyMode ? records : liveRecords, selectedDate, selectedDate), activePercent),
    [historyMode, records, liveRecords, selectedDate, activePercent],
  )
  const attendanceView = useMemo(
    () => weeklyAttendance(records, reportWeek.from, reportWeek.to),
    [records, reportWeek],
  )
  const periodDrivers = useMemo(
    () => (periodRange ? periodDriverReport(records, periodRange.from, periodRange.to) : []),
    [records, periodRange],
  )
  const periodEntries = useMemo(
    () => (periodRange ? filterFinanceRange(records, periodRange.from, periodRange.to) : { incomes: [], expenses: [] }),
    [records, periodRange],
  )
  const shownDriverRows = historyMode ? dayDraft.rows.filter((row) => row.id) : dayDraft.rows
  const shownIncomes = historyMode ? dayDraft.incomes.filter((row) => row.id) : dayDraft.incomes
  const shownExpenses = historyMode ? dayDraft.expenses.filter((row) => row.id) : dayDraft.expenses
  const countedRows = dayDraft.rows.filter((row) => financeRowHasEntry(row))
  const tableTotals = countedRows.reduce(
    (totals, row) => {
      totals.income += financeAmountPence(row.income)
      totals.anotherIncome += financeAmountPence(row.anotherIncome)
      totals.salary += financeAmountPence(row.salary)
      totals.diesel += financeAmountPence(row.diesel)
      totals.other += financeAmountPence(row.other)
      totals.profit += financeDraftProfitPence(row)
      return totals
    },
    { income: 0, anotherIncome: 0, salary: 0, diesel: 0, other: 0, profit: 0 },
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
        rows: dayDraft.rows.map((row) => {
          const named = String(row.driverName || '').trim()
          const removed = (dayDraft.removedDayIds || []).includes(row.id)
          return row.id || !named || removed ? row : { ...row, key: financeClientKey(row.key) }
        }),
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

      const confirmed = financeRowsConfirmedOnSave(prepared.rows, prepared.removedDayIds)
      const savingKeys = new Set(confirmed.map((row) => row.key))
      async function idForRow(row) {
        const savedDriver = records.drivers.find((driver) => driver.id && driver.id === row.driverId)
        if (savedDriver?.archived && row.id) return savedDriver.id
        return driverIdFor(row.driverName)
      }
      for (const row of confirmed) await idForRow(row)

      for (const id of prepared.removedDayIds) await ignoreMissingRecord(() => deleteFinanceDriverDay(token, id))
      for (const row of prepared.rows) {
        if (row.id && !savingKeys.has(row.key)) await ignoreMissingRecord(() => deleteFinanceDriverDay(token, row.id))
      }
      for (const row of confirmed) {
        const absent = row.attendance === 'absent'
        await saveFinanceDriverDay(token, {
          id: row.id || '',
          activity_date: selectedDate,
          driver_id: await idForRow(row),
          source_name: absent ? '' : resolveIncomeSource(row),
          income_gbp: penceToAmount(absent ? 0 : financeAmountPence(row.income)),
          another_income_gbp: penceToAmount(absent ? 0 : financeAmountPence(row.anotherIncome)),
          salary_gbp: penceToAmount(absent ? 0 : financeAmountPence(row.salary)),
          diesel_gbp: penceToAmount(absent ? 0 : financeAmountPence(row.diesel)),
          other_gbp: penceToAmount(absent ? 0 : financeAmountPence(row.other)),
          other_description: absent ? '' : String(row.otherDescription || '').trim(),
          attendance: row.attendance,
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
      setEditingDay(false)
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

  function rememberDriver(driver) {
    if (!driver?.id) return
    setRecords((current) => ({
      ...current,
      drivers: [...current.drivers.filter((item) => item.id !== driver.id), driver],
    }))
  }

  function listedDriver(row) {
    if (!row?.driverId) return false
    return records.drivers.some((driver) => driver.id === row.driverId && (!driver.archived || row.id))
  }

  function applyAttendance(row, next) {
    updateDriverRow(row.key, {
      attendance: next,
      worked: next === 'worked',
      ...(next === 'absent'
        ? { source: '', sourceChoice: '', sourceCustom: '', income: '', anotherIncome: '', salary: '', diesel: '', other: '', otherDescription: '' }
        : {}),
    })
  }

  function chooseAttendance(row, next) {
    if (rowAttendance(row) === next) return
    if (next === 'absent' && financeRowHasAmounts(row)) {
      setPendingAttendance({ row, next })
      return
    }
    applyAttendance(row, next)
  }

  function resetListedDriver(row) {
    setDayDraft((current) => ({
      ...current,
      rows: current.rows.map((item) =>
        item.key === row.key
          ? blankDriverDraftRow({
              key: item.key,
              driverId: item.driverId,
              driverName: item.driverName,
              attendance: 'not_set',
            })
          : item,
      ),
      removedDayIds: row.id ? [...current.removedDayIds, row.id] : current.removedDayIds,
    }))
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
    if (kind === 'driver' && listedDriver(row)) {
      if (row.id || financeRowHasEntry(row)) setPendingRemove({ kind: 'clear-driver', row })
      return
    }
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
    if (target.kind === 'clear-driver') resetListedDriver(target.row)
    else if (target.kind === 'driver') dropDriverRow(target.row)
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
      setEditingDay(false)
    })
  }

  function moveCalendar(delta) {
    const next = shiftMonth(calendarYear, calendarMonth, delta)
    setCalendarYear(next.year)
    setCalendarMonth(next.month)
  }

  function moveWeek(direction) {
    const target = shiftIsoDate(selectedDate, direction * 7)
    if (!isIsoDate(target) || target === selectedDate) return
    guardLeave(() => {
      const parts = monthYearFromIso(target)
      setSelectedDate(target)
      setCalendarYear(parts.year)
      setCalendarMonth(parts.month)
      setEditingDay(false)
      setDayActionError('')
    })
  }

  function chooseScope(value) {
    if (value === scope) return
    guardLeave(() => {
      setScope(value)
      setEditingDay(false)
      setDayActionError('')
    })
  }

  function selectDay(iso, { openDay = false } = {}) {
    const nextScope = openDay || scope === 'week' || scope === 'month' ? 'day' : scope
    if (iso === selectedDate && nextScope === scope) return
    guardLeave(() => {
      setSelectedDate(iso)
      setScope(nextScope)
      setEditingDay(false)
      setDayActionError('')
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
        ? `${formatIsoLong(reportWeek.from)} – ${formatIsoLong(reportWeek.to)}`
        : scope === 'custom' && periodRange
          ? `${formatIsoLong(periodRange.from)} – ${formatIsoLong(periodRange.to)}`
          : formatMonthYear(calendarYear, calendarMonth)
  const finalTone = summary.finalAmount < 0 ? 'bg-red-700' : 'bg-emerald-600'

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Manual records</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quietButton} onClick={() => guardLeave(lockScreen)}>
            <Lock className="h-4 w-4" aria-hidden />
            Lock
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
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
              onClick={() => chooseScope(value)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${
                scope === value ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {scope === 'week' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveWeek(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous week
            </button>
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveWeek(1)}>
              Next week
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        {scope === 'month' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveCalendar(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous month
            </button>
            <button type="button" className={`${quietButton} px-3`} onClick={() => moveCalendar(1)}>
              Next month
              <ChevronRight className="h-4 w-4" aria-hidden />
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
        {scope === 'week'
          ? 'Weeks run Monday to Sunday, Europe/London. Totals use the saved records for this week.'
          : scope === 'month'
            ? `Monthly report for ${formatMonthYear(calendarYear, calendarMonth)}. The PDF uses this month.`
            : scope === 'custom'
              ? 'Custom range totals use the saved records between these dates. The percentage is applied once.'
              : 'Day shows this date only. A saved day stays as recorded until you choose Edit day.'}
      </p>

      {loadError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}

      <div className="grid min-w-0 gap-3 md:grid-cols-[14.5rem_minmax(0,1fr)] md:items-start">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3" data-testid="finance-calendar">
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
              const inWeek = scope === 'week' && inDateRange(iso, reportWeek.from, reportWeek.to)
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

        {scope === 'day' ? (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3" data-testid="finance-day-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{formatIsoHeading(selectedDate)}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {historyMode
                  ? 'Saved records for this day.'
                  : `${driverCountLabel(activeDrivers.length)} saved. Tick Did not work for drivers who were absent. Unticked drivers are recorded as Worked when you save the day.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dayDirty && !historyMode ? (
                <p className="text-sm font-semibold text-amber-700" data-testid="finance-unsaved" role="status">
                  Unsaved changes
                </p>
              ) : null}
              {historyMode ? (
                <button type="button" data-testid="finance-edit-day" className={primaryButton} onClick={() => setEditingDay(true)}>
                  Edit day
                </button>
              ) : (
                <button type="button" data-testid="finance-save-day" className={primaryButton} onClick={() => void saveDay()} disabled={savingDay || loading || (!dayDirty && dayHasSavedRecords)}>
                  {savingDay ? 'Saving…' : 'Save day'}
                </button>
              )}
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

          <fieldset disabled={historyMode || savingDay || loading} className={`mt-3 min-w-0 border-0 p-0 ${historyMode ? 'disabled:opacity-100' : 'disabled:opacity-70'}`}>
          <div className="finance-table-scroll">
            <table className="finance-fit-table finance-day-table text-left text-xs" data-testid="finance-day-table">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[8.5%]" />
                <col className="w-[8.5%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={dayHead}>Driver name</th>
                  <th className={dayHead}>Income source</th>
                  <th className={`${dayHead} text-right`}>Income (£)</th>
                  <th className={`${dayHead} text-right`}>Another income (£)</th>
                  <th className={`${dayHead} text-right`}>Salary (£)</th>
                  <th className={`${dayHead} text-right`}>Diesel (£)</th>
                  <th className={`${dayHead} text-right`}>Other expenses (£)</th>
                  <th className={`${dayHead} text-right`}>Profit (£)</th>
                  <th className={dayHead}>Attendance</th>
                  <th className={`${dayHead} normal-case tracking-normal text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownDriverRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-1.5 py-4 text-sm text-slate-500">
                      {historyMode ? 'No driver records saved for this day.' : 'No saved drivers yet. Add a name in Manage drivers.'}
                    </td>
                  </tr>
                ) : null}
                {shownDriverRows.map((row) => {
                  const profit = financeDraftProfitPence(row)
                  const attendance = rowAttendance(row)
                  const absent = attendance === 'absent'
                  const counted = financeRowHasEntry(row) && !absent
                  const savedName = listedDriver(row)
                  return (
                    <tr key={row.key} className={`border-b border-slate-100 ${absent ? 'bg-slate-100/90 text-slate-500' : counted ? 'bg-white' : 'bg-slate-50/60'}`}>
                      <td className="px-1 py-1">
                        {savedName ? (
                          <div className="min-w-0 px-0.5">
                            <p className="truncate text-xs font-semibold text-slate-900" title={row.driverName}>{row.driverName}</p>
                            {absent ? <p className="text-[11px] font-semibold text-slate-500">Did not work</p> : null}
                          </div>
                        ) : (
                          <input
                            aria-label={`Driver name${row.driverName ? ` ${row.driverName}` : ''}`}
                            list="finance-driver-names"
                            value={row.driverName}
                            maxLength={80}
                            onChange={(event) => onDriverName(row, event.target.value)}
                            className={dayCellInput}
                            placeholder="Name"
                            title={row.driverName || 'Select or type a name'}
                          />
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <div className="min-w-0">
                        <select
                          aria-label={`Income source for ${row.driverName || 'this driver'}`}
                          value={row.sourceChoice || ''}
                          onChange={(event) => {
                            const choice = event.target.value
                            const custom = choice === 'other' ? row.sourceCustom || '' : ''
                            updateDriverRow(row.key, {
                              sourceChoice: choice,
                              sourceCustom: custom,
                              source: choice === 'other' ? custom : choice,
                            })
                          }}
                          className={dayCellInput}
                          disabled={absent}
                          title={row.sourceChoice === 'other' ? row.sourceCustom || 'Other' : row.sourceChoice || 'Income source'}
                        >
                          <option value="">Income source</option>
                          {FINANCE_INCOME_SOURCE_PRESETS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value="other">Other</option>
                        </select>
                        {row.sourceChoice === 'other' ? (
                          <label className="mt-1 block text-[11px] font-medium text-slate-600">
                            Enter income source
                            <input
                              aria-label={`Enter income source for ${row.driverName || 'this driver'}`}
                              value={row.sourceCustom || ''}
                              maxLength={80}
                              onChange={(event) =>
                                updateDriverRow(row.key, {
                                  sourceChoice: 'other',
                                  sourceCustom: event.target.value,
                                  source: event.target.value,
                                })
                              }
                              className={`${dayCellInput} mt-1`}
                              disabled={absent}
                            />
                          </label>
                        ) : null}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <input
                          aria-label={`Income for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.income}
                          onChange={(event) => updateDriverRow(row.key, { income: event.target.value })}
                          className={dayMoneyInput}
                          disabled={absent}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          aria-label={`Another income for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.anotherIncome || ''}
                          onChange={(event) => updateDriverRow(row.key, { anotherIncome: event.target.value })}
                          className={dayMoneyInput}
                          disabled={absent}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          aria-label={`Salary for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.salary}
                          onChange={(event) => updateDriverRow(row.key, { salary: event.target.value })}
                          className={dayMoneyInput}
                          disabled={absent}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          aria-label={`Diesel for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.diesel}
                          onChange={(event) => updateDriverRow(row.key, { diesel: event.target.value })}
                          className={dayMoneyInput}
                          disabled={absent}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          aria-label={`Other expenses for ${row.driverName || 'this driver'}`}
                          inputMode="decimal"
                          value={row.other}
                          onChange={(event) => updateDriverRow(row.key, { other: event.target.value })}
                          className={dayMoneyInput}
                          disabled={absent}
                        />
                        {String(row.other || '').trim() || String(row.otherDescription || '').trim() ? (
                          <input
                            aria-label={`Other expenses description for ${row.driverName || 'this driver'}`}
                            value={row.otherDescription}
                            maxLength={240}
                            onChange={(event) => updateDriverRow(row.key, { otherDescription: event.target.value })}
                            className={`${dayCellInput} mt-1`}
                            placeholder="Description"
                          />
                        ) : null}
                      </td>
                      <td className={`px-0.5 py-1 text-right text-[11px] font-semibold tabular-nums ${absent ? 'text-slate-500' : counted ? profitTextClass(profit) : 'text-slate-400'}`} title={absent ? formatGbp(0) : counted ? formatGbp(profit) : '—'}>
                        {absent ? formatGbp(0) : counted ? formatGbp(profit) : '—'}
                      </td>
                      <td className="px-1 py-1">
                        <AttendanceControl value={attendance} driverName={row.driverName} onChange={(next) => chooseAttendance(row, next)} />
                      </td>
                      <td className="px-0.5 py-1 text-center">
                        {!savedName || row.id || financeRowHasEntry(row) ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                            aria-label={`Remove ${row.driverName || 'this driver'} from this day`}
                            onClick={() => askRemove('driver', row)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900">
                  <td className="px-1 py-1.5" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-0.5 py-1.5 text-right text-[11px] tabular-nums">{formatGbp(tableTotals.income)}</td>
                  <td className="px-0.5 py-1.5 text-right text-[11px] tabular-nums">{formatGbp(tableTotals.anotherIncome)}</td>
                  <td className="px-0.5 py-1.5 text-right text-[11px] tabular-nums">{formatGbp(tableTotals.salary)}</td>
                  <td className="px-0.5 py-1.5 text-right text-[11px] tabular-nums">{formatGbp(tableTotals.diesel)}</td>
                  <td className="px-0.5 py-1.5 text-right text-[11px] tabular-nums">{formatGbp(tableTotals.other)}</td>
                  <td className={`px-0.5 py-1.5 text-right text-[11px] tabular-nums ${profitTextClass(tableTotals.profit)}`}>{formatGbp(tableTotals.profit)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {historyMode ? null : (
          <button type="button" data-testid="finance-add-driver-row" className={`${quietButton} mt-3 border-emerald-200 text-emerald-800`} onClick={addDriverRow}>
            + Add driver row
          </button>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Additional income</p>
                {historyMode ? null : (
                <button type="button" className={`${quietButton} border-emerald-200 px-3 text-emerald-800`} onClick={addIncomeRow}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add income
                </button>
                )}
              </div>
              {shownIncomes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No additional income on this day.</p> : null}
              <ul className="mt-2 space-y-2">
                {shownIncomes.map((row) => (
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
                {historyMode ? null : (
                <button type="button" className={`${quietButton} border-emerald-200 px-3 text-emerald-800`} onClick={addExpenseRow}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add expense
                </button>
                )}
              </div>
              {shownExpenses.length === 0 ? <p className="mt-2 text-sm text-slate-500">No additional expenses on this day.</p> : null}
              <ul className="mt-2 space-y-2">
                {shownExpenses.map((row) => (
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
              [`Deduction (${formatDeductionPercent(selectedDaySummary.deductionPercent)})`, selectedDaySummary.deduction],
              ['Final amount remaining', selectedDaySummary.finalAmount],
            ].map(([label, amount]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className={`mt-1 text-lg font-bold tabular-nums ${label.startsWith('Profit') || label.startsWith('Final') ? profitTextClass(amount) : 'text-slate-900'}`}>
                  {formatGbp(amount)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-slate-600">
            {formatGbp(selectedDaySummary.income)} − {formatGbp(selectedDaySummary.expenses)} = {formatGbp(selectedDaySummary.profit)}. {formatGbp(selectedDaySummary.profit)} − {formatGbp(selectedDaySummary.deduction)} = {formatGbp(selectedDaySummary.finalAmount)}
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="finance-deduction">
            Deduction (%)
            <span className="mt-1 flex flex-wrap items-center gap-2">
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
              <span className="font-semibold tabular-nums text-slate-900">= {formatGbp(selectedDaySummary.deduction)}</span>
            </span>
          </label>
          {percentError && scope === 'day' ? <p className="mt-2 text-sm text-red-700">{percentError}</p> : null}
          <p className="mt-3 text-xs text-slate-500">
            {historyMode
              ? 'These are the saved figures for this date. Edit day to correct them.'
              : 'Names added in Manage drivers are saved immediately. Attendance and figures on this day are stored when you press Save day.'}
          </p>
        </section>
        ) : (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3" data-testid="finance-period-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{periodTitle}</h2>
              <p className="mt-1 text-sm text-slate-600">{periodLabel}</p>
            </div>
            {scope === 'month' ? (
              <button type="button" data-testid="finance-pdf" className={primaryButton} onClick={() => void onDownloadPdf()} disabled={pdfBusy}>
                <Download className="h-4 w-4" aria-hidden />
                {pdfBusy ? 'Preparing PDF…' : 'Download monthly PDF'}
              </button>
            ) : null}
          </div>
          {scope === 'week' || scope === 'month' ? (
            <PeriodDriverTable rows={periodDrivers} />
          ) : (
            <p className="mt-3 text-sm text-slate-600">Totals for the dates you choose. Saved income and expenses are counted once.</p>
          )}
          {scope === 'week' || scope === 'month' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <RecordList
                title="Additional income"
                empty="No additional income in this period."
                rows={periodEntries.incomes}
                render={(row) => `${formatIsoHeading(row.activity_date)} · ${row.source_name || 'Not named'}${row.description ? ` · ${row.description}` : ''}`}
                amount={(row) => toPence(row.amount_gbp)}
              />
              <RecordList
                title="Additional expenses"
                empty="No additional expenses in this period."
                rows={periodEntries.expenses}
                render={(row) => `${formatIsoHeading(row.expense_date)} · ${row.category_name || 'Other expenses'}${row.description ? ` · ${row.description}` : ''}`}
                amount={(row) => toPence(row.amount_gbp)}
              />
            </div>
          ) : null}
          {scope === 'month' ? (
            <div className="finance-table-scroll mt-4">
              <h3 className="text-sm font-bold text-slate-900">Daily breakdown</h3>
              <table className="finance-fit-table mt-2 text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2 text-right">Drivers</th>
                    <th className="px-2 py-2 text-right">Income</th>
                    <th className="px-2 py-2 text-right">Expenses</th>
                    <th className="px-2 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daily.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-sm text-slate-500">No saved records this month.</td>
                    </tr>
                  ) : null}
                  {summary.daily.map((day) => (
                    <tr key={day.date} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <button type="button" className="font-semibold text-emerald-800 hover:underline" onClick={() => selectDay(day.date, { openDay: true })}>
                          {formatIsoHeading(day.date)}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{day.drivers}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatGbp(day.income)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatGbp(day.totalExpenses)}</td>
                      <td className={`px-2 py-2 text-right font-semibold tabular-nums ${profitTextClass(day.profit)}`}>{formatGbp(day.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
        )}
      </div>

      {scope === 'week' ? (
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3" data-testid="finance-weekly-attendance">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Weekly attendance</h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatIsoLong(reportWeek.from)} – {formatIsoLong(reportWeek.to)}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Days worked counts saved Worked dates. Not set is unrecorded and is not treated as Did not work.
        </p>
        <div className="finance-table-scroll mt-3">
          <table className="finance-fit-table finance-attendance-table text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Driver</th>
                {attendanceView.dates.map((iso) => (
                  <th key={iso} className="px-2 py-2 text-center">
                    {formatWeekdayDate(iso)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Days worked</th>
              </tr>
            </thead>
            <tbody>
              {attendanceView.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-sm text-slate-500">
                    Add a driver to see weekly attendance.
                  </td>
                </tr>
              ) : null}
              {attendanceView.rows.map((driver) => (
                <tr key={driver.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-semibold text-slate-900">
                    {driver.name}
                    {driver.archived ? <span className="ml-1 text-xs font-medium text-slate-500">Archived</span> : null}
                  </td>
                  {attendanceView.dates.map((iso, index) => {
                    const status = driver.cells[index]
                    const tone =
                      status === 'worked'
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                        : status === 'absent'
                          ? 'border-slate-200 bg-slate-200 text-slate-500'
                          : 'border-dashed border-slate-300 bg-white text-slate-400'
                    const label = status === 'worked' ? 'Worked' : status === 'absent' ? 'Did not work' : 'Not set'
                    return (
                      <td key={iso} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          className={`min-h-9 w-full whitespace-normal rounded-md border px-0.5 py-1 text-[10px] font-semibold leading-tight sm:text-[11px] ${tone}`}
                          aria-label={`${driver.name}, ${formatIsoHeading(iso)}, ${label}. Open this day.`}
                          onClick={() => selectDay(iso, { openDay: true })}
                        >
                          {label}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-right text-base font-bold tabular-nums text-slate-900">{driver.daysWorked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {scope === 'day' ? null : (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">{periodTitle}</h2>
          <p className="text-sm font-medium text-slate-600">{periodLabel}</p>
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-stretch gap-2">
          <FormulaCard label="Total income" pence={summary.income} />
          <span className="hidden text-xl text-slate-300 min-[1500px]:block" aria-hidden>−</span>
          <FormulaCard label="Total salaries" pence={summary.salaries} />
          <span className="hidden text-xl text-slate-300 min-[1500px]:block" aria-hidden>−</span>
          <FormulaCard label="Total diesel" pence={summary.diesel} />
          <span className="hidden text-xl text-slate-300 min-[1500px]:block" aria-hidden>−</span>
          <FormulaCard label="Total other expenses" pence={summary.other} />
          <span className="hidden text-xl text-slate-300 min-[1500px]:block" aria-hidden>=</span>
          <FormulaCard label={scope === 'week' ? 'Weekly profit' : scope === 'month' ? 'Monthly profit' : 'Profit before deduction'} pence={summary.profit} emphasize />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {formatGbp(summary.income)} − {formatGbp(summary.expenses)} = {formatGbp(summary.profit)}. {formatGbp(summary.profit)} − {formatGbp(summary.deduction)} = {formatGbp(summary.finalAmount)}
        </p>
        <div className="mt-4 flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <label className="text-sm font-medium text-slate-700" htmlFor="finance-deduction">
            Deduction (%)
            <span className="mt-1 flex flex-wrap items-center gap-2">
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
      )}

      {scope === 'custom' ? (
      <div className="grid gap-3 md:grid-cols-2">
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
      ) : null}

      {modal?.type === 'drivers' ? (
        <DriverManager
          drivers={records.drivers}
          onClose={() => setModal(null)}
          onCreate={async (name) => {
            const token = getFinanceToken()
            if (!token) {
              lockScreen()
              throw new Error('Unlock Finance & Profit and try again.')
            }
            const created = await saveFinanceDriver(token, { name })
            rememberDriver(created)
            await afterChange('', { keepModal: true })
          }}
          onRename={async (driver, name) => {
            const token = getFinanceToken()
            if (!token) {
              lockScreen()
              throw new Error('Unlock Finance & Profit and try again.')
            }
            const renamed = await saveFinanceDriver(token, { id: driver.id, name })
            rememberDriver(renamed)
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
          title={pendingRemove.kind === 'income' || pendingRemove.kind === 'expense' ? 'Remove this entry?' : 'Clear this day for the driver?'}
          onClose={() => setPendingRemove(null)}
        >
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {pendingRemove.kind === 'income' || pendingRemove.kind === 'expense'
              ? 'Remove this entry from the day? Save day to keep this change.'
              : `Clear ${pendingRemove.row.driverName || 'this driver'} on ${formatIsoHeading(selectedDate)}? The saved driver stays in the list and this row returns to Not set. Other dates stay as they are. Save day to keep this change.`}
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

      {pendingAttendance ? (
        <DialogShell title="Mark this driver as Did not work?" onClose={() => setPendingAttendance(null)}>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Clear the income and expenses for {pendingAttendance.row.driverName || 'this driver'} on {formatIsoHeading(selectedDate)} and mark Did not work? Other dates are not changed. Save day to keep this change.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={quietButton} onClick={() => setPendingAttendance(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                applyAttendance(pendingAttendance.row, 'absent')
                setPendingAttendance(null)
              }}
            >
              Clear and mark Did not work
            </button>
          </div>
        </DialogShell>
      ) : null}

      {pendingArchive ? (
        <DialogShell
          title={pendingArchive.archived ? 'Delete driver?' : 'Restore this driver?'}
          onClose={() => !archiving && setPendingArchive(null)}
          busy={archiving}
          stacked
        >
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {pendingArchive.archived
              ? 'Remove this driver from the active list? All previous attendance and financial records will be kept.'
              : `Restore ${pendingArchive.driver.name} to the saved driver list? Past figures stay as they are.`}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={quietButton} disabled={archiving} onClick={() => setPendingArchive(null)}>
              Cancel
            </button>
            <button type="button" className={primaryButton} disabled={archiving} onClick={() => void confirmArchive()}>
              {archiving ? 'Saving…' : pendingArchive.archived ? 'Delete driver' : 'Restore'}
            </button>
          </div>
        </DialogShell>
      ) : null}
    </div>
  )
}

function AttendanceControl({ value, driverName, onChange }) {
  const absent = value === 'absent'
  return (
    <label className="flex min-w-0 items-start gap-1 text-[11px] font-medium leading-tight text-slate-700 sm:text-xs">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300"
        checked={absent}
        aria-label={`Did not work for ${driverName || 'this driver'}`}
        onChange={(event) => onChange(event.target.checked ? 'absent' : 'not_set')}
      />
      <span>Did not work</span>
    </label>
  )
}

