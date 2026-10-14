import { useEffect, useState } from 'react'
import { buildDispatchTimelineState, formatLoadDuration } from '../../lib/jobDispatchTimeline'

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   overrides: Record<string, unknown>,
 *   linkedJob?: Record<string, unknown> | null,
 *   assignment?: { status?: string, updated_at?: string } | null,
 *   workflow?: { workflow_status?: string, workflow_at?: string } | null,
 *   statusHistory?: Array<{ status: string, created_at: string }>,
 * }} props
 */
export default function JobDispatchOpsTimeline({
  q,
  overrides,
  linkedJob = null,
  assignment = null,
  workflow = null,
  statusHistory = [],
}) {
  const steps = buildDispatchTimelineState(
    q,
    overrides,
    linkedJob,
    assignment,
    workflow,
    statusHistory,
  )

  const current = steps.find((step) => step.state === 'current')
  const doneCount = steps.filter((step) => step.state === 'done' || step.state === 'current').length
  const clockRuns = steps.some((step, index) => step.state === 'current' && step.startedAt && !step.endedAt && index < steps.length - 1)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!clockRuns) return undefined
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [clockRuns])

  return (
    <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Live stage</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{current?.label || 'Not started'}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{doneCount} of {steps.length}</p>
      <ol className="mt-3">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const done = step.state === 'done'
          const now = step.state === 'current'
          const cancelled = step.state === 'cancelled'
          const dot = done
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : now
              ? 'border-sky-500 bg-white text-sky-700 ring-4 ring-sky-100'
              : cancelled
                ? 'border-red-400 bg-red-500 text-white'
                : 'border-slate-200 bg-white text-slate-400'
          return (
            <li key={step.id} className="relative flex gap-2.5 pb-3">
              {!isLast ? (
                <span className={`absolute left-[9px] top-5 h-[calc(100%-0.6rem)] w-px ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden />
              ) : null}
              <span className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${dot}`}>
                {done ? '✓' : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-xs leading-tight ${done || now ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                  {step.label}
                  {now ? <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-px text-[9px] font-bold uppercase text-sky-800">Now</span> : null}
                </p>
                {step.id === 'arrived_pickup' || step.id === 'arrived_delivery' ? (
                  <div className="mt-0.5 space-y-0.5 text-[10px] tabular-nums text-slate-600">
                    {step.timestamp ? <p>Arrived {step.timestamp}</p> : null}
                    {steps.find((item) => item.id === (step.id === 'arrived_pickup' ? 'in_transit' : 'completed'))?.timestamp ? (
                      <p>Left {steps.find((item) => item.id === (step.id === 'arrived_pickup' ? 'in_transit' : 'completed')).timestamp}</p>
                    ) : null}
                  </div>
                ) : step.id === 'on_way' || step.id === 'in_transit' ? (
                  step.timestamp ? <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">Left {step.timestamp}</p> : null
                ) : (
                  step.timestamp ? <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">{step.timestamp}</p> : null
                )}
                {step.id !== 'accepted' && step.startedAt && (step.endedAt || (now && !isLast)) ? (
                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-800">
                    {formatLoadDuration(step.startedAt, step.endedAt, nowMs)}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
