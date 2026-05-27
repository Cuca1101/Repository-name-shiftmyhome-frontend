import { useState } from 'react'

/** @typedef {'remove_with_charge' | 'remove_without_charge' | 'cancel_job' | 'keep_in_journey'} JourneyRemoveMode */

const MODES = [
  {
    id: 'remove_with_charge',
    title: 'Remove with charge',
    description:
      'Job leaves the journey. Its payout stays on record and the journey total drops by that amount. Other jobs keep the same payout.',
  },
  {
    id: 'remove_without_charge',
    title: 'Remove without charge',
    description:
      'Job leaves the journey. The same journey payout total is split again across the remaining jobs (e.g. £333 ÷ 5 instead of 6).',
  },
  {
    id: 'cancel_job',
    title: 'Cancel job',
    description:
      'Customer cancelled, not home, or access issue. Job is marked cancelled and removed from the journey. Payout is redistributed like “without charge”.',
  },
  {
    id: 'keep_in_journey',
    title: 'Keep in journey',
    description: 'Close without removing this job.',
  },
]

/**
 * @param {{
 *   open: boolean,
 *   jobRef: string,
 *   customerName: string,
 *   listedOnMarketplace: boolean,
 *   removing: boolean,
 *   onClose: () => void,
 *   onConfirm: (mode: JourneyRemoveMode, reason: string) => void | Promise<void>,
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
  const [mode, setMode] = useState(/** @type {JourneyRemoveMode} */ ('remove_without_charge'))
  const [reason, setReason] = useState('')

  if (!open) return null

  async function handleConfirm() {
    if (mode === 'keep_in_journey') {
      onClose()
      return
    }
    await onConfirm(mode, reason.trim())
  }

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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="remove-job-title" className="text-lg font-bold text-slate-900">
          Remove job from journey?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{jobRef || 'Job'}</span>
          {customerName && customerName !== '—' ? ` · ${customerName}` : ''}
        </p>

        {listedOnMarketplace ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-semibold">Marketplace</p>
            <p className="mt-1">This withdraws the journey from the marketplace. Remaining jobs stay on this journey.</p>
          </div>
        ) : null}

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Choose action</legend>
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                mode === m.id ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-400/40' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="remove-mode"
                className="mt-0.5"
                checked={mode === m.id}
                onChange={() => setMode(/** @type {JourneyRemoveMode} */ (m.id))}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{m.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-600">{m.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode !== 'keep_in_journey' ? (
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason (for audit log)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="e.g. Customer not home, access blocked…"
            />
          </label>
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
            onClick={() => void handleConfirm()}
            className="min-h-[44px] rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {removing ? 'Working…' : mode === 'keep_in_journey' ? 'Keep job' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
