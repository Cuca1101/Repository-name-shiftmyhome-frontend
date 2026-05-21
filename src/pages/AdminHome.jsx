import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LEAD_STATUSES } from '../constants/leadStatus'
import { fetchAllJobs, countLegacyQuotes } from '../lib/data/jobsRepository'
import { fetchQuotePaymentStats } from '../lib/data/quotesAdminRepository'
import ProductionDataCleanupModal from '../components/admin/ProductionDataCleanupModal'
import { showDemoAdminUi } from '../lib/adminProductionMode'

export default function AdminHome() {
  const [jobs, setJobs] = useState([])
  const [legacyQuotes, setLegacyQuotes] = useState(0)
  const [quoteStats, setQuoteStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cleanupOpen, setCleanupOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, legacy, qStats] = await Promise.all([
        fetchAllJobs(),
        countLegacyQuotes(),
        fetchQuotePaymentStats(),
      ])
      setJobs(list)
      setLegacyQuotes(legacy)
      setQuoteStats(qStats)
    } catch (e) {
      setError(e?.message || 'Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const total = jobs.length
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]))
    for (const j of jobs) {
      if (byStatus[j.status] !== undefined) byStatus[j.status] += 1
    }
    return { total, byStatus }
  }, [jobs])

  return (
    <div className="space-y-8">
      <div className="admin-surface sm:p-6">
        <h2 className="text-base font-bold tracking-tight text-slate-900 xxs:text-lg sm:text-2xl">Overview</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Snapshot of job cards from the live pricing flow. Before go-live, run{' '}
          <strong className="font-semibold text-slate-800">Clear test data</strong> to archive pre-launch
          quotes and journeys.{' '}
          {legacyQuotes > 0 && (
            <span className="text-slate-500">
              Legacy <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">quotes</code> rows:{' '}
              {legacyQuotes}.
            </span>
          )}
        </p>
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
          Loading dashboard…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 xxs:gap-3 xs:gap-3.5 sm:gap-4 lg:grid-cols-4">
            <div className="admin-surface">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total job cards</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 xxs:mt-1.5 xxs:text-2xl sm:mt-2 sm:text-3xl">{stats.total}</p>
            </div>
            <div className="admin-surface">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-brand-600">{stats.byStatus.New ?? 0}</p>
            </div>
            <div className="admin-surface">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booked</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">{stats.byStatus.Booked ?? 0}</p>
            </div>
            <div className="admin-surface">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-800">{stats.byStatus.Completed ?? 0}</p>
            </div>
          </div>

          {quoteStats && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Available Jobs &amp; payments</h3>
              <p className="mt-1 text-sm text-slate-600">
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">quotes</code> table — wizard &
                online card payments.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 xxs:gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-5 lg:gap-6">
                <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total leads</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{quoteStats.total}</dd>
                </div>
                <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{quoteStats.unpaid}</dd>
                </div>
                <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposit paid</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{quoteStats.deposit_paid}</dd>
                </div>
                <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid (full)</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-brand-700">{quoteStats.paid}</dd>
                </div>
                <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booked</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{quoteStats.booked}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Quick actions</h3>
            <ul className="mt-5 flex flex-wrap gap-3">
              <li>
                <Link
                  to="/admin/available-jobs"
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700"
                >
                  Available Jobs
                </Link>
              </li>
              {showDemoAdminUi() ? (
                <li>
                  <Link
                    to="/admin/jobs"
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Job cards (legacy)
                  </Link>
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  onClick={() => setCleanupOpen(true)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-900 shadow-sm transition hover:bg-red-100"
                >
                  Clear test data for go-live…
                </button>
              </li>
              <li>
                <Link
                  to="/admin/pricing"
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Pricing engine
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/items"
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Items library
                </Link>
              </li>
            </ul>
          </div>
        </>
      )}
      <ProductionDataCleanupModal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        onDone={load}
      />
    </div>
  )
}
