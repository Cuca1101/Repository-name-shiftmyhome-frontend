import { buildAdminLiveStage, confirmedJourneyLabel } from '../../lib/jobDispatchTimeline'
import LiveStageSummary from '../tracking/LiveStageSummary'

/**
 * Admin live stage for the driver app sequence.
 * Accepted, then Collection and Delivery. Each address has Start, automatic
 * Arrived, and Complete. Timers use the saved arrival and completion stamps.
 *
 * @param {{
 *   q: Record<string, unknown>,
 *   overrides?: Record<string, unknown>,
 *   linkedJob?: Record<string, unknown> | null,
 *   assignment?: { status?: string, updated_at?: string, completed_at?: string } | null,
 *   workflow?: { workflow_status?: string, workflow_at?: string } | null,
 *   statusHistory?: Array<Record<string, unknown>>,
 * }} props
 */
export default function JobDispatchOpsTimeline({
  q,
  linkedJob = null,
  assignment = null,
  workflow = null,
  statusHistory = [],
}) {
  const derived = buildAdminLiveStage(q, statusHistory, linkedJob, assignment)
  const confirmed = derived.currentLabel.includes('·')
    ? ''
    : confirmedJourneyLabel(workflow?.operational_status || q?.operational_status)
  const stage = confirmed ? { ...derived, currentLabel: confirmed } : derived

  return (
    <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
      <LiveStageSummary stage={stage} />
    </div>
  )
}
