import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link, useNavigate, useParams } from 'react-router-dom'

import { fetchQuotesByIds, fetchQuotesByQuoteRefsFull } from '../../lib/data/quotesAdminRepository'

import {

  deleteJourneyDraft,

  fetchJourneyWithStops,

  withdrawJourneyFromMarketplace,

} from '../../lib/data/journeysRepository'

import { formatJourneyDurationHhMm } from '../../lib/journeyPlannerModel'

import { JOURNEY_VAN_CAPACITY_M3 } from '../../lib/journeySummary'

import {

  formatJourneyMoney,

  journeyFinanceFromRow,

  journeyAssignedDriverLabel,

  maxCrewFromQuotes,

} from '../../lib/journeyPlannerDisplay'

import { isSupabaseConfigured } from '../../lib/supabase'

import JourneyRouteOverview from './JourneyRouteOverview'

import JourneyStopTimeline from './JourneyStopTimeline'

import JourneyPlannerHelpPanel from './JourneyPlannerHelpPanel'

import JourneyOperationalGuidance from './JourneyOperationalGuidance'

import JourneyDispatchStatusBadge from './JourneyDispatchStatusBadge'

import JourneyViewActionBar from './JourneyViewActionBar'
import JourneyRemoveJobModal from './JourneyRemoveJobModal'
import JourneyEmptyState from './JourneyEmptyState'
import { executeRemoveJobFromJourney } from '../../lib/journeyRemoveJob'



/**

 * @param {Record<string, unknown>} row

 * @returns {import('../../lib/journeyPlannerModel.js').JourneyStop}

 */

function dbStopToModel(row) {

  const kind = row.stop_kind === 'delivery' ? 'delivery' : 'pickup'

  const quoteId = row.quote_id != null ? String(row.quote_id) : ''

  return {

    id: String(row.id),

    quoteId,

    kind,

    jobRef: String(row.job_ref || ''),

    address: String(row.address || ''),

    timeWindow: row.time_window != null ? String(row.time_window) : '—',

    customerName: row.customer_name != null ? String(row.customer_name) : '—',

    serviceMinutes: Math.round(Number(row.service_minutes) || 0),

    volumeCrew: row.volume_crew != null ? String(row.volume_crew) : '',

    notes: row.notes != null ? String(row.notes) : '',

    lng: row.lng != null && Number.isFinite(Number(row.lng)) ? Number(row.lng) : null,

    lat: row.lat != null && Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,

  }

}



