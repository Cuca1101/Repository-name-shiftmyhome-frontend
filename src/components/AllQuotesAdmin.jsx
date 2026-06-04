import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import {
  ADMIN_JOB_PLACEMENT_META,
  adminQuoteDetailHref,
  getAdminJobInboxPlacement,
} from '../lib/adminJobInboxPlacement'
import { quoteVisibleInAdminLists } from '../lib/adminProductionFilters'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { subscribeAdminDataRefresh } from '../lib/adminDataRefresh'

const PAYMENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'paid', label: 'Fully paid' },
]

/** @param {string} ps */
function paymentBadgeClass(ps) {
  const s = String(ps || '').trim().toLowerCase()
  if (s === 'paid') return 'bg-brand-50 text-brand-900 ring-brand-200/80'
  if (s === 'deposit_paid') return 'bg-emerald-50 text-emerald-900 ring-emerald-200/80'
  if (s === 'unpaid') return 'bg-slate-100 text-slate-800 ring-slate-200/80'
  return 'bg-slate-100 text-slate-700 ring-slate-200/80'
}

/** @param {string} tone */
function placementBadgeClass(tone) {
  const map = {
    blue: 'bg-blue-50 text-blue-900 ring-blue-200/80',
    sky: 'bg-sky-50 text-sky-900 ring-sky-200/80',
    violet: 'bg-violet-50 text-violet-900 ring-violet-200/80',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80',
    indigo: 'bg-indigo-50 text-indigo-900 ring-indigo-200/80',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200/80',
    red: 'bg-red-50 text-red-900 ring-red-200/80',
    slate: 'bg-slate-100 text-slate-800 ring-slate-200/80',
  }
  return map[tone] || map.slate
}

export default function AllQuotesAdmin() {
  const [filterKey, setFilterKey] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [rows, setRows] = useState([])
  const [hiddenCount, setHiddenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchQuotesForAdmin(filterKey, activeSearch)
      const safe = Array.isArray(list) ? list : []
      setHiddenCount(safe.filter((q) => !quoteVisibleInAdminLists(q)).length)
      setRows(safe.filter((q) => quoteVisibleInAdminLists(q)))
    } catch (e) {
      setError(e?.message || 'Failed to load quotes.')
      setRows([])
      setHiddenCount(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, activeSearch])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => subscribeAdminDataRefresh(load), [load])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    return activeSearch ? 'No quotes match your search.' : 'No quotes in this filter.'
  }, [loading, rows.length, activeSearch])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">All quotes</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Every booking you created — phone bookings, website wizard, and paid jobs. Use the{' '}
          <strong className="font-semibold text-slate-800">Where</strong> column to open the right admin screen.
          Operational lists:{' '}
          <Link to="/admin/available-jobs" className="font-semibold text-brand-700 hover:underline">
            Available Jobs
          </Link>
          ,{' '}
          <Link to="/admin/quote-requests" className="font-semibold text-brand-700 hover:underline">
            Quote Requests
          </Link>{' '}
          (unpaid phone / contact form only).
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterKey(f.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
              filterKey === f.key
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AdminRecordsSearchRow
        searchInput={searchInput}
        onSearchInputChange={(e) => setSearchInput(e.target.value)}
        onSearchSubmit={runSearchNow}
        placeholder="Quote ref, name, phone, email, addresses…"
      />

      {hiddenCount > 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {hiddenCount} test / archived quote{hiddenCount === 1 ? '' : 's'} hidden from this list (go-live cleanup).
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading…</p>
        ) : emptyMessage ? (
          <p className="p-8 text-center text-slate-600">{emptyMessage}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Quote ref</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Where in admin</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Move date</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((q) => {
                    const ref = q.quote_ref ? String(q.quote_ref) : '—'
                    const placement = getAdminJobInboxPlacement(q)
                    const meta = ADMIN_JOB_PLACEMENT_META[placement] || ADMIN_JOB_PLACEMENT_META.unpaid
                    const href = adminQuoteDetailHref(q)
                    const src = String(q.source || '').trim() || 'website wizard'
                    return (
                      <tr key={String(q.id)} className="align-top text-slate-800">
                        <td className="px-4 py-3">
                          <Link to={href} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                            {ref}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{q.full_name || '—'}</p>
                          <p className="text-xs text-slate-500">{q.phone || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${paymentBadgeClass(
                              String(q.payment_status || 'unpaid'),
                            )}`}
                          >
                            {String(q.payment_status || 'unpaid').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${placementBadgeClass(
                              meta.tone,
                            )}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-600" title={src}>
                          {src}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateUK(q.move_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                          {formatDateTimeUK(q.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((q) => {
                const ref = q.quote_ref ? String(q.quote_ref) : '—'
                const placement = getAdminJobInboxPlacement(q)
                const meta = ADMIN_JOB_PLACEMENT_META[placement] || ADMIN_JOB_PLACEMENT_META.unpaid
                const href = adminQuoteDetailHref(q)
                return (
                  <li key={String(q.id)} className="p-4">
                    <Link to={href} className="font-mono text-sm font-bold text-brand-700 hover:underline">
                      {ref}
                    </Link>
                    <p className="mt-1 font-semibold text-slate-900">{q.full_name || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${paymentBadgeClass(
                          String(q.payment_status || 'unpaid'),
                        )}`}
                      >
                        {String(q.payment_status || 'unpaid').replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${placementBadgeClass(
                          meta.tone,
                        )}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTimeUK(q.created_at)}</p>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
