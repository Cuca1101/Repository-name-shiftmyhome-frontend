import { journeyDispatchStatus } from '../../lib/journeyPlannerDisplay'

/**
 * @param {{
 *   journey: Record<string, unknown>,
 *   quotes?: Record<string, unknown>[],
 *   listedOnMarketplace?: boolean,
 * }} props
 */
export default function JourneyOperationalGuidance({ journey, quotes = [], listedOnMarketplace = false }) {
  const status = journeyDispatchStatus(journey, quotes)
  const notes = []

  if (status.key === 'draft' || status.key === 'ready') {
    notes.push('Save journey after changing stop order or pricing.')
  }
  if (status.key === 'ready' || status.key === 'draft') {
    notes.push('Send to Marketplace for partner claiming.')
    notes.push('Assign internal driver for internal fleet completion.')
  }
  if (listedOnMarketplace || status.key === 'marketplace') {
    notes.push('This journey is live on Marketplace — withdraw before editing payout if partners may have seen it.')
  }
  if (status.key === 'driver_assigned' || status.key === 'active') {
    notes.push('Assigned jobs appear in Job Accepted — open Job Details to update progress.')
    notes.push('Completed jobs move to Completed Jobs automatically.')
  }
  if (status.key === 'completed') {
    notes.push('All linked jobs are completed or closed.')
  }

  const unique = [...new Set(notes)]

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Operational notes</h3>
      <ul className="mt-3 space-y-2">
        {unique.map((text) => (
          <li key={text} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
