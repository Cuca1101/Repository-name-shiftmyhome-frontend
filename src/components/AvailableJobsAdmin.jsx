import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { quotePassesAvailableJobsStrict } from '../lib/adminJobListRules'
import JobCard from './admin-workflow/JobCard'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'

const FILTERS = [
  { key: 'all_paid', label: 'All paid' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'paid', label: 'Fully paid' },
]

const SORT_OPTIONS = [
  { key: 'paid_newest', label: 'Newest paid first' },
  { key: 'paid_oldest', label: 'Oldest paid first' },
  { key: 'move_soonest', label: 'Move date soonest' },
  { key: 'move_latest', label: 'Move date latest' },
]

/** @param {Record<string, unknown>} q */
function paidAtMs(q) {
  const t = q.paid_at ? new Date(String(q.paid_at)).getTime() : 0
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** @param {Record<string, unknown>} q */
function createdAtMs(q) {
  const t = q.created_at ? new Date(String(q.created_at)).getTime() : 0
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** @param {Record<string, unknown>} q */
function bookingSortMs(q) {
  return paidAtMs(q) || createdAtMs(q)
}

/** @param {Record<string, unknown>} q */
function moveDateMs(q) {
  if (q.move_date == null || q.move_date === '') return 0
  const t = new Date(String(q.move_date)).getTime()
  return Number.isFinite(t) && t > 0 ? t : 0
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {string} sortKey
 */
function compareAvailableJobsSort(a, b, sortKey) {
  switch (sortKey) {
    case 'paid_oldest':
      return bookingSortMs(a) - bookingSortMs(b)
    case 'move_soonest': {
      const ma = moveDateMs(a)
      const mb = moveDateMs(b)
      if (ma && mb) return ma - mb
      if (ma) return -1
      if (mb) return 1
      return bookingSortMs(b) - bookingSortMs(a)
    }
    case 'move_latest': {
      const ma = moveDateMs(a)
      const mb = moveDateMs(b)
      if (ma && mb) return mb - ma
      if (ma) return -1
      if (mb) return 1
      return bookingSortMs(b) - bookingSortMs(a)
    }
    case 'paid_newest':
    default:
      return bookingSortMs(b) - bookingSortMs(a)
  }
}

export default function AvailableJobsAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const extendJourneyId = (searchParams.get('extendJourney') || '').trim()
  const [filterKey, setFilterKey] = useState('all_paid')
  const [sortKey, setSortKey] = useState('paid_newest')
  const [viewMode, setViewMode] = useState('grid')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchQuotesForAdmin(filterKey, activeSearch)
      const filtered = list.filter(quotePassesAvailableJobsStrict)
      setRows(filtered)
      setSelectedIds((prev) => new Set([...prev].filter((id) => filtered.some((r) => String(r.id) === id))))
    } catch (e) {
      setError(e?.message || 'Failed to load quotes.')
    } finally {
      setLoading(false)
    }
  }, [filterKey, activeSearch])

  useEffect(() => {
    load()
  }, [load])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => compareAvailableJobsSort(a, b, sortKey))
    return copy
  }, [rows, sortKey])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (sortedRows.length > 0) return ''
    return activeSearch ? 'No jobs found.' : 'No Available Jobs yet.'
  }, [loading, sortedRows.length, activeSearch])

  function toggleSelected(id) {
    const sid = String(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  function addToJourney() {
    if (selectedIds.size === 0) return
    const quoteIds = sortedRows.filter((q) => selectedIds.has(String(q.id))).map((q) => String(q.id))
    if (quoteIds.length === 0) return
    if (extendJourneyId) {
      const add = quoteIds.map((id) => encodeURIComponent(id)).join(',')
      navigate(`/admin/journey-planner?journey=${encodeURIComponent(extendJourneyId)}&add=${add}`)
      return
    }
    navigate('/admin/journey-planner', { state: { quoteIds } })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Available Jobs</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Only card-paid bookings waiting for assignment appear here. Open a job for marketplace controls,
            assignment, and payment history. Unpaid leads stay in Website Leads / Quote Funnel.
            {extendJourneyId ? (
              <span className="mt-2 block font-semibold text-indigo-800">
                Adding to saved journey — selections merge into that journey when you open the planner.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={addToJourney}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add to Journey{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <AdminRecordsSearchRow
        searchInput={searchInput}
        onSearchInputChange={(e) => setSearchInput(e.target.value)}
        onSearchSubmit={runSearchNow}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filterKey === f.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="sr-only">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={viewMode === 'grid'}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
            aria-hidden
          />
          Loading…
        </div>
      ) : emptyMessage ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul
          className={
            viewMode === 'list'
              ? 'flex flex-col gap-2'
              : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }
        >
          {sortedRows.map((q) => (
            <JobCard
              key={String(q.id)}
              q={q}
              listVariant="available"
              layoutMode={viewMode}
              showQuickActions
              onDemoCancelled={load}
              selectionCheckbox={
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.has(String(q.id))}
                    onChange={() => toggleSelected(q.id)}
                  />
                  Journey
                </label>
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
