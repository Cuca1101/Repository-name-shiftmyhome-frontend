import { Link } from 'react-router-dom'

/**
 * @param {{
 *   quoteId: string,
 *   showQuickActions?: boolean,
 *   onAssignDriver?: () => void,
 *   onMarketplace?: () => void,
 * }} props
 */
export default function JobActionsMenu({
  quoteId,
  showQuickActions = true,
  onAssignDriver,
  onMarketplace,
}) {
  const to = `/admin/available-jobs/${quoteId}`
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link
        to={to}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        View Details
      </Link>
      {showQuickActions ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={typeof onAssignDriver !== 'function'}
            title={
              typeof onAssignDriver !== 'function'
                ? 'Assign a driver from the job details page.'
                : undefined
            }
            onClick={typeof onAssignDriver === 'function' ? onAssignDriver : undefined}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Assign Driver
          </button>
          <button
            type="button"
            disabled={typeof onMarketplace !== 'function'}
            title={
              typeof onMarketplace !== 'function'
                ? 'List on marketplace from the job details page.'
                : undefined
            }
            onClick={typeof onMarketplace === 'function' ? onMarketplace : undefined}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Send to Marketplace
          </button>
        </div>
      ) : null}
    </div>
  )
}
