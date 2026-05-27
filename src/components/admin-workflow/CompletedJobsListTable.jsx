import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { groupJobsByMoveDate } from '../../lib/adminJobMoveDateGroups'
import { findLinkedJobForQuote } from '../../lib/adminWorkflowFilters'
import { completedJobDisplayFields, formatAdminMoney } from '../../lib/adminTerminalJobsDisplay'
import { MANUAL_PAYOUT_CONFIRMED_LABEL } from '../../lib/jobAcceptedPaymentDisplay'
import JobStatusBadge from './JobStatusBadge'

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <th className="px-2 py-2 sm:px-3">Job</th>
      <th className="hidden px-2 py-2 md:table-cell lg:px-3">Driver</th>
      <th className="hidden px-2 py-2 text-right sm:table-cell lg:px-3">Customer</th>
      <th className="px-2 py-2 text-right lg:px-3">Driver pay</th>
      <th className="hidden px-2 py-2 text-right lg:table-cell lg:px-3">Platform</th>
      <th className="hidden px-2 py-2 lg:table-cell lg:px-3">Completed</th>
      <th className="px-2 py-2 lg:px-3">Payment</th>
      <th className="px-2 py-2 text-right lg:px-3"> </th>
    </tr>
  </thead>
)

/**
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   jobs: Record<string, unknown>[],
 * }} props
 */
export default function CompletedJobsListTable({ quotes, jobs }) {
  const sections = groupJobsByMoveDate(quotes)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          {TABLE_HEAD}
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.key}>
                <tr className="bg-slate-100/80">
                  <td colSpan={8} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {section.label}
                  </td>
                </tr>
                {section.jobs.map((q) => {
                  const job = findLinkedJobForQuote(q, jobs)
                  const row = completedJobDisplayFields(q, job)
                  const href = `/admin/active-jobs/${encodeURIComponent(String(q.id))}`
                  return (
                    <tr key={String(q.id)} className="border-b border-slate-100 hover:bg-slate-50/90">
                      <td className="px-2 py-2 sm:px-3">
                        <Link to={href} className="font-mono text-[11px] font-bold text-brand-700 hover:underline">
                          {row.quoteRef}
                        </Link>
                        <p className="truncate text-xs font-semibold text-slate-900">{row.customer}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600 md:hidden">{row.driver}</p>
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-800 md:table-cell lg:px-3">
                        {row.driver}
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums text-[11px] sm:table-cell lg:px-3">
                        {formatAdminMoney(row.customerTotal)}
                      </td>
                      <td className="px-2 py-2 text-right align-top lg:px-3">
                        <p className="tabular-nums text-[11px] font-semibold text-violet-900">
                          {formatAdminMoney(row.driverPayout)}
                        </p>
                        {row.manualOverride ? (
                          <span className="mt-0.5 inline-flex rounded bg-violet-100 px-1 py-px text-[9px] font-bold uppercase text-violet-900">
                            {MANUAL_PAYOUT_CONFIRMED_LABEL}
                          </span>
                        ) : null}
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums text-[11px] text-emerald-800 lg:table-cell lg:px-3">
                        {formatAdminMoney(row.platformProfit)}
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-700 lg:table-cell lg:px-3">
                        {row.completedAtDisplay}
                      </td>
                      <td className="px-2 py-2">
                        <JobStatusBadge label={row.paymentStatus} tone="slate" />
                      </td>
                      <td className="px-2 py-2 text-right lg:px-3">
                        <Link
                          to={href}
                          className="inline-flex min-h-[28px] items-center justify-center rounded-md bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
