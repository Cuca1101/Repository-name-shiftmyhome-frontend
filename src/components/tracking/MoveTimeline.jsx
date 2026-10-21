import { useEffect, useState } from 'react'
import { buildMoveTimeline, formatMoveDateTime, NOT_RECORDED } from '../../lib/moveTimeline'
import { formatLoadDuration } from '../../lib/jobDispatchTimeline'
import { trackingClient } from '../../lib/jobCustomerTracking'

/**
 * Customer move record. Admin Job Details uses the live stage summary instead.
 *
 * @param {{
 *   token?: string,
 *   completedAt?: string | null,
 *   collapsible?: boolean,
 * }} props
 */
export default function MoveTimeline({
  token = '',
  completedAt = null,
  collapsible = false,
}) {
  const [events, setEvents] = useState([])
  const [photos, setPhotos] = useState([])
  const [open, setOpen] = useState(!collapsible)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setReady(false)
      setLoadError('')
      try {
        if (token) {
          const client = trackingClient()
          if (!client) {
            if (!cancelled) setLoadError('The timeline could not be loaded.')
            return
          }
          const { data: timeline, error: timelineError } = await client.rpc('public_get_job_move_timeline', { p_token: token })
          if (timelineError || timeline?.ok === false) {
            throw timelineError || new Error(timeline?.error || 'timeline_failed')
          }
          let nextPhotos = []
          try {
            const media = await client.functions.invoke('get-job-tracking-media', { body: { token } })
            nextPhotos = Array.isArray(media.data?.photos) ? media.data.photos : []
          } catch {
            nextPhotos = []
          }
          if (!cancelled) {
            setEvents(Array.isArray(timeline?.events) ? timeline.events : [])
            setPhotos(nextPhotos)
          }
        } else if (!cancelled) {
          setEvents([])
          setPhotos([])
        }
      } catch {
        if (!cancelled) {
          setEvents([])
          setPhotos([])
          setLoadError('The timeline could not be loaded.')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const timeline = buildMoveTimeline(events, photos, { completedAt })
  const clockRuns = timeline.milestones.some(
    (step, index) => step.recorded && step.startedAt && !step.endedAt && index < timeline.milestones.length - 1,
  )
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!clockRuns) return undefined
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [clockRuns])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Move record</h2>
            <p className="mt-0.5 text-sm text-slate-500">{open ? 'Hide the stages' : 'Show the stages'}</p>
          </span>
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      ) : (
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">Move record</h2>
      )}
      {open ? (
      <>
      <TimelineSummary milestones={timeline.milestones} ready={ready} />
      {!ready ? <p className="mt-3 text-sm text-slate-500">Loading the timeline…</p> : null}
      {ready && loadError ? <p className="mt-3 text-sm text-slate-700">{loadError}</p> : null}
      {ready && !loadError ? <ol className="mt-4">
        {timeline.milestones.map((step, index) => {
          const done = step.recorded
          const currentIndex = currentMilestoneIndex(timeline.milestones)
          const current = !done && index === currentIndex
          const last = index === timeline.milestones.length - 1
          return (
          <li key={step.key} className="relative flex gap-3 pb-4">
            {!last ? (
              <span className={`absolute left-[11px] top-6 h-[calc(100%-0.75rem)] w-px ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden />
            ) : null}
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                done
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : current
                    ? 'border-sky-500 bg-white text-sky-700 ring-4 ring-sky-100'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {done ? '✓' : index + 1}
            </span>
            <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-sm font-semibold ${done || current ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
              <p className={`text-right text-xs tabular-nums ${done ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                {stageStamp(step)}
              </p>
            </div>
            {step.clock && step.recorded && step.startedAt ? (
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-emerald-800">
                {formatLoadDuration(step.startedAt, step.endedAt, nowMs)}
              </p>
            ) : null}
            {step.showReceived ? (
              <p className="mt-1 text-xs text-slate-500">Received by server: {step.receivedLabel}</p>
            ) : null}
            {step.notes ? <p className="mt-2 text-sm text-slate-700">{step.notes}</p> : null}
            <PhotoRow photos={step.photos} />
            {step.corrections.map((row) => (
              <p key={row.id} className="mt-2 text-sm text-slate-600">
                Correction by {row.actor_name || NOT_RECORDED} at {formatMoveDateTime(row.occurred_at || row.created_at)}
                {row.correction_reason || row.notes ? `: ${row.correction_reason || row.notes}` : ''}
              </p>
            ))}
            </div>
          </li>
          )
        })}
      </ol> : null}
      </>
      ) : null}
    </section>
  )
}

function stageStamp(step) {
  if (!step.recorded) return 'Waiting'
  if (step.key === 'arrived_collection' || step.key === 'arrived_delivery') return `Arrived ${step.whenLabel}`
  if (step.key === 'loading_started' || step.key === 'unloading_started') return `Started ${step.whenLabel}`
  if (step.key === 'departed_collection' || step.key === 'departed_delivery') return `Left ${step.whenLabel}`
  return step.whenLabel
}

function currentMilestoneIndex(milestones) {
  let last = -1
  milestones.forEach((step, index) => {
    if (step.recorded) last = index
  })
  if (last < 0) return 0
  if (last >= milestones.length - 1) return last
  return last + 1
}

function TimelineSummary({ milestones, ready }) {
  if (!ready) return <p className="mt-1 text-sm text-slate-500">Times are in UK time.</p>
  const done = milestones.filter((step) => step.recorded).length
  const total = milestones.length
  const latest = [...milestones].reverse().find((step) => step.recorded)
  const summary = done === 0
    ? 'The driver has not started this job yet.'
    : done === total
      ? 'This job is finished.'
      : `${latest?.label || 'In progress'}.`
  return (
    <div className="mt-2">
      <p className="text-sm text-slate-600">{summary} Times are in UK time.</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

function PhotoRow({ photos }) {
  if (!photos?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {photos.map((photo) => {
        const src = photo.signed_url || photo.signedUrl || ''
        const label = photo.photo_type || 'Photo'
        return src ? (
          <a key={photo.id || src} href={src} target="_blank" rel="noreferrer" className="block">
            <img src={src} alt={String(label)} className="h-16 w-16 rounded-lg object-cover" />
          </a>
        ) : (
          <span key={photo.id || label} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{label}</span>
        )
      })}
    </div>
  )
}
