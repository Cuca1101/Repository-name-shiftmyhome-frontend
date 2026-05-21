import { Link } from 'react-router-dom'

/**
 * @param {{
 *   journeyId: string,
 *   busy?: boolean,
 *   onDeleteDraft?: () => void,
 * }} props
 */
export default function JourneyEmptyState({ journeyId, busy = false, onDeleteDraft }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center sm:px-6">
      <p className="text-base font-semibold text-slate-900">This journey is now empty</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        All jobs were removed. Add jobs from Available Jobs or delete this draft journey.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          to="/admin/available-jobs"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-500"
        >
          Add jobs from Available Jobs
        </Link>
        <Link
          to={`/admin/journey-planner?journey=${encodeURIComponent(journeyId)}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Keep empty draft
        </Link>
        {onDeleteDraft ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteDraft}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? '…' : 'Delete draft journey'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
