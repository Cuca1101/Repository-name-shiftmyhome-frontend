import { Link } from 'react-router-dom'

/**
 * @param {{
 *   quoteId: string,
 *   showQuickActions?: boolean,
 *   onAssignDriver?: () => void,
 *   onMarketplace?: () => void,
 *   compact?: boolean,
 * }} props
 */
export default function JobActionsMenu({
  quoteId,
  showQuickActions = true,
  onAssignDriver,
  onMarketplace,
  compact = false,
}) {
  const to = `/admin/available-jobs/${quoteId}`
  const wrapClass = compact ? 'mt-2 flex flex-col gap-1.5' : 'mt-4 flex flex-col gap-2'
  const primaryClass = compact
    ? 'inline-flex min-h-[34px] w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-sm hover:bg-brand-700'
    : 'inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-brand-700'
  const secondaryClass = compact
    ? 'inline-flex min-h-[30px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400'
    : 'inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <div className={wrapClass}>
      <Link to={to} className={primaryClass}>
        View Details
      </Link>
      {showQuickActions ? (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={typeof onAssignDriver !== 'function'}
            title={
              typeof onAssignDriver !== 'function'
                ? 'Assign a driver from the job details page.'
                : undefined
            }
            onClick={typeof onAssignDriver === 'function' ? onAssignDriver : undefined}
            className={secondaryClass}
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
            className={secondaryClass}
          >
            Send to Marketplace
          </button>
        </div>
      ) : null}
    </div>
  )
}

