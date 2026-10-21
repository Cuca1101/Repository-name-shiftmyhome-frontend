import { useEffect, useState } from 'react'
import { formatLoadDuration } from '../../lib/jobDispatchTimeline'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'

/**
 * Accepted, Collection and Delivery for one booking.
 * Admin Job Details and the customer portal both render this summary.
 *
 * @param {{
 *   stage: ReturnType<import('../../lib/jobDispatchTimeline').buildAdminLiveStage>,
 *   variant?: 'admin' | 'portal',
 * }} props
 */
export default function LiveStageSummary({ stage, variant = 'admin' }) {
  const portal = variant === 'portal'
  const clockRuns = stage.collection.timer.running || stage.delivery.timer.running
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!clockRuns) return undefined
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [clockRuns])

  return (
    <div>
      <p className={portal ? 'text-xs font-bold uppercase tracking-wide text-slate-500' : 'text-[10px] font-bold uppercase tracking-wide text-slate-500'}>
        {portal ? 'Job progress' : 'Live stage'}
      </p>
      <p className={portal ? 'mt-1 text-base font-semibold text-slate-900' : 'mt-1 text-sm font-semibold text-slate-900'}>
        {stage.currentLabel}
      </p>
      {portal ? <p className="mt-0.5 text-xs text-slate-500">Times are UK time.</p> : null}

      <section className="mt-3">
        <p className={sectionTitle(portal)}>Accepted</p>
        <p className={`mt-1 tabular-nums ${portal ? 'text-sm' : 'text-xs'} ${stage.accepted.at ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
          {stage.accepted.at ? formatDateTimeUK(stage.accepted.at) : '—'}
        </p>
      </section>

      <AddressStage title="Collection" rows={[
        stage.collection.start,
        stage.collection.arrived,
        stage.collection.complete,
      ]} timer={stage.collection.timer} nowMs={nowMs} portal={portal} />
      <AddressStage title="Delivery" rows={[
        stage.delivery.start,
        stage.delivery.arrived,
        stage.delivery.complete,
      ]} timer={stage.delivery.timer} nowMs={nowMs} portal={portal} />
    </div>
  )
}

function sectionTitle(portal) {
  return portal
    ? 'text-xs font-bold uppercase tracking-wide text-slate-500'
    : 'text-[10px] font-bold uppercase tracking-wide text-slate-500'
}

/**
 * @param {{
 *   title: string,
 *   rows: Array<{ id: string, label: string, at: string, state: string }>,
 *   timer: { startedAt: string, endedAt: string, running: boolean },
 *   nowMs: number,
 *   portal: boolean,
 * }} props
 */
function AddressStage({ title, rows, timer, nowMs, portal }) {
  return (
    <section className="mt-3">
      <p className={sectionTitle(portal)}>{title}</p>
      <ol className="mt-1">
        {rows.map((row, index) => {
          const live = row.id.endsWith('arrived') && timer.running
          const finished = row.id.endsWith('complete') && timer.startedAt && timer.endedAt
          const duration = live
            ? formatLoadDuration(timer.startedAt, '', nowMs)
            : finished
              ? formatLoadDuration(timer.startedAt, timer.endedAt, nowMs)
              : ''
          return (
            <li key={row.id} className="flex items-start justify-between gap-3 py-1">
              <p className={`leading-tight ${portal ? 'text-sm' : 'text-xs'} ${row.state === 'upcoming' ? 'text-slate-500' : 'font-semibold text-slate-900'}`}>
                {index + 1}. {row.label}
                {row.state === 'current' ? (
                  <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-px text-[9px] font-bold uppercase text-sky-800">Now</span>
                ) : null}
              </p>
              <p className={`text-right tabular-nums text-slate-600 ${portal ? 'text-xs' : 'text-[10px]'}`}>
                <span className={row.at ? 'font-medium text-slate-800' : 'text-slate-400'}>
                  {row.at ? formatDateTimeUK(row.at) : '—'}
                </span>
                {duration ? (
                  <span className={`block font-semibold text-emerald-800 ${portal ? 'mt-0.5 text-sm' : 'mt-0.5 text-[11px]'}`}>{duration}</span>
                ) : null}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
