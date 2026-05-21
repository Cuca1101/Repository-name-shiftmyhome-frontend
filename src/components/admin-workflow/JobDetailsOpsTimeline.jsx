import { buildJobOperationsTimeline, formatTimelineEventTime } from '../../lib/buildJobOpsTimeline'

const cardShell =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

/**
 * @param {{ q: Record<string, unknown>, overrides: Record<string, unknown>, title?: string }} props
 */
export default function JobDetailsOpsTimeline({ q, overrides, title = 'Activity timeline' }) {
  const events = buildJobOperationsTimeline(q, overrides)

  return (
    <section className={cardShell}>
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">Quote, payment, assignment & status</p>
      </div>
      <div className="p-4 sm:p-5">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline entries yet.</p>
        ) : (
          <ul className="space-y-0">
            {events.map((e, i) => (
              <li key={`${e.label}-${i}-${e.detail.slice(0, 24)}`} className="relative flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-brand-500 shadow-[0_0_0_3px_rgba(14,165,233,0.2)]" />
                  {i < events.length - 1 ? (
                    <span
                      className="mt-1 min-h-[1.75rem] w-px grow bg-gradient-to-b from-slate-200 to-slate-100"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className={`min-w-0 flex-1 ${i < events.length - 1 ? 'pb-4' : ''}`}>
                  <p className="text-sm font-semibold text-slate-900">{e.label}</p>
                  {e.t ? (
                    <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500">
                      {formatTimelineEventTime(e)}
                    </p>
                  ) : null}
                  {e.detail ? (
                    <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
                      {e.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
