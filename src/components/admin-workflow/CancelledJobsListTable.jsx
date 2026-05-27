import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { groupJobsByMoveDate } from '../../lib/adminJobMoveDateGroups'
import { findLinkedJobForQuote } from '../../lib/adminWorkflowFilters'
import { cancelledJobDisplayFields } from '../../lib/adminTerminalJobsDisplay'

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <th className="px-2 py-2 sm:px-3">Job</th>
      <th className="hidden px-2 py-2 md:table-cell lg:px-3">Driver</th>
      <th className="px-2 py-2 lg:px-3">Cancelled</th>
      <th className="hidden px-2 py-2 lg:table-cell lg:px-3">By</th>
      <th className="px-2 py-2 lg:px-3">Reason</th>
      <th className="hidden px-2 py-2 xl:table-cell lg:px-3">Charges</th>
      <th className="px-2 py-2 text-right lg:px-3"> </th>
    </tr>
  </thead>
)

/**
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   jobs: Record<string, unknown>[],
 *   charges?: Array<Record<string, unknown>>,
 * }} props
 */
export default function CancelledJobsListTable({ quotes, jobs, charges = [] }) {
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
                  <td colSpan={7} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {section.label}
                  </td>
                </tr>
                {section.jobs.map((q) => {
                  const job = findLinkedJobForQuote(q, jobs)
                  const row = cancelledJobDisplayFields(q, job, charges)
                  const href = `/admin/available-jobs/${encodeURIComponent(String(q.id))}`
                  return (
                    <tr key={String(q.id)} className="border-b border-slate-100 hover:bg-slate-50/90">
                      <td className="px-2 py-2 sm:px-3">
                        <Link to={href} className="font-mono text-[11px] font-bold text-brand-700 hover:underline">
                          {row.quoteRef}
                        </Link>
                        <p className="truncate text-xs font-semibold text-slate-900">{row.customer}</p>
                      </td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-800 md:table-cell lg:px-3">
                        {row.driver}
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-700">{row.cancelledAtDisplay}</td>
                      <td className="hidden px-2 py-2 text-[11px] text-slate-600 lg:table-cell lg:px-3">
                        {row.cancelledBy}
                      </td>
                      <td className="max-w-[14rem] px-2 py-2 text-[11px] text-slate-800">{row.reason}</td>
                      <td className="hidden max-w-[12rem] px-2 py-2 text-[10px] text-rose-800 xl:table-cell lg:px-3">
                        {row.chargeSummary}
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
