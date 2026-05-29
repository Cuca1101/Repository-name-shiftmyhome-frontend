import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import { filterQuotesForProductionInbox } from '../lib/demoTestRecordDetection'
import { fetchHomePageQuoteRequests } from '../lib/data/quotesAdminRepository'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'

export default function HomePageQuoteRequestsAdmin() {
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setActiveSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchHomePageQuoteRequests(activeSearch)
      setRows(filterQuotesForProductionInbox(list))
    } catch (e) {
      setError(e?.message || 'Failed to load quote requests.')
    } finally {
      setLoading(false)
    }
  }, [activeSearch])

  useEffect(() => {
    load()
  }, [load])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  async function copyQuoteRef(text, key) {
    const t = String(text ?? '').trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      window.prompt('Copy quote ref:', t)
    }
  }

  function leadDetailHref(q) {
    return `/admin/quote-requests/${q.id}`
  }

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    return activeSearch ? 'No quote requests found.' : 'No quote requests yet.'
  }, [loading, rows.length, activeSearch])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quote requests</h2>
          <p className="mt-1 text-sm text-slate-600">
            Public enquiries and phone bookings not yet paid — sources{' '}
            <code className="rounded bg-slate-100 px-1">home_page_quote_form</code>,{' '}
            <code className="rounded bg-slate-100 px-1">admin_phone_booking</code>, etc.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/new-phone-booking"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            + New phone booking
          </Link>
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

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading…</p>
        ) : emptyMessage ? (
          <p className="p-8 text-center text-slate-600">{emptyMessage}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Quote ref</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="min-w-[140px] px-4 py-3">Pickup</th>
                    <th className="min-w-[140px] px-4 py-3">Delivery</th>
                    <th className="px-4 py-3">Move date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((q) => {
                    const ref = q.quote_ref ? String(q.quote_ref) : ''
                    const copyKey = `${q.id}-ref`
                    return (
                      <tr key={q.id} className="align-top text-slate-800">
                        <td className="px-4 py-3">
                          {ref ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={leadDetailHref(q)}
                                title="Open lead detail"
                                className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                              >
                                {ref}
                              </Link>
                              <button
                                type="button"
                                onClick={() => copyQuoteRef(ref, copyKey)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {copiedKey === copyKey ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{q.full_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{q.phone}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={q.email}>
                          {q.email}
                        </td>
                        <td className="max-w-[160px] px-4 py-3 text-slate-700">{q.service ?? '—'}</td>
                        <td className="max-w-[180px] px-4 py-3 text-xs leading-snug text-slate-700">
                          {q.pickup_address}
                        </td>
                        <td className="max-w-[180px] px-4 py-3 text-xs leading-snug text-slate-700">
                          {q.delivery_address}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateUK(q.move_date)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900">
                            {q.status ?? '—'}
                          </span>
                        </td>
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
                const ref = q.quote_ref ? String(q.quote_ref) : ''
                const copyKey = `${q.id}-m-ref`
                return (
                  <li key={q.id} className="min-w-0 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        {ref ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={leadDetailHref(q)}
                              className="font-mono text-sm font-bold text-brand-700 hover:underline"
                            >
                              {ref}
                            </Link>
                            <button
                              type="button"
                              onClick={() => copyQuoteRef(ref, copyKey)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {copiedKey === copyKey ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        ) : (
                          <p className="font-mono text-sm font-bold text-slate-400">—</p>
                        )}
                        <p className="font-semibold text-slate-900">{q.full_name}</p>
                        <p className="text-xs text-slate-600">{q.email}</p>
                      </div>
                      <Link
                        to={leadDetailHref(q)}
                        className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                      >
                        View lead
                      </Link>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Phone</dt>
                        <dd>{q.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Service</dt>
                        <dd>{q.service ?? '—'}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">Pickup</dt>
                        <dd className="text-xs">{q.pickup_address}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">Delivery</dt>
                        <dd className="text-xs">{q.delivery_address}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Move date</dt>
                        <dd>{formatDateUK(q.move_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Status</dt>
                        <dd>{q.status ?? '—'}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-slate-400">Created {formatDateTimeUK(q.created_at)}</p>
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
