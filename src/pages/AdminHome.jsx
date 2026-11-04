import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminInsightsDashboard from '../components/admin/AdminInsightsDashboard'
import GoLiveCleanupGate from '../components/admin/GoLiveCleanupGate'
import { buildAdminInsights } from '../lib/adminInsightsModel'
import { filterProductionAdminQuotes } from '../lib/adminProductionFilters'
import { ukCalendarYmd } from '../lib/formatDateDisplay'
import { showDemoAdminUi } from '../lib/adminProductionMode'
import { fetchQuotesForAdminAnalytics } from '../lib/data/adminAnalyticsRepository'
import { fetchInsightsSignals } from '../lib/data/adminInsightsRepository'

export default function AdminHome() {
  const [quotes, setQuotes] = useState([])
  const [events, setEvents] = useState([])
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cleanupOpen, setCleanupOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = filterProductionAdminQuotes(await fetchQuotesForAdminAnalytics())
      const cutoff = ukCalendarYmd(new Date(Date.now() - 45 * 86400000))
      const recentIds = list
        .filter((quote) => {
          const status = String(quote.payment_status || '')
          if (status !== 'paid' && status !== 'deposit_paid') return false
          const move = String(quote.move_date || '').slice(0, 10)
          const paid = quote.paid_at ? ukCalendarYmd(new Date(quote.paid_at)) : ''
          return (move && move >= cutoff) || (paid && paid >= cutoff)
        })
        .slice(0, 300)
        .map((quote) => String(quote.id))
      const signals = await fetchInsightsSignals(recentIds)
      setQuotes(list)
      setEvents(signals.events)
      setFeedback(signals.feedback)
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load the dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const model = useMemo(
    () => buildAdminInsights(quotes, events, feedback),
    [quotes, events, feedback],
  )

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden />
          Loading dashboard…
        </div>
      ) : (
        <AdminInsightsDashboard model={model} />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            <Link to="/admin/new-phone-booking" className="inline-flex min-h-[40px] items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              New phone booking
            </Link>
          </li>
          <li>
            <Link to="/admin/available-jobs" className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Available Jobs
            </Link>
          </li>
          <li>
            <Link to="/admin/analytics" className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Analytics
            </Link>
          </li>
          {showDemoAdminUi() ? (
            <li>
              <Link to="/admin/jobs" className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Job cards
              </Link>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={() => setCleanupOpen(true)}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
            >
              Clear test data
            </button>
          </li>
        </ul>
      </div>

      <GoLiveCleanupGate open={cleanupOpen} onClose={() => setCleanupOpen(false)} onDone={load} />
    </div>
  )
}
