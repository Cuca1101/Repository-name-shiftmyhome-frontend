import { Link } from 'react-router-dom'

/**
 * @param {{
 *   counts: {
 *     needs_action: number,
 *     all_paid: number,
 *     marketplace: number,
 *     active: number,
 *     journey: number,
 *     other_paid: number,
 *   },
 *   inboxMode: string,
 *   onInboxModeChange: (mode: string) => void,
 * }} props
 */
export default function AdminJobPipelineSummary({ counts, inboxMode, onInboxModeChange }) {
  const chips = [
    { key: 'needs_action', label: 'Needs assignment', count: counts.needs_action, accent: 'border-sky-300 bg-sky-50 text-sky-950' },
    { key: 'all_paid', label: 'All open paid', count: counts.all_paid, accent: 'border-slate-300 bg-slate-50 text-slate-900' },
    { key: 'marketplace', label: 'Marketplace', count: counts.marketplace, accent: 'border-violet-300 bg-violet-50 text-violet-950' },
    { key: 'active', label: 'Job accepted', count: counts.active, accent: 'border-emerald-300 bg-emerald-50 text-emerald-950' },
    { key: 'journey', label: 'In journey', count: counts.journey, accent: 'border-indigo-300 bg-indigo-50 text-indigo-950' },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Job pipeline</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            Jobs leave “Needs assignment” when you assign a driver, send to marketplace, or add to a journey.
            Use <strong className="font-semibold text-slate-800">All open paid</strong> if you cannot find a booking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/admin/active-jobs" className="font-semibold text-brand-700 hover:underline">
            Job accepted →
          </Link>
          <Link to="/admin/marketplace" className="font-semibold text-brand-700 hover:underline">
            Marketplace →
          </Link>
          <Link to="/admin/journey-planner" className="font-semibold text-brand-700 hover:underline">
            Journeys →
          </Link>
          <Link to="/admin/all-quotes" className="font-semibold text-brand-700 hover:underline">
            All quotes →
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = inboxMode === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onInboxModeChange(c.key)}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                active ? `${c.accent} ring-2 ring-brand-500/30` : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{c.label}</span>
              <span
                className={`rounded-full px-1.5 py-px tabular-nums ${active ? 'bg-white/80' : 'bg-slate-100 text-slate-700'}`}
              >
                {c.count}
              </span>
            </button>
          )
        })}
      </div>
      {counts.other_paid > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
          {counts.other_paid} paid job{counts.other_paid === 1 ? '' : 's'} in an unusual state — open{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => onInboxModeChange('all_paid')}
          >
            All open paid
          </button>{' '}
          and check the “Needs review” badge.
        </p>
      ) : null}
    </div>
  )
}
