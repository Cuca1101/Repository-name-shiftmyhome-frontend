import { useState } from 'react'
import { driverChargeTypeLabel } from '../../lib/driverChargeConstants'
import DriverChargeStatusBadge from './DriverChargeStatusBadge'
import DriverChargeNotesModal from './DriverChargeNotesModal'

function money(n) {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   charges: Array<Record<string, unknown>>,
 *   onWaive?: (charge: Record<string, unknown>) => void,
 *   onDispute?: (charge: Record<string, unknown>) => void,
 *   onCancel?: (charge: Record<string, unknown>) => void,
 *   onApply?: (charge: Record<string, unknown>) => void,
 *   onNotesSaved?: () => void | Promise<void>,
 *   compact?: boolean,
 * }} props
 */
export default function DriverChargesList({
  charges,
  onWaive,
  onDispute,
  onCancel,
  onApply,
  onNotesSaved,
  compact = false,
}) {
  const [editingNotes, setEditingNotes] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const list = Array.isArray(charges) ? charges : []
  if (list.length === 0) {
    return (
      <p className="text-xs text-slate-500">No driver charges linked.</p>
    )
  }

  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {list.map((c) => {
        const id = String(c.id)
        const st = String(c.status)
        const canWaive = st !== 'waived' && st !== 'cancelled'
        return (
          <li
            key={id}
            className="rounded-xl border border-rose-100/90 bg-rose-50/30 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {driverChargeTypeLabel(c.chargeType)} · {money(c.amount)}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{String(c.reason || '')}</p>
                {c.notes ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">{String(c.notes)}</p>
                ) : null}
                {c.evidenceUrl ? (
                  <a
                    href={String(c.evidenceUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[11px] font-medium text-brand-700 hover:underline"
                  >
                    View evidence
                  </a>
                ) : null}
              </div>
              <DriverChargeStatusBadge status={st} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {st === 'pending' && onApply ? (
                <button
                  type="button"
                  onClick={() => onApply(c)}
                  className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Mark applied
                </button>
              ) : null}
              {canWaive && onWaive ? (
                <button
                  type="button"
                  onClick={() => onWaive(c)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Waive
                </button>
              ) : null}
              {st !== 'disputed' && st !== 'waived' && st !== 'cancelled' && onDispute ? (
                <button
                  type="button"
                  onClick={() => onDispute(c)}
                  className="rounded border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-900 hover:bg-violet-50"
                >
                  Dispute
                </button>
              ) : null}
              {canWaive && onCancel ? (
                <button
                  type="button"
                  onClick={() => onCancel(c)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
              {onNotesSaved ? (
                <button
                  type="button"
                  onClick={() => setEditingNotes(c)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit notes
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
      <DriverChargeNotesModal
        open={Boolean(editingNotes)}
        charge={editingNotes}
        onClose={() => setEditingNotes(null)}
        onSaved={onNotesSaved}
      />
    </ul>
  )
}
