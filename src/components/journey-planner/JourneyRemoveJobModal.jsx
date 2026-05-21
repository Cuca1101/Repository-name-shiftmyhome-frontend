/**
 * @param {{
 *   open: boolean,
 *   jobRef: string,
 *   customerName: string,
 *   listedOnMarketplace: boolean,
 *   removing: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void | Promise<void>,
 * }} props
 */
export default function JourneyRemoveJobModal({
  open,
  jobRef,
  customerName,
  listedOnMarketplace,
  removing,
  onClose,
  onConfirm,
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-job-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !removing) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="remove-job-title" className="text-lg font-bold text-slate-900">
          Remove this job from the journey?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{jobRef || 'Job'}</span>
          {customerName && customerName !== '—' ? ` · ${customerName}` : ''} will return to{' '}
          <strong>Available Jobs</strong> and can be added to another journey later. The job record, payment, and
          customer data are not deleted.
        </p>

        {listedOnMarketplace ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-semibold">Marketplace</p>
            <p className="mt-1">
              This will withdraw the journey from the marketplace. Remaining jobs stay on this journey as a draft.
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={removing}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={() => void onConfirm()}
            className="min-h-[44px] rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove job'}
          </button>
        </div>
      </div>
    </div>
  )
}
