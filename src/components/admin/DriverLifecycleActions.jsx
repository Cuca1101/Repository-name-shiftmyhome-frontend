import { getDriverLifecyclePhase } from '../../lib/driverAdminLifecycle'

const btnBase =
  'inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Contextual lifecycle buttons for Admin → Drivers cards.
 *
 * @param {{
 *   driver: Record<string, unknown>,
 *   saving?: boolean,
 *   onDisable: () => void,
 *   onArchive: () => void,
 *   onReactivate: () => void,
 *   onDelete?: () => void,
 *   showDelete?: boolean,
 *   compact?: boolean,
 * }} props
 */
export default function DriverLifecycleActions({
  driver,
  saving = false,
  onDisable,
  onArchive,
  onReactivate,
  onDelete,
  showDelete = false,
  compact = false,
}) {
  const phase = getDriverLifecyclePhase(driver)
  const wrap = compact
    ? 'flex flex-wrap gap-1.5'
    : 'mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4'
  const btn = compact
    ? 'inline-flex min-h-[36px] flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40'
    : btnBase

  if (phase === 'archived') {
    return (
      <div className={wrap}>
        <button
          type="button"
          disabled={saving}
          onClick={onReactivate}
          className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
        >
          {saving ? 'Working…' : compact ? 'Enable' : 'Reactivate Driver'}
        </button>
        {showDelete && onDelete ? (
          <button
            type="button"
            disabled={saving || !driver?.id}
            onClick={onDelete}
            className={`${btn} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
          >
            Delete
          </button>
        ) : null}
      </div>
    )
  }

  if (phase === 'suspended') {
    return (
      <div className={wrap}>
        <button
          type="button"
          disabled={saving}
          onClick={onReactivate}
          className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
        >
          {saving ? 'Working…' : compact ? 'Enable' : 'Enable Driver'}
        </button>
        {showDelete && onDelete ? (
          <button
            type="button"
            disabled={saving || !driver?.id}
            onClick={onDelete}
            className={`${btn} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
          >
            Delete
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={wrap}>
      <button
        type="button"
        disabled={saving}
        onClick={onDisable}
        className={`${btn} border border-red-200 bg-red-50 text-red-900 hover:bg-red-100`}
      >
        {saving ? 'Working…' : compact ? 'Disable' : 'Disable Driver'}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onArchive}
        className={`${btn} border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100`}
      >
        {compact ? 'Archive' : 'Archive Driver'}
      </button>
      {showDelete && onDelete ? (
        <button
          type="button"
          disabled={saving || !driver?.id}
          onClick={onDelete}
          className={`${btn} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
        >
          Delete
        </button>
      ) : null}
    </div>
  )
}