export default function JourneyViewPage() {

  const { journeyId: journeyIdParam } = useParams()

  const journeyId = String(journeyIdParam || '').trim()

  const navigate = useNavigate()



  const [journey, setJourney] = useState(null)

  const [stops, setStops] = useState(/** @type {import('../../lib/journeyPlannerModel.js').JourneyStop[]} */ ([]))

  const [quotes, setQuotes] = useState(/** @type {Record<string, unknown>[]} */ ([]))

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [busy, setBusy] = useState(false)
  const [removingJob, setRemovingJob] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(
    /** @type {{ quoteId: string, jobRef: string, customerName: string } | null} */ (null),
  )
  const [toast, setToast] = useState(/** @type {{ ok: boolean, text: string } | null} */ (null))
  const mapboxToken = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()



  const load = useCallback(async () => {

    if (!journeyId) {

      setError('Missing journey id.')

      setLoading(false)

      return

    }

    if (!isSupabaseConfigured) {

      setError('Supabase is not configured.')

      setLoading(false)

      return

    }

    setLoading(true)

    setError('')

    try {

      const { journey: jRow, stops: dbStops } = await fetchJourneyWithStops(journeyId)

      if (!jRow?.id) {

        setError('Journey not found.')

        setJourney(null)

        setStops([])

        setQuotes([])

        return

      }

      setJourney(jRow)



      const orderedIds = []

      const seen = new Set()

      for (const s of dbStops) {

        const qid = s.quote_id != null ? String(s.quote_id).trim() : ''

        if (qid && !seen.has(qid)) {

          seen.add(qid)

          orderedIds.push(qid)

        }

      }

      let rows = await fetchQuotesByIds(orderedIds)

      if (rows.length === 0 && dbStops.length > 0) {

        const orderedRefs = []

        const seenR = new Set()

        for (const s of dbStops) {

          const r = s.job_ref != null ? String(s.job_ref).trim() : ''

          if (r && !seenR.has(r)) {

            seenR.add(r)

            orderedRefs.push(r)

          }

        }

        rows = await fetchQuotesByQuoteRefsFull(orderedRefs)

      }



      const refToQuoteId = new Map(rows.map((q) => [String(q.quote_ref || '').trim(), String(q.id)]))

      const modelStops = dbStops.map(dbStopToModel).map((s) => {

        const qid = String(s.quoteId || '').trim()

        if (qid) return s

        const fromRef = refToQuoteId.get(String(s.jobRef || '').trim())

        return fromRef ? { ...s, quoteId: fromRef } : s

      })



      setStops(modelStops)

      setQuotes(rows)

    } catch (e) {

      setError(e?.message || 'Failed to load journey.')

    } finally {

      setLoading(false)

    }

  }, [journeyId])



  useEffect(() => {

    void load()

  }, [load])

  useEffect(() => {
    if (!toast) return undefined
    const t = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(t)
  }, [toast])

  const quotesById = useMemo(() => {

    /** @type {Record<string, Record<string, unknown>>} */

    const m = {}

    for (const q of quotes) {

      if (q?.id != null) m[String(q.id)] = q

    }

    return m

  }, [quotes])



  const title = useMemo(() => {

    if (!journey) return 'Journey'

    return (

      (journey.summary_title != null && String(journey.summary_title).trim()) ||

      (journey.title != null && String(journey.title).trim()) ||

      'Journey'

    )

  }, [journey])



  const ref = journey?.journey_ref != null ? String(journey.journey_ref) : journeyId.slice(0, 8)

  const { customerTotal, payout, platformProfit, marginPct } = journey

    ? journeyFinanceFromRow(journey)

    : { customerTotal: null, payout: null, platformProfit: null, marginPct: null }



  const jobsCount =

    journey?.jobs_count != null && Number.isFinite(Number(journey.jobs_count))

      ? Number(journey.jobs_count)

      : new Set(stops.map((s) => s.quoteId).filter(Boolean)).size



  const totalMiles =

    journey?.total_miles != null && Number.isFinite(Number(journey.total_miles))

      ? Number(journey.total_miles)

      : null

  const totalDurSec =

    journey?.total_duration_seconds != null && Number.isFinite(Number(journey.total_duration_seconds))

      ? Math.round(Number(journey.total_duration_seconds))

      : null



  const teamSize = maxCrewFromQuotes(quotes)

  const capacityM3 =

    journey?.max_volume_m3 != null && Number.isFinite(Number(journey.max_volume_m3))

      ? Number(journey.max_volume_m3)

      : journey?.total_volume_m3 != null && Number.isFinite(Number(journey.total_volume_m3))

        ? Number(journey.total_volume_m3)

        : null



  const listed = journey ? String(journey.marketplace_visibility || '') === 'visible_in_marketplace' : false

  const editHref = `/admin/journey-planner?journey=${encodeURIComponent(journeyId)}`

  const assignedDriverLabel = useMemo(

    () => (journey ? journeyAssignedDriverLabel(journey, quotes) : ''),

    [journey, quotes],

  )



  async function runAction(fn) {

    setBusy(true)

    try {

      await fn()

      await load()

    } catch (e) {

      window.alert(e?.message || 'Action failed.')

    } finally {

      setBusy(false)

    }

  }



  function onWithdraw() {

    if (!window.confirm('Withdraw this journey from the marketplace and unbundle its jobs?')) return

    void runAction(() => withdrawJourneyFromMarketplace(journeyId))

  }



  function onDeleteDraft() {

    if (!window.confirm('Delete this draft journey permanently?')) return

    void runAction(async () => {

      await deleteJourneyDraft(journeyId)

      navigate('/admin/journey-planner', { replace: true })

    })

  }

  function requestRemoveJob(quoteId, meta) {
    const qid = String(quoteId || '').trim()
    if (!qid) return
    setRemoveTarget({
      quoteId: qid,
      jobRef: meta.jobRef || '',
      customerName: meta.customerName || '',
    })
  }

  async function confirmRemoveJob() {
    if (!removeTarget || !journey) return
    setRemovingJob(true)
    setToast(null)
    try {
      const result = await executeRemoveJobFromJourney({
        journeyId,
        journey,
        quoteId: removeTarget.quoteId,
        stops,
        quotes,
        mapboxToken,
        withdrawFromMarketplaceIfListed: listed,
      })
      setRemoveTarget(null)
      const parts = ['Job removed from journey. It is available again under Available Jobs.']
      if (result.marketplaceWithdrawn) parts.push('Journey withdrawn from marketplace.')
      if (result.routingErr) parts.push(result.routingErr)
      if (result.empty) parts.push('This journey is now empty.')
      setToast({ ok: true, text: parts.join(' ') })
      await load()
    } catch (e) {
      setToast({ ok: false, text: e?.message || 'Could not remove job.' })
    } finally {
      setRemovingJob(false)
    }
  }

  const isEmpty = stops.length === 0

  if (loading) {

    return (

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">

        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden />

        Loading journey…

      </div>

    )

  }



  if (error || !journey) {

    return (

      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">

        {error || 'Journey not found.'}{' '}

        <Link to="/admin/journey-planner" className="font-semibold underline">

          Back to journeys

        </Link>

      </div>

    )

  }



  return (

    <div className="space-y-6">

      {toast ? (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            toast.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="min-w-0">

        <Link

          to="/admin/journey-planner"

          className="text-sm font-semibold text-brand-700 hover:underline"

        >

          ← All journeys

        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2">

          <h2 className="font-mono text-xl font-bold text-slate-900 sm:text-2xl">{ref}</h2>

          <JourneyDispatchStatusBadge journey={journey} quotes={quotes} />

        </div>

        <p className="mt-1 text-base font-semibold text-slate-800">{title}</p>

        {assignedDriverLabel ? (

          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">

            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Dispatched</span>

            {assignedDriverLabel}

          </div>

        ) : null}

      </div>



      <JourneyViewActionBar

        journey={journey}

        journeyId={journeyId}

        quotes={quotes}

        stops={stops}

        listed={listed}

        busy={busy}

        editHref={editHref}

        onAssigned={load}

        onWithdraw={onWithdraw}

        onDeleteDraft={onDeleteDraft}

      />



      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">

        <JourneyOperationalGuidance journey={journey} quotes={quotes} listedOnMarketplace={listed} />

        <JourneyPlannerHelpPanel className="lg:sticky lg:top-4 lg:self-start" />

      </div>



      <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-md sm:p-6">

        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Journey summary</h3>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Team</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">{teamSize != null ? `${teamSize} crew` : '—'}</dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Capacity</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">

              {capacityM3 != null ? `${capacityM3} m³` : `~${JOURNEY_VAN_CAPACITY_M3} m³`}

            </dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Jobs / stops</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">

              {jobsCount} / {stops.length}

            </dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Miles</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">

              {totalMiles != null ? `${totalMiles.toFixed(1)}` : '—'}

            </dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Duration</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">

              {totalDurSec != null && totalDurSec > 0 ? formatJourneyDurationHhMm(totalDurSec) : '—'}

            </dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Revenue</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">{formatJourneyMoney(customerTotal)}</dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Payout</dt>

            <dd className="mt-0.5 text-base font-bold text-emerald-300 sm:text-lg">{formatJourneyMoney(payout)}</dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Platform profit</dt>

            <dd className="mt-0.5 text-base font-bold text-violet-200 sm:text-lg">{formatJourneyMoney(platformProfit)}</dd>

          </div>

          <div>

            <dt className="text-[10px] font-semibold uppercase text-slate-400">Margin</dt>

            <dd className="mt-0.5 text-base font-bold sm:text-lg">

              {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}

            </dd>

          </div>

        </dl>

      </section>



      {isEmpty ? (
        <JourneyEmptyState journeyId={journeyId} busy={busy} onDeleteDraft={onDeleteDraft} />
      ) : (
        <>
          <JourneyRouteOverview
            stops={stops}
            totalMiles={totalMiles}
            totalDurationSeconds={totalDurSec}
          />

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Stop timeline</h3>
            <p className="mt-1 text-sm text-slate-600">
              Pickup (green) and delivery (blue) — remove a job from the pickup row. Both stops for that job are
              removed and totals recalculate automatically.
            </p>
            <div className="mt-3 min-w-0">
              <JourneyStopTimeline
                stops={stops}
                quotesById={quotesById}
                onRemoveJob={requestRemoveJob}
              />
            </div>
          </section>
        </>
      )}

      <JourneyRemoveJobModal
        open={removeTarget != null}
        jobRef={removeTarget?.jobRef || ''}
        customerName={removeTarget?.customerName || ''}
        listedOnMarketplace={listed}
        removing={removingJob}
        onClose={() => !removingJob && setRemoveTarget(null)}
        onConfirm={confirmRemoveJob}
      />

    </div>

  )

}


