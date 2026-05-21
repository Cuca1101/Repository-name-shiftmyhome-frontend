import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteJourneyDraft,
  fetchAllJourneysForAdmin,
  fetchJourneyStopsForJourneyIds,
  withdrawJourneyFromMarketplace,
} from '../../lib/data/journeysRepository'
import {
  filterJourneysByTab,
  journeyMatchesSearch,
  JOURNEY_PLANNER_TABS,
  sortJourneys,
} from '../../lib/journeyPlannerDisplay'
import { isSupabaseConfigured } from '../../lib/supabase'
import { filterJourneysForProductionInbox } from '../../lib/demoTestRecordDetection'
import { subscribeAdminDataRefresh } from '../../lib/adminDataRefresh'
import { fetchDriverNamesByIds } from '../../lib/journeyFleetDrivers'
import JourneyListCard from './JourneyListCard'

/**
 * @param {{ refreshKey?: number, compact?: boolean }} props
 */
export default function JourneyPlannerList({ refreshKey = 0, compact = false }) {
  const [tab, setTab] = useState('all')
  const [sortKey, setSortKey] = useState('newest')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [stopMetaByJourney, setStopMetaByJourney] = useState(
    /** @type {Record<string, { jobRefs: string[] }>} */ ({}),
  )
  const [driverNameByJourney, setDriverNameByJourney] = useState(/** @type {Record<string, string>} */ ({}))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([])
      setStopMetaByJourney({})
      setError('Connect Supabase to list journeys.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const list = await fetchAllJourneysForAdmin(300)
      setRows(filterJourneysForProductionInbox(list))
      const ids = list.map((j) => String(j.id || '')).filter(Boolean)
      if (ids.length > 0) {
        const stops = await fetchJourneyStopsForJourneyIds(ids)
        /** @type {Record<string, { jobRefs: string[] }>} */
        const meta = {}
        for (const s of stops) {
          const jid = String(s.journey_id || '')
          if (!jid) continue
          if (!meta[jid]) meta[jid] = { jobRefs: [] }
          const ref = s.job_ref != null ? String(s.job_ref).trim() : ''
          if (ref && !meta[jid].jobRefs.includes(ref)) meta[jid].jobRefs.push(ref)
        }
        setStopMetaByJourney(meta)
      } else {
        setStopMetaByJourney({})
      }
      const driverIds = list
        .map((j) => (j.assigned_driver_id != null ? String(j.assigned_driver_id) : ''))
        .filter(Boolean)
      const nameByDriverId = await fetchDriverNamesByIds(driverIds)
      /** @type {Record<string, string>} */
      const byJourney = {}
      for (const j of list) {
        const jid = String(j.id || '')
        const did = j.assigned_driver_id != null ? String(j.assigned_driver_id) : ''
        if (jid && did && nameByDriverId[did]) byJourney[jid] = nameByDriverId[did]
      }
      setDriverNameByJourney(byJourney)
    } catch (e) {
      setError(e?.message || 'Failed to load journeys.')
      setRows([])
      setStopMetaByJourney({})
      setDriverNameByJourney({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => subscribeAdminDataRefresh(load), [load])

  const filtered = useMemo(() => {
    const byTab = filterJourneysByTab(rows, tab)
    const q = search.trim()
    const searched = q
      ? byTab.filter((j) => {
          const id = String(j.id || '')
          return journeyMatchesSearch(j, stopMetaByJourney[id] || {}, q)
        })
      : byTab
    return sortJourneys(searched, sortKey)
  }, [rows, tab, search, sortKey, stopMetaByJourney])

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
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
      <div className={`border-b border-slate-100 ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`font-bold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
              {compact ? 'Saved journeys' : 'Journey planner'}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {compact
                ? 'Open a journey for the operational view, or edit stops and payout.'
                : 'Multi-stop logistics journeys — draft, marketplace, active, and completed.'}
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Journey ref or job ref…"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="mt-1 block w-full min-w-[10rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
            >
              <option value="newest">Newest updated</option>
              <option value="created">Created date</option>
              <option value="marketplace">Marketplace status</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {JOURNEY_PLANNER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === t.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
              aria-hidden
            />
            Loading journeys…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <p className="text-base font-semibold text-slate-800">No journeys created yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {search.trim() || tab !== 'all'
                ? 'No journeys match your filters. Try another tab or clear search.'
                : 'Bundle jobs from Available Jobs into a multi-stop journey.'}
            </p>
            {!search.trim() && tab === 'all' ? (
              <Link
                to="/admin/available-jobs"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-500"
              >
                Create journey from Available Jobs
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((j) => {
              const id = String(j.id || '')
              const listed = String(j.marketplace_visibility || '') === 'visible_in_marketplace'
              const busy = busyId === id
              return (
                <li key={id || String(j.journey_ref)}>
                  <JourneyListCard
                    journey={j}
                    driverLabel={driverNameByJourney[id] || ''}
                    busy={busy}
                    onWithdraw={listed ? () => onWithdraw(id) : undefined}
                    onDeleteDraft={!listed ? () => onDeleteDraft(id) : undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}

        {!compact && !loading && filtered.length > 0 ? (
          <p className="mt-6 text-xs text-slate-500">
            Showing {filtered.length} journey{filtered.length === 1 ? '' : 's'}. Pick jobs on{' '}
            <Link to="/admin/available-jobs" className="font-semibold text-brand-700 hover:underline">
              Available Jobs
            </Link>{' '}
            and use <strong>Add to Journey</strong>.
          </p>
        ) : null}
      </div>
    </section>
  )
}
