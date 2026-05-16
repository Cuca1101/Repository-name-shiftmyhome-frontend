import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { quotePassesAvailableJobsStrict } from '../lib/adminJobListRules'
import { compareAvailableJobsAdmin } from '../lib/adminJobWarningBadges'
import JobCard from './admin-workflow/JobCard'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'paid', label: 'Paid (full)' },
  { key: 'booked', label: 'Booked' },
]

export default function AvailableJobsAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const extendJourneyId = (searchParams.get('extendJourney') || '').trim()
  const [filterKey, setFilterKey] = useState('all')
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
      filtered.sort(compareAvailableJobsAdmin)
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

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    return activeSearch ? 'No jobs found.' : 'No Available Jobs yet.'
  }, [loading, rows.length, activeSearch])

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
    const quoteIds = rows.filter((q) => selectedIds.has(String(q.id))).map((q) => String(q.id))
    if (quoteIds.length === 0) return
    if (extendJourneyId) {
      const add = quoteIds.map((id) => encodeURIComponent(id)).join(',')
      navigate(`/admin/journey-planner?journey=${encodeURIComponent(extendJourneyId)}&add=${add}`)
      return
    }
    navigate('/admin/journey-planner', { state: { quoteIds } })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Available Jobs</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Card overview of quote-backed jobs. Open a job for structured details, marketplace controls, and payment
            history.
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
            className="min-h-[48px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-0 sm:px-4 sm:py-2"
          >
            Add to Journey{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button
            type="button"
            onClick={load}
            className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
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

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterKey(f.key)}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filterKey === f.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
            aria-hidden
          />
          Loading…
        </div>
      ) : emptyMessage ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((q) => (
            <JobCard
              key={String(q.id)}
              q={q}
              listVariant="available"
              showQuickActions
              selectionCheckbox={
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.has(String(q.id))}
                    onChange={() => toggleSelected(q.id)}
                  />
                  Select for journey
                </label>
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
