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
}) {
  const phase = getDriverLifecyclePhase(driver)

  if (phase === 'archived') {
    return (
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={onReactivate}
          className={`${btnBase} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
        >
          {saving ? 'Working…' : 'Reactivate Driver'}
        </button>
      </div>
    )
  }

  if (phase === 'suspended') {
    return (
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={onReactivate}
          className={`${btnBase} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
        >
          {saving ? 'Working…' : 'Enable Driver'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={saving}
        onClick={onDisable}
        className={`${btnBase} border border-red-200 bg-red-50 text-red-900 hover:bg-red-100`}
      >
        {saving ? 'Working…' : 'Disable Driver'}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onArchive}
        className={`${btnBase} border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100`}
      >
        Archive Driver
      </button>
      {showDelete && onDelete ? (
        <button
          type="button"
          disabled={saving || !driver?.id}
          onClick={onDelete}
          className={`${btnBase} border border-red-300 bg-white text-red-800 hover:bg-red-50`}
        >
          Delete Driver
        </button>
      ) : null}
    </div>
  )
}
