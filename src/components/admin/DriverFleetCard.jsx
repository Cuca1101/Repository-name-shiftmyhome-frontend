import { Link } from 'react-router-dom'
import JobStatusBadge from '../admin-workflow/JobStatusBadge'
import DriverLifecycleActions from './DriverLifecycleActions'
import { getDriverDisplayStatus, getDriverLifecyclePhase } from '../../lib/driverAdminLifecycle'

function statusTone(st) {
  if (st === 'Active') return 'emerald'
  if (st === 'Suspended') return 'rose'
  if (st === 'Archived') return 'violet'
  return 'slate'
}

function VerificationBadge({ label, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    sky: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tones[tone] || tones.emerald}`}
    >
      {label}
    </span>
  )
}

function driverInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

/**
 * @param {{
 *   driver: Record<string, unknown>,
 *   assigned: number,
 *   completed: number,
 *   badges: { key: string, label: string, tone: string }[],
 *   saving?: boolean,
 *   onView: () => void,
 *   onEdit: () => void,
 *   onDisable: () => void,
 *   onArchive: () => void,
 *   onReactivate: () => void,
 *   onDelete: () => void,
 * }} props
 */
export default function DriverFleetCard({
  driver: d,
  assigned,
  completed,
  badges,
  saving = false,
  onView,
  onEdit,
  onDisable,
  onArchive,
  onReactivate,
  onDelete,
}) {
  const rating = String(d.rating || '').trim() || '—'
  const notes = String(d.notes || '').trim()
  const lifecyclePhase = getDriverLifecyclePhase(d)
  const displayStatus = getDriverDisplayStatus(d)
  const vehicleLine = d.vehicleRegistration
    ? `Reg ${d.vehicleRegistration}`
    : d.vehicleType
      ? String(d.vehicleType)
      : ''

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white"
            aria-hidden
          >
            {driverInitials(d.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{d.name}</p>
            <p className="truncate text-xs text-slate-500">{d.email || 'No email'}</p>
          </div>
          <JobStatusBadge label={displayStatus} tone={statusTone(displayStatus)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums text-slate-900">{assigned}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Assigned</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums text-slate-900">{completed}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Done</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-2.5">
            <p className="truncate text-lg font-bold text-slate-900">{rating}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Rating</p>
          </div>
        </div>

        <div className="space-y-1 text-xs text-slate-600">
          {d.phone ? <p className="truncate">{d.phone}</p> : null}
          {vehicleLine ? <p className="truncate text-slate-500">{vehicleLine}</p> : null}
          <p
            className={
              d.hasLogin || d.userId
                ? lifecyclePhase === 'active'
                  ? 'font-medium text-emerald-700'
                  : 'text-slate-500'
                : 'font-medium text-amber-700'
            }
          >
            {d.hasLogin || d.userId ? 'Mobile app login' : 'No mobile login'}
            {lifecyclePhase === 'suspended' ? ' · disabled' : ''}
            {lifecyclePhase === 'archived' ? ' · archived' : ''}
          </p>
        </div>

        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <VerificationBadge key={b.key} label={b.label} tone={b.tone} />
            ))}
          </div>
        ) : null}

        {notes ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500" title={notes}>
            {notes}
          </p>
        ) : null}

        <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
          <Link
            to="/admin/driver-payments"
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Payments
          </Link>
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Edit
          </button>
        </div>

        <DriverLifecycleActions
          driver={d}
          saving={saving}
          onDisable={onDisable}
          onArchive={onArchive}
          onReactivate={onReactivate}
          onDelete={onDelete}
          showDelete={Boolean(d.id)}
          compact
        />
      </div>
    </li>
  )
}
