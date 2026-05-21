import { useMemo, useState } from 'react'
import { quoteIsJobCompleted } from '../../lib/journeyPlannerDisplay'
import JourneyStopCard from './JourneyStopCard'

/**
 * @param {{
 *   stops: import('../../lib/journeyPlannerModel.js').JourneyStop[],
 *   quotesById: Record<string, Record<string, unknown>>,
 *   onRemoveJob?: (quoteId: string, meta: { jobRef: string, customerName: string }) => void,
 * }} props
 */
export default function JourneyStopTimeline({ stops, quotesById, onRemoveJob }) {
  const [expanded, setExpanded] = useState(() => new Set())

  const firstActiveIndex = useMemo(() => {
    for (let i = 0; i < stops.length; i++) {
      const q = stops[i].quoteId ? quotesById[stops[i].quoteId] : null
      if (q && !quoteIsJobCompleted(q)) return i
    }
    return -1
  }, [stops, quotesById])

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (stops.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
        No stops on this journey yet.
      </p>
    )
  }

  return (
    <ol className="relative space-y-0">
      {stops.map((stop, index) => {
        const quote = stop.quoteId ? quotesById[stop.quoteId] : null
        const completed = quoteIsJobCompleted(quote)
        const isCurrent = index === firstActiveIndex && !completed
        const isPickup = stop.kind === 'pickup'
        const open = expanded.has(stop.id)

        return (
          <li key={stop.id} className="relative pl-6 pb-2 last:pb-0 sm:pl-7 sm:pb-2.5">
            {index < stops.length - 1 ? (
              <span
                className={`absolute left-[9px] top-6 bottom-0 w-px ${completed ? 'bg-emerald-100' : 'bg-slate-200'}`}
                aria-hidden
              />
            ) : null}
            <span
              className={`absolute left-0 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${
                completed ? 'bg-emerald-400' : isPickup ? 'bg-emerald-600' : 'bg-sky-600'
              }`}
            >
              {index + 1}
            </span>

            <JourneyStopCard
              stop={stop}
              index={index}
              quote={quote}
              open={open}
              onToggle={() => toggle(stop.id)}
              mode="timeline"
              isCurrent={isCurrent}
              completed={completed}
              onRemoveJob={onRemoveJob}
            />
          </li>
        )
      })}
    </ol>
  )
}
