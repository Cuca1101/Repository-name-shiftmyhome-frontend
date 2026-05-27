import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'
import { updateJourneyRow } from './data/journeysRepository'
import { recordJourneyPayoutAudit } from './data/journeyPayoutAuditRepository'
import { round2, uniqueJourneyQuoteIds } from './journeyPayoutSplit'

/**
 * Persist journey total + per-job driver payouts (already driver offer — no platform deduction).
 *
 * @param {{
 *   journeyId: string,
 *   totalPayout: number,
 *   byQuoteId: Record<string, number>,
 *   manualQuoteIds?: Set<string> | string[],
 *   reason?: string,
 *   auditAction?: string,
 *   previousTotal?: number | null,
 *   previousByQuoteId?: Record<string, number>,
 *   jobAddedOrRemoved?: string,
 * }} opts
 */
export async function applyJourneyPayoutToQuotes(opts) {
  const journeyId = String(opts.journeyId || '').trim()
  if (!journeyId) return

  const total = round2(opts.totalPayout)
  const byQuoteId = opts.byQuoteId || {}
  const manualSet = opts.manualQuoteIds instanceof Set
    ? opts.manualQuoteIds
    : new Set(Array.isArray(opts.manualQuoteIds) ? opts.manualQuoteIds : [])

  const ids = uniqueJourneyQuoteIds(Object.keys(byQuoteId))

  for (const qid of ids) {
    const amt = byQuoteId[qid]
    if (!Number.isFinite(amt)) continue
    await updateQuoteWorkflowAssignmentSilent(qid, {
      driver_payout_amount: round2(amt),
      driver_payout_manual_override: manualSet.has(qid),
      bundled_journey_id: journeyId,
      marketplace_payout_price: round2(amt),
    })
  }

  await updateJourneyRow(journeyId, {
    marketplace_payout_price: total,
    journey_payout_manually_set: true,
  })

  await recordJourneyPayoutAudit({
    journeyId,
    action: opts.auditAction || 'journey_payout_update',
    oldJourneyPayoutGbp: opts.previousTotal ?? null,
    newJourneyPayoutGbp: total,
    oldPerJobPayouts: opts.previousByQuoteId ?? null,
    newPerJobPayouts: byQuoteId,
    jobChange: opts.jobAddedOrRemoved ?? '',
    reason: opts.reason || 'Journey driver payout updated',
  })
}
