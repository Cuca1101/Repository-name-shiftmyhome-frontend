import { Fragment } from 'react'
import { groupJobsByMoveDate } from '../../lib/adminJobMoveDateGroups'

const LIST_HEADER = (
  <div
    className="mb-2 hidden rounded-lg border border-slate-200/80 bg-slate-50/90 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[minmax(0,14rem)_1fr_auto] lg:items-center lg:gap-4"
    aria-hidden
  >
    <span>Customer & move</span>
    <span>Route & service</span>
    <span className="text-right">Finance & action</span>
  </div>
)

/**
 * @param {{
 *   jobs: Record<string, unknown>[],
 *   viewMode: 'list' | 'grid',
 *   renderJob: (q: Record<string, unknown>) => import('react').ReactNode,
 *   showListColumnHeader?: boolean,
 * }} props
 */
export default function AdminJobListSections({
  jobs,
  viewMode,
  renderJob,
  showListColumnHeader = true,
}) {
  if (viewMode === 'grid') {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {jobs.map((q) => (
          <Fragment key={String(q.id)}>{renderJob(q)}</Fragment>
        ))}
      </ul>
    )
  }

  const sections = groupJobsByMoveDate(jobs)

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="min-w-0">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">{section.label}</h3>
          {showListColumnHeader ? LIST_HEADER : null}
          <ul className="flex min-w-0 flex-col gap-2">
            {section.jobs.map((q) => (
              <Fragment key={String(q.id)}>{renderJob(q)}</Fragment>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
