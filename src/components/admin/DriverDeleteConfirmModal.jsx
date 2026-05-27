import { useEffect, useState } from 'react'
import { checkDriverCanHardDelete, DRIVER_ARCHIVE_INSTEAD_MESSAGE } from '../../lib/driverAdminLifecycle'

/**
 * @param {{
 *   open: boolean,
 *   driver: { id: string, name: string } | null,
 *   quotes?: Record<string, unknown>[],
 *   jobs?: Record<string, unknown>[],
 *   busy?: boolean,
 *   onClose: () => void,
 *   onConfirmDelete: () => void | Promise<void>,
 *   onArchive: () => void | Promise<void>,
 * }} props
 */
export default function DriverDeleteConfirmModal({
  open,
  driver,
  quotes = [],
  jobs = [],
  busy = false,
  onClose,
  onConfirmDelete,
  onArchive,
}) {
  const [checking, setChecking] = useState(false)
  const [canDelete, setCanDelete] = useState(true)
  const [blockMessage, setBlockMessage] = useState('')

  useEffect(() => {
    if (!open || !driver?.id) {
      setCanDelete(true)
      setBlockMessage('')
      return
    }
    let cancelled = false
    setChecking(true)
    void checkDriverCanHardDelete(driver.id, { quotes, jobs })
      .then((result) => {
        if (cancelled) return
        setCanDelete(result.canDelete)
        setBlockMessage(result.canDelete ? '' : result.message || DRIVER_ARCHIVE_INSTEAD_MESSAGE)
      })
      .catch(() => {
        if (!cancelled) {
          setCanDelete(false)
          setBlockMessage(DRIVER_ARCHIVE_INSTEAD_MESSAGE)
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, driver?.id, quotes, jobs])

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
          Are you sure you want to delete <strong className="text-slate-900">{driver.name}</strong>?
        </p>

        {checking ? (
          <p className="mt-3 text-sm text-slate-500">Checking job and payment history…</p>
        ) : null}

        {!checking && !canDelete ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
            {blockMessage}
          </p>
        ) : null}

        {!checking && canDelete ? (
          <p className="mt-3 text-xs text-slate-500">
            This removes the driver profile and their mobile login account. Job and payment records are not affected
            because this driver has no linked history.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {!canDelete && !checking ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onArchive()}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Archive driver'}
            </button>
          ) : null}
          {canDelete && !checking ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onConfirmDelete()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete driver'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
