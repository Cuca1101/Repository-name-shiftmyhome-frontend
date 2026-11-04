import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Pencil, Phone, UserRound, Wallet } from 'lucide-react'
import JobStatusBadge from '../admin-workflow/JobStatusBadge'
import DriverLifecycleActions from './DriverLifecycleActions'
import { teamsCallLink } from '../../lib/teamsPhone'

function statusTone(label) {
  if (label === 'Active') return 'emerald'
  if (label === 'On Duty') return 'sky'
  if (label === 'Suspended') return 'rose'
  if (label === 'Archived') return 'violet'
  if (label === 'Offline') return 'slate'
  return 'slate'
}

function VerificationBadge({ label, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    sky: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tones[tone] || tones.emerald}`}>
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

function money(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

const iconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * @param {{
 *   driver: Record<string, unknown>,
 *   assigned: number,
 *   completed: number,
 *   cancelled: number,
 *   earnings: number | null,
 *   accountStatus: string,
 *   dutyStatus?: string | null,
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
  cancelled,
  earnings,
  accountStatus,
  dutyStatus = null,
  badges,
  saving = false,
  onView,
  onEdit,
  onDisable,
  onArchive,
  onReactivate,
  onDelete,
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const [callError, setCallError] = useState('')
  const rating = String(d.rating || '').trim()
  const notes = String(d.notes || '').trim()
  const phone = String(d.phone || '').trim()
  const email = String(d.email || '').trim()
  const photo = String(d.profilePhotoUrl || '').trim()
  const showPhoto = Boolean(photo) && !photoFailed
  const call = phone ? teamsCallLink(phone) : null
  const vehicleLine = d.vehicleRegistration
    ? `Reg ${d.vehicleRegistration}`
    : d.vehicleType
      ? String(d.vehicleType)
      : ''
  const stats = [
    { label: 'Assigned', value: String(assigned) },
    { label: 'Completed', value: String(completed) },
    { label: 'Cancelled', value: String(cancelled) },
    { label: 'Rating', value: rating || '—' },
    { label: 'Earnings', value: money(earnings) },
  ]

  return (
    <li
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-card"
      onClick={onView}
    >
      <div className="flex items-center gap-2.5 px-3 pt-3">
        {showPhoto ? (
          <img
            src={photo}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white"
            aria-hidden
          >
            {driverInitials(d.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-950">{d.name}</p>
            <JobStatusBadge label={accountStatus} tone={statusTone(accountStatus)} />
            {dutyStatus ? <JobStatusBadge label={dutyStatus} tone={statusTone(dutyStatus)} /> : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {[phone || 'No phone', email || 'No email', vehicleLine].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <dl className="mx-3 mt-2 grid grid-cols-5 gap-1 rounded-lg bg-slate-50 px-1.5 py-1.5">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <dd className="truncate text-xs font-bold tabular-nums text-slate-950">{stat.value}</dd>
            <dt className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {badges.length > 0 || notes ? (
        <div className="mx-3 mt-1.5 flex min-w-0 items-center gap-1">
          {badges.map((b) => (
            <VerificationBadge key={b.key} label={b.label} tone={b.tone} />
          ))}
          {notes ? (
            <p className="min-w-0 flex-1 truncate text-[11px] text-slate-500" title={notes}>
              {notes}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1 border-t border-slate-100 px-2 py-1.5" onClick={(event) => event.stopPropagation()}>
        {call?.ok ? (
          <a href={call.href} target="_blank" rel="noopener noreferrer" className={iconButton} title="Call" aria-label="Call">
            <Phone className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <button
            type="button"
            className={iconButton}
            title="Call"
            aria-label="Call"
            onClick={() => setCallError(call?.error || 'No phone number on this driver.')}
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <Link
          to={`/admin/driver-messages?driver=${encodeURIComponent(String(d.id || ''))}`}
          className={iconButton}
          title="Message"
          aria-label="Message"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button type="button" onClick={onView} className={iconButton} title="View profile" aria-label="View profile">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" onClick={onEdit} className={`${iconButton} text-slate-900`} title="Edit driver" aria-label="Edit driver">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <Link
          to={`/admin/driver-payments?driver=${encodeURIComponent(String(d.id || ''))}`}
          className={iconButton}
          title="Payments"
          aria-label="Payments"
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <span className={`ml-auto truncate text-[10px] font-medium ${d.hasLogin || d.userId ? 'text-emerald-700' : 'text-amber-700'}`}>
          {d.hasLogin || d.userId ? 'App login' : 'No login'}
        </span>
      </div>
      {callError ? <p className="px-3 pb-1 text-[11px] text-amber-900">{callError}</p> : null}
      <div className="px-2 pb-2" onClick={(event) => event.stopPropagation()}>
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
