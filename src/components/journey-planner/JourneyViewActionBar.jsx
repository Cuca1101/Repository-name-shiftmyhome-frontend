import { Link } from 'react-router-dom'
import JourneyAssignDriverButton from './JourneyAssignDriverButton'

/**
 * @param {{
 *   journey: Record<string, unknown>,
 *   journeyId: string,
 *   quotes: Record<string, unknown>[],
 *   stops: import('../../lib/journeyPlannerModel.js').JourneyStop[],
 *   listed: boolean,
 *   busy: boolean,
 *   editHref: string,
 *   onAssigned: () => void | Promise<void>,
 *   onWithdraw: () => void,
 *   onDeleteDraft: () => void,
 * }} props
 */
export default function JourneyViewActionBar({
  journey,
  journeyId,
  quotes,
  stops,
  listed,
  busy,
  editHref,
  onAssigned,
  onWithdraw,
  onDeleteDraft,
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Dispatch actions</p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <JourneyAssignDriverButton
            variant="primary"
            journey={journey}
            journeyId={journeyId}
            quotes={quotes}
            stops={stops}
            onAssigned={onAssigned}
          />
          <Link
            to={editHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Open / edit journey
          </Link>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end">
          {!listed ? (
            <Link
              to={editHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 sm:flex-none"
            >
              Send to marketplace
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onWithdraw}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-50 disabled:opacity-50 sm:flex-none"
            >
              {busy ? '…' : 'Withdraw from marketplace'}
            </button>
          )}
          {!listed ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDeleteDraft}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:flex-none"
            >
              {busy ? '…' : 'Delete draft'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
