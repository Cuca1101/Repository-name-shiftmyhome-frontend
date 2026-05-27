import { Fragment } from 'react'
import { groupJobsByMoveDate } from '../../lib/adminJobMoveDateGroups'
import { findLinkedJobForQuote } from '../../lib/adminWorkflowFilters'
import JobAcceptedListRow from './JobAcceptedListRow'

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <th className="px-2 py-2 sm:px-3">Job</th>
      <th className="hidden px-2 py-2 md:table-cell lg:px-3">Route</th>
      <th className="hidden px-2 py-2 md:table-cell lg:px-3">Driver</th>
      <th className="hidden px-2 py-2 sm:table-cell lg:px-3">Move</th>
      <th className="hidden px-2 py-2 xl:table-cell lg:px-3">Service</th>
      <th className="px-2 py-2 lg:px-3">Status</th>
      <th className="hidden px-2 py-2 text-right sm:table-cell lg:px-3">Driver pay</th>
      <th className="px-2 py-2 text-right lg:px-3"> </th>
    </tr>
  </thead>
)

/**
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   jobs: Record<string, unknown>[],
 *   onUpdated?: () => void | Promise<void>,
 * }} props
 */
export default function JobAcceptedListTable({ quotes, jobs, onUpdated }) {
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
                  return <JobAcceptedListRow key={String(q.id)} q={q} job={job} onUpdated={onUpdated} />
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
