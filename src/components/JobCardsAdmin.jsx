import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import { fetchJobsForAdmin } from '../lib/data/jobsRepository'
import { fetchQuotesByQuoteRefs } from '../lib/data/quotesAdminRepository'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { LEAD_STATUSES } from '../constants/leadStatus'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/** @param {Record<string, unknown>} job */
function quoteRefFromJob(job) {
  const pi = job?.price_inputs
  if (pi && typeof pi === 'object' && pi.quoteRef != null) return String(pi.quoteRef).trim()
  return ''
}

function shortPaymentRef(id) {
  if (!id) return '—'
  const s = String(id)
  return s.length > 22 ? `${s.slice(0, 18)}…` : s
}

/**
 * @param {{
 *   title: string
 *   description: string
 *   statusFilter: string | null
 *   emptyWithoutSearch: string
 *   showStatusFooter?: boolean
 * }} props
 */
export function AdminJobsPage({
  title,
  description,
  statusFilter = null,
  emptyWithoutSearch,
  showStatusFooter = true,
}) {
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [quoteByRef, setQuoteByRef] = useState(() => ({}))
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
      const list = await fetchJobsForAdmin(activeSearch, statusFilter)
      setJobs(list)
      const refs = list.map((j) => quoteRefFromJob(j)).filter(Boolean)
      const map = await fetchQuotesByQuoteRefs(refs)
      setQuoteByRef(map)
    } catch (e) {
      setError(e?.message || 'Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }, [activeSearch, statusFilter])

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

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (jobs.length > 0) return ''
    return activeSearch ? 'No jobs found.' : emptyWithoutSearch
  }, [loading, jobs.length, activeSearch, emptyWithoutSearch])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
        >
          Refresh
        </button>
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
        ) : jobs.length === 0 ? (
          <p className="p-8 text-center text-slate-600">{emptyMessage}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Job ref</th>
                    <th className="px-4 py-3">Quote ref</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Move date</th>
                    <th className="px-4 py-3">Volume m³</th>
                    <th className="px-4 py-3">Estimate</th>
                    <th className="px-4 py-3">Payment status</th>
                    <th className="px-4 py-3">Pay type</th>
                    <th className="px-4 py-3">Amount paid</th>
                    <th className="px-4 py-3">Paid at</th>
                    <th className="px-4 py-3">Payment ref</th>
                    <th className="px-4 py-3">Quote status</th>
                    <th className="px-4 py-3">Job status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((j) => {
                    const qRef = quoteRefFromJob(j)
                    const lq = qRef ? quoteByRef[qRef] : undefined
                    const copyKey = `${j.id}-ref`
                    return (
                      <tr key={j.id} className="align-top text-slate-800">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-800">
                          {j.job_reference}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-900">
                          {qRef ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/admin/jobs/${j.id}`}
                                title="Open job details"
                                className="font-semibold text-brand-700 hover:underline"
                              >
                                {qRef}
                              </Link>
                              <button
                                type="button"
                                onClick={() => copyQuoteRef(qRef, copyKey)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {copiedKey === copyKey ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{j.full_name}</div>
                          <div className="text-xs text-slate-600">{j.phone}</div>
                        </td>
                        <td className="max-w-[140px] px-4 py-3 text-slate-600">{j.service_type}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDateUK(j.move_date)}</td>
                        <td className="px-4 py-3 tabular-nums">{Number(j.total_cubic_metres).toFixed(2)}</td>
                        <td className="px-4 py-3 tabular-nums font-medium">
                          £{Number(j.estimated_total).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {lq ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-800">
                              {lq.payment_status}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{lq?.payment_type ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums text-xs font-medium">{lq ? money(lq.amount_paid) : '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          {lq?.paid_at ? formatDateTimeUK(lq.paid_at) : '—'}
                        </td>
                        <td className="max-w-[120px] px-4 py-3 font-mono text-[10px] leading-tight text-slate-600 break-all">
                          {shortPaymentRef(lq?.stripe_payment_intent_id || lq?.stripe_session_id)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {lq?.status != null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-900">
                              {lq.status}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {j.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                          {formatDateTimeUK(j.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/jobs/${j.id}`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {jobs.map((j) => {
                const qRef = quoteRefFromJob(j)
                const lq = qRef ? quoteByRef[qRef] : undefined
                const copyKey = `${j.id}-m-ref`
                return (
                  <li key={j.id} className="min-w-0 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-brand-800">{j.job_reference}</p>
                        {qRef ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Quote ref
                            </span>
                            <Link
                              to={`/admin/jobs/${j.id}`}
                              className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                            >
                              {qRef}
                            </Link>
                            <button
                              type="button"
                              onClick={() => copyQuoteRef(qRef, copyKey)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {copiedKey === copyKey ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        ) : null}
                        <p className="mt-1 font-semibold text-slate-900">{j.full_name}</p>
                        <p className="text-xs text-slate-600">{j.phone}</p>
                        <p className="mt-1 text-sm text-slate-600">{j.service_type}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Move: {formatDateUK(j.move_date)} · Vol: {Number(j.total_cubic_metres).toFixed(2)} m³
                        </p>
                      </div>
                      <Link
                        to={`/admin/jobs/${j.id}`}
                        className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                      >
                        Open job
                      </Link>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>
                        <dt className="font-medium text-slate-500">Payment status</dt>
                        <dd>{lq?.payment_status ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Pay type</dt>
                        <dd>{lq?.payment_type ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Amount paid</dt>
                        <dd className="tabular-nums font-medium">{lq ? money(lq.amount_paid) : '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Quote status</dt>
                        <dd>{lq?.status ?? '—'}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold tabular-nums text-slate-900">
                        £{Number(j.estimated_total).toFixed(2)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        Job: {j.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTimeUK(j.created_at)}</p>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {showStatusFooter && (
        <p className="text-xs text-slate-500">Status values: {LEAD_STATUSES.join(', ')}.</p>
      )}
    </div>
  )
}

export default function JobCardsAdmin() {
  return (
    <AdminJobsPage
      title="Job cards"
      description={
        <>
          Quotes submitted from the website with live pricing. Payment columns match the linked{' '}
          <code className="rounded bg-slate-100 px-1">quotes</code> row when the wizard quote ref is stored on the job.
        </>
      }
      statusFilter={null}
      emptyWithoutSearch="No job cards yet."
    />
  )
}
