import { buildDispatchTimelineState } from '../../lib/jobDispatchTimeline'

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   overrides: Record<string, unknown>,
 *   linkedJob?: Record<string, unknown> | null,
 *   assignment?: { status?: string, updated_at?: string } | null,
 * }} props
 */
export default function JobDispatchOpsTimeline({ q, overrides, linkedJob = null, assignment = null }) {
  const steps = buildDispatchTimelineState(q, overrides, linkedJob, assignment)

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 p-3 lg:border-t-0 lg:border-l">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status tracker</p>
      <ol className="mt-2 space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const dot =
            step.state === 'done'
              ? 'bg-emerald-500 ring-emerald-100'
              : step.state === 'current'
                ? 'bg-brand-500 ring-brand-100 animate-pulse'
                : step.state === 'cancelled'
                  ? 'bg-red-400 ring-red-100'
                  : 'bg-slate-300 ring-slate-100'
          const text =
            step.state === 'done' || step.state === 'current'
              ? 'font-semibold text-slate-900'
              : 'text-slate-500'
          return (
            <li key={step.id} className="relative flex gap-2 pb-2.5">
              <div className="flex flex-col items-center pt-0.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ring-2 ${dot}`} aria-hidden />
                {!isLast ? <span className="mt-0.5 w-px flex-1 bg-slate-200" style={{ minHeight: '1.25rem' }} /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <p className={`text-[11px] leading-tight ${text}`}>{step.label}</p>
                  {step.state === 'current' ? (
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-800">
                      Now
                    </span>
                  ) : null}
                </div>
                {step.timestamp ? (
                  <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">{step.timestamp}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
