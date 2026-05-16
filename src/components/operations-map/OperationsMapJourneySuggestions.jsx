function Stat({ label, value }) {
  return (
    <div>
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

function EmptySuggestions() {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 text-sm text-slate-600 shadow-sm">
      <p className="font-semibold text-slate-900">Suggested journey bundles</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        No compatible bundles for the current date filter. Try &quot;This week&quot; or &quot;All dates&quot;.
      </p>
    </div>
  )
}

/**
 * @param {{
 *   suggestions: {
 *     id: string,
 *     quoteIds: string[],
 *     refs: string[],
 *     estimatedMiles: number,
 *     estimatedPayoutGbp: number,
 *     estimatedMarginGbp: number,
 *     durationSavedMin: number,
 *     reason: string,
 *   }[],
 *   onCreateJourney: (quoteIds: string[]) => void,
 *   onAddToPlanner: (quoteIds: string[]) => void,
 * }} props
 */
export default function OperationsMapJourneySuggestions({
  suggestions,
  onCreateJourney,
  onAddToPlanner,
}) {
  if (!suggestions.length) return <EmptySuggestions />

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-white p-4 shadow-sm ring-1 ring-indigo-900/[0.04]">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Suggested journey bundles</p>
        <p className="mt-0.5 text-[11px] text-slate-600">Nearby pickups, corridors &amp; same move date</p>
      </div>
      <ul className="max-h-[min(42vh,320px)] space-y-2 overflow-y-auto pr-1">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <p className="font-mono text-xs font-bold text-slate-900">{s.refs.join(' + ')}</p>
            <p className="mt-1 text-[10px] leading-snug text-slate-500">{s.reason}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <Stat label="Combined mi" value={`${s.estimatedMiles} mi`} />
              <Stat label="Payout est." value={`£${s.estimatedPayoutGbp.toFixed(0)}`} />
              <Stat label="Margin est." value={`£${s.estimatedMarginGbp.toFixed(0)}`} />
              <Stat label="Time saved" value={`~${s.durationSavedMin} min`} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCreateJourney(s.quoteIds)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500"
              >
                Create journey
              </button>
              <button
                type="button"
                onClick={() => onAddToPlanner(s.quoteIds)}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-900 hover:bg-indigo-100"
              >
                Add to planner
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
