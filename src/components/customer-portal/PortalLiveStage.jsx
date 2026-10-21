import { useEffect, useState } from 'react'
import LiveStageSummary from '../tracking/LiveStageSummary'
import { liveStageFromPortalBooking } from '../../lib/jobDispatchTimeline'
import { trackingClient } from '../../lib/jobCustomerTracking'
import { currentAttemptRows } from '../../lib/driverWorkflowAttempt'

/**
 * Customer booking progress. Events come from the same driver history the
 * tracking link already returns. The stage maths match admin Job Details.
 *
 * @param {{ booking: Record<string, unknown> | null, token?: string }} props
 */
export default function PortalLiveStage({ booking, token = '' }) {
  const [events, setEvents] = useState([])
  const [ready, setReady] = useState(() => !String(token || '').trim())
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const client = trackingClient()
    const id = String(token || '').trim()
    if (!client || !id) {
      setEvents([])
      setReady(true)
      setLoadError('')
      return undefined
    }

    let cancelled = false
    setEvents([])
    setReady(false)
    setLoadError('')
    async function load() {
      try {
        const { data, error } = await client.rpc('public_get_job_move_timeline', { p_token: id })
        if (cancelled) return
        if (error || data?.ok === false) {
          setLoadError('The timeline could not be loaded.')
          return
        }
        setLoadError('')
        const rows = Array.isArray(data?.events) ? data.events : []
        setEvents(currentAttemptRows(rows, data?.workflow_version))
      } catch {
        if (!cancelled) setLoadError('The timeline could not be loaded.')
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    load()
    const timer = window.setInterval(load, 15000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [token])

  const stage = liveStageFromPortalBooking(booking, events)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {!ready ? <p className="mb-3 text-sm text-slate-500">Loading the timeline…</p> : null}
      {ready && loadError ? <p className="mb-3 text-sm text-slate-700">{loadError}</p> : null}
      <LiveStageSummary stage={stage} variant="portal" />
    </section>
  )
}
