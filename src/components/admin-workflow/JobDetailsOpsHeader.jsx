import { Link } from 'react-router-dom'
import JobStatusBadge from './JobStatusBadge'
import { isQuoteDemoOrTest } from '../../lib/demoTestRecordDetection'
import { showDemoAdminUi } from '../../lib/adminProductionMode'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

function paymentTone(ps) {
  const p = String(ps || '').toLowerCase()
  if (p === 'paid') return 'emerald'
  if (p === 'deposit_paid') return 'sky'
  return 'slate'
}

function CustomerAvatar() {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-md ring-4 ring-white sm:h-16 sm:w-16"
      aria-hidden
    >
      <svg className="h-7 w-7 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="8" r="3.5" />
      </svg>
    </div>
  )
}

function RouteFlow({ vm }) {
  if (!vm) return null
  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">Pickup</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{vm.pickupCity}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{vm.pickupAddressShort}</p>
        </div>
        <div className="flex shrink-0 items-center justify-center text-slate-300 sm:px-2" aria-hidden>
          <svg className="h-6 w-6 rotate-90 sm:rotate-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.172 12 8.222 7.05l1.415-1.414L16 12l-6.364 6.364-1.415-1.414z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Delivery</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{vm.deliveryCity}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{vm.deliveryAddressShort}</p>
        </div>
      </div>
      <p className="mt-3 border-t border-slate-200/80 pt-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Route:</span>{' '}
        {vm.distanceDisplay !== '—' ? `${vm.distanceDisplay}` : 'Distance not recorded'}
        {vm.arrivalLine && vm.arrivalLine !== '—' ? (
          <span className="text-slate-500"> · Window: {vm.arrivalLine}</span>
        ) : null}
      </p>
    </div>
  )
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   vm: Record<string, unknown> | null,
 *   fin: { customerTotal: number|null, paid: number, remaining: number|null } | null,
 *   workflowBadge: { label: string, tone?: string },
 *   overrides: Record<string, unknown>,
 *   backHref: string,
 *   backLabel: string,
 *   children?: React.ReactNode,
 * }} props
 */
export default function JobDetailsOpsHeader({
  q,
  vm,
  fin,
  workflowBadge,
  overrides,
  backHref,
  backLabel,
  children,
}) {
  const driverLabel = String(q.assigned_driver_name || overrides.assignedDriver || '').trim()
  const opStatus = String(overrides.operationalStatus || q.operational_status || '').trim()

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)]">
      <nav className="border-b border-slate-100 bg-slate-900/[0.03] px-4 py-2.5 sm:px-6" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <li>
            <Link to={backHref} className="text-brand-700 transition hover:text-brand-800 hover:underline">
              {backLabel}
            </Link>
          </li>
          <li className="text-slate-300" aria-hidden>
            /
          </li>
          <li className="font-semibold text-slate-800">Operations · Job control</li>
        </ol>
      </nav>

      <div className="p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <CustomerAvatar />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                  {String(q.quote_ref || q.id)}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {q.full_name || 'Customer'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>
                    <span className="font-medium text-slate-500">Move</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {q.move_date ? formatDateUK(q.move_date) : '—'}
                    </span>
                  </span>
                  <span className="hidden text-slate-300 sm:inline">·</span>
                  <span className="text-xs sm:text-sm">{formatDateTimeUK(q.created_at)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {vm?.serviceLabel ? (
                    <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
                      {String(vm.serviceLabel)}
                    </span>
                  ) : null}
                  {vm?.volumeLine && vm.volumeLine !== '—' ? (
                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm">
                      {String(vm.volumeLine)}
                    </span>
                  ) : null}
                  {vm?.crewDisplay && vm.crewDisplay !== '—' ? (
                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm">
                      Crew {String(vm.crewDisplay)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <JobStatusBadge label={workflowBadge.label} tone={workflowBadge.tone} />
                  <JobStatusBadge
                    label={String(q.payment_status || 'unpaid').replace(/_/g, ' ')}
                    tone={paymentTone(q.payment_status)}
                  />
                  {opStatus ? <JobStatusBadge label={opStatus} tone="sky" /> : null}
                  {driverLabel ? (
                    <JobStatusBadge label={`Driver · ${driverLabel}`} tone="emerald" />
                  ) : (
                    <JobStatusBadge label="No driver" tone="amber" />
                  )}
                  {showDemoAdminUi() && isQuoteDemoOrTest(q) ? (
                    <JobStatusBadge label="Test record" tone="slate" />
                  ) : null}
                </div>
              </div>
            </div>

            <RouteFlow vm={vm} />
          </div>

          <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[min(100%,340px)]">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                  {fin?.customerTotal != null ? money(fin.customerTotal) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Paid</p>
                <p className="mt-1 text-base font-bold tabular-nums text-emerald-700">{money(fin?.paid)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Balance</p>
                <p className="mt-1 text-base font-bold tabular-nums text-amber-800">
                  {fin?.remaining != null ? money(fin.remaining) : '—'}
                </p>
              </div>
            </div>

            {children ? (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 xl:border-t-0 xl:pt-0">
                {children}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
