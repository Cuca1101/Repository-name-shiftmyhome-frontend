import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteJourneyDraft,
  fetchAllJourneysForAdmin,
  withdrawJourneyFromMarketplace,
} from '../lib/data/journeysRepository'
import { effectivePlatformReductionPctOfCustomer } from '../lib/journeyFinance'
import { formatJourneyDurationHhMm } from '../lib/journeyPlannerModel'
import { isSupabaseConfigured } from '../lib/supabase'

const TABS = [
  { key: 'draft', label: 'Draft journeys' },
  { key: 'marketplace', label: 'Marketplace journeys' },
]

function money(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `£${x.toFixed(2)}`
}

/**
 * @param {Record<string, unknown>} j
 */
function isListedOnMarketplace(j) {
  return String(j.marketplace_visibility || '') === 'visible_in_marketplace'
}

/**
 * @param {{ refreshKey?: number, embed?: boolean }} props
 */
export default function JourneyPlannerSavedList({ refreshKey = 0, embed = false }) {
  const [tab, setTab] = useState('draft')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([])
      setError('Connect Supabase to list saved journeys.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const list = await fetchAllJourneysForAdmin(300)
      setRows(list)
    } catch (e) {
      setError(e?.message || 'Failed to load journeys.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const filtered = useMemo(() => {
    if (tab === 'marketplace') return rows.filter((j) => isListedOnMarketplace(j))
    return rows.filter((j) => !isListedOnMarketplace(j))
  }, [rows, tab])

  async function runBusy(id, fn) {
    const sid = String(id)
    setBusyId(sid)
    try {
      await fn()
      await load()
    } catch (e) {
      window.alert(e?.message || 'Action failed.')
    } finally {
      setBusyId('')
    }
  }

  function onWithdraw(id) {
    if (!window.confirm('Withdraw this journey from the marketplace and unbundle its jobs?')) return
    void runBusy(id, () => withdrawJourneyFromMarketplace(String(id)))
  }

  function onDeleteDraft(id) {
    if (!window.confirm('Delete this draft journey permanently? Bundled quotes will be released.')) return
    void runBusy(id, () => deleteJourneyDraft(String(id)))
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${embed ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`font-bold text-slate-900 ${embed ? 'text-base' : 'text-lg'}`}>Saved journeys</h3>
          <p className="mt-1 text-sm text-slate-600">
            Draft (not listed) and journeys currently on the marketplace. Open to edit stops, adjust partner payout,
            or send bundles as one card.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
            aria-hidden
          />
          Loading journeys…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">No journeys in this tab yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((j) => {
            const id = String(j.id || '')
            const ref = j.journey_ref != null ? String(j.journey_ref) : id.slice(0, 8)
            const title =
              (j.summary_title != null && String(j.summary_title).trim()) ||
              (j.title != null && String(j.title).trim()) ||
              'Journey'
            const jobs = j.jobs_count != null && Number.isFinite(Number(j.jobs_count)) ? Number(j.jobs_count) : 0
            const miles =
              j.total_miles != null && Number.isFinite(Number(j.total_miles)) ? `${Number(j.total_miles).toFixed(1)} mi` : '—'
            const durSec =
              j.total_duration_seconds != null && Number.isFinite(Number(j.total_duration_seconds))
                ? Math.round(Number(j.total_duration_seconds))
                : null
            const durLabel = durSec != null && durSec > 0 ? formatJourneyDurationHhMm(durSec) : '—'
            const cust =
              j.admin_customer_total_gbp != null && Number.isFinite(Number(j.admin_customer_total_gbp))
                ? Number(j.admin_customer_total_gbp)
                : null
            const payout =
              j.marketplace_payout_price != null && Number.isFinite(Number(j.marketplace_payout_price))
                ? Number(j.marketplace_payout_price)
                : null
            const redPct = effectivePlatformReductionPctOfCustomer(cust, payout)
            const listed = isListedOnMarketplace(j)
            const st = String(j.marketplace_visibility || j.status || '')
            const busy = busyId === id

            return (
              <li
                key={id || ref}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-4 shadow-sm ring-1 ring-slate-900/[0.03]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{ref}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          listed ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {listed ? 'Marketplace' : 'Draft / hidden'}
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-slate-500">{st}</span>
                    </div>
                    <p className="font-semibold text-slate-800">{title}</p>
                    <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className="font-semibold text-slate-500">Jobs</dt>
                        <dd className="font-medium text-slate-900">{jobs}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Miles</dt>
                        <dd className="font-medium text-slate-900">{miles}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Duration</dt>
                        <dd className="font-medium text-slate-900">{durLabel}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Customer total (admin)</dt>
                        <dd className="font-medium text-slate-900">{money(cust)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Platform reduction</dt>
                        <dd className="font-medium text-slate-900">
                          {redPct != null ? `${redPct.toFixed(1)}%` : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Journey payout</dt>
                        <dd className="font-medium text-emerald-800">{money(payout)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <Link
                      to={`/admin/journey-planner?journey=${encodeURIComponent(id)}`}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800"
                    >
                      Open / Edit
                    </Link>
                    {!listed ? (
                      <Link
                        to={`/admin/journey-planner?journey=${encodeURIComponent(id)}`}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-500"
                      >
                        Send to marketplace
                      </Link>
                    ) : null}
                    {listed ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onWithdraw(id)}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Withdraw'}
                      </button>
                    ) : null}
                    {!listed ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeleteDraft(id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-900 hover:bg-red-100 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Delete draft'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!embed ? (
        <p className="mt-4 text-xs text-slate-500">
          To build a new journey, pick jobs on{' '}
          <Link to="/admin/available-jobs" className="font-semibold text-brand-700 hover:underline">
            Available Jobs
          </Link>{' '}
          and use <strong>Add to Journey</strong>.
        </p>
      ) : null}
    </section>
  )
}
