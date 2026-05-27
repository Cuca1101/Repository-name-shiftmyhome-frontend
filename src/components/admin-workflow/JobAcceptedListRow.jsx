import { Link } from 'react-router-dom'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatVolumeAndCrew } from '../../lib/quoteJobAdminModel'
import { dispatchWorkflowBadge } from '../../lib/jobDispatchTimeline'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'
import { resolveAssignedDriverDisplay } from '../../lib/adminJobAcceptedStatus'
import { getFleetDriversCached } from '../../lib/adminFleetDrivers'
import JobStatusBadge from './JobStatusBadge'
import JobAcceptedListPayoutSummary from './JobAcceptedListPayoutSummary'

function shortRoute(from, to, max = 36) {
  const f = from.length > max ? `${from.slice(0, max - 1)}…` : from
  const t = to.length > max ? `${to.slice(0, max - 1)}…` : to
  return `${f} → ${t}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   job?: Record<string, unknown> | null,
 *   onUpdated?: () => void | Promise<void>,
 * }} props
 */
export default function JobAcceptedListRow({ q, job = null, onUpdated }) {
  const id = String(q.id || '')
  const href = `/admin/active-jobs/${encodeURIComponent(id)}`
  const ref = String(q.quote_ref || id.slice(0, 8))
  const customer = String(q.full_name || '—')
  const collection = resolveQuoteCollectionAddress(q, job)
  const delivery = resolveQuoteDeliveryAddress(q, job)
  const driverId = q.assigned_driver_id != null ? String(q.assigned_driver_id) : ''
  const driverRec = driverId ? getFleetDriversCached().find((d) => String(d.id) === driverId) ?? null : null
  const driver = resolveAssignedDriverDisplay(q, driverRec)
  const badge = dispatchWorkflowBadge(q, job)
  const moveDate = q.move_date ? formatDateUK(q.move_date) : '—'
  const service = String(q.service || q.service_type || '—')
  const volCrew = formatVolumeAndCrew(q)

  return (
    <tr className="group border-b border-slate-100 bg-white transition hover:bg-slate-50/90">
      <td className="px-2 py-2 sm:px-3">
        <Link to={href} className="block min-w-0 font-mono text-[11px] font-bold text-brand-700 hover:underline">
          {ref}
        </Link>
        <p className="truncate text-xs font-semibold text-slate-900">{customer}</p>
        <p className="mt-0.5 text-[10px] text-slate-700 md:hidden">
          <span className="font-semibold text-slate-600">Driver:</span>{' '}
          <span className="font-semibold text-slate-900">{driver.name || driver.partner || '—'}</span>
        </p>
        <div className="mt-1 sm:hidden">
          <JobAcceptedListPayoutSummary q={q} onUpdated={onUpdated} />
        </div>
      </td>
      <td className="hidden min-w-0 px-2 py-2 md:table-cell lg:px-3">
        <Link to={href} className="block text-[11px] leading-snug text-slate-700 hover:text-slate-900" title={`${collection} → ${delivery}`}>
          {shortRoute(collection, delivery, 42)}
        </Link>
      </td>
      <td className="hidden min-w-[7rem] px-2 py-2 md:table-cell lg:px-3">
        <p className="text-[11px] leading-snug text-slate-800">
          <span className="font-semibold text-slate-600">Driver:</span>{' '}
          <span className="font-semibold text-slate-900">{driver.name || (driver.partner ? driver.partner : '—')}</span>
        </p>
        {driver.phone ? (
          <p className="truncate text-[10px] text-slate-500" title={driver.phone}>
            {driver.phone}
          </p>
        ) : driver.email ? (
          <p className="truncate text-[10px] text-slate-500" title={driver.email}>
            {driver.email}
          </p>
        ) : null}
      </td>
      <td className="hidden px-2 py-2 sm:table-cell lg:px-3">
        <p className="text-[11px] text-slate-800">{moveDate}</p>
        <p className="truncate text-[10px] text-slate-500">{volCrew}</p>
      </td>
      <td className="hidden px-2 py-2 xl:table-cell lg:px-3">
        <p className="truncate text-[11px] text-slate-600">{service}</p>
      </td>
      <td className="px-2 py-2 lg:px-3">
        <JobStatusBadge label={badge.label} tone={badge.tone} />
      </td>
      <td className="hidden min-w-[6.5rem] px-2 py-2 align-top sm:table-cell lg:px-3">
        <JobAcceptedListPayoutSummary q={q} onUpdated={onUpdated} />
      </td>
      <td className="px-2 py-2 text-right align-top lg:px-3">
        <Link
          to={href}
          className="inline-flex min-h-[28px] items-center justify-center rounded-md bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800"
        >
          View
        </Link>
      </td>
    </tr>
  )
}
