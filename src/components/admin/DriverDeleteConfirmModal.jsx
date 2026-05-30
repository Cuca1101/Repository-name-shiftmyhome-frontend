/**
 * @param {{
 *   open: boolean,
 *   driver: { id: string, name: string } | null,
 *   busy?: boolean,
 *   error?: string,
 *   onClose: () => void,
 *   onConfirmDelete: () => void | Promise<void>,
 *   onArchive?: () => void | Promise<void>,
 * }} props
 */
export default function DriverDeleteConfirmModal({
  open,
  driver,
  busy = false,
  error = '',
  onClose,
  onConfirmDelete,
  onArchive,
}) {
  if (!open || !driver) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-driver-title"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-driver-title" className="text-lg font-semibold text-slate-900">
          Delete driver?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Permanently remove <strong className="text-slate-900">{driver.name}</strong> from the fleet and
          delete their mobile login.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Customer bookings stay in the system with the driver&apos;s name and job dates kept on each move.
          Only the fleet profile and mobile login are removed.
        </p>

        {error ? (
          <p
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {onArchive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onArchive()}
              className="mr-auto rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              Archive instead
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirmDelete()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete driver'}
          </button>
        </div>
      </div>
    </div>
  )
}
