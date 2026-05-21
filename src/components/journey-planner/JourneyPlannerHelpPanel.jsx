const STEPS = [
  'Select paid jobs from Available Jobs.',
  'Create or open a journey.',
  'Review stop order and route.',
  'Adjust payout and profit if needed.',
  'Send to Marketplace or assign an internal driver.',
  'Assigned journeys move into Active Jobs.',
  'Complete jobs from Active Jobs or Job Details.',
]

const INFO_CARDS = [
  { title: 'Marketplace', body: 'One card for partners — jobs stay bundled on the journey.', tone: 'emerald' },
  { title: 'Internal fleet', body: 'Assign a driver to dispatch your own crew on every eligible job.', tone: 'sky' },
  { title: 'Active Jobs', body: 'Driver-assigned work appears in Active Jobs for day-of operations.', tone: 'slate' },
]

const TONE_BORDER = {
  emerald: 'border-emerald-200 bg-emerald-50/80',
  sky: 'border-sky-200 bg-sky-50/80',
  slate: 'border-slate-200 bg-slate-50/80',
}

/**
 * @param {{ className?: string }} props
 */
export default function JourneyPlannerHelpPanel({ className = '' }) {
  return (
    <aside
      className={`rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5 ${className}`}
    >
      <h3 className="text-sm font-bold text-slate-900">How Journey Planner works</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        {STEPS.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <div className="mt-4 space-y-2">
        {INFO_CARDS.map((card) => (
          <div
            key={card.title}
            className={`rounded-xl border px-3 py-2.5 ${TONE_BORDER[card.tone] || TONE_BORDER.slate}`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-800">{card.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-600">{card.body}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}
