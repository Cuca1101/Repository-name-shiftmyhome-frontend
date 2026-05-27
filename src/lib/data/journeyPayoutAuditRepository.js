import { fetchAssignedByActor } from './quotesAdminRepository'
import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'journey_payout_audit_log'
const SESSION_KEY = 'smh_journey_payout_audit_v1'

/**
 * @param {Record<string, unknown>} row
 */
function mapRow(row) {
  return {
    id: String(row.id),
    journeyId: row.journey_id != null ? String(row.journey_id) : null,
    journeyRef: String(row.journey_ref || ''),
    action: String(row.action || ''),
    oldJourneyPayoutGbp: row.old_journey_payout_gbp != null ? Number(row.old_journey_payout_gbp) : null,
    newJourneyPayoutGbp: row.new_journey_payout_gbp != null ? Number(row.new_journey_payout_gbp) : null,
    oldPerJobPayouts: row.old_per_job_payouts && typeof row.old_per_job_payouts === 'object' ? row.old_per_job_payouts : {},
    newPerJobPayouts: row.new_per_job_payouts && typeof row.new_per_job_payouts === 'object' ? row.new_per_job_payouts : {},
    jobChange: String(row.job_change || ''),
    reason: String(row.reason || ''),
    adminEmail: row.admin_email != null ? String(row.admin_email) : null,
    createdAt: row.created_at != null ? String(row.created_at) : null,
  }
}

function readSession() {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(mapRow) : []
  } catch {
    return []
  }
}

function appendSession(entry) {
  if (typeof sessionStorage === 'undefined') return
  const all = readSession()
  all.unshift({ id: `local-${Date.now()}`, ...entry, createdAt: new Date().toISOString() })
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(all.slice(0, 300)))
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   journeyId?: string | null,
 *   journeyRef?: string,
 *   action: string,
 *   oldJourneyPayoutGbp?: number | null,
 *   newJourneyPayoutGbp?: number | null,
 *   oldPerJobPayouts?: Record<string, number> | null,
 *   newPerJobPayouts?: Record<string, number> | null,
 *   jobChange?: string,
 *   reason?: string,
 * }} entry
 */
export async function recordJourneyPayoutAudit(entry) {
  const adminEmail = (await fetchAssignedByActor()) || 'admin'
  const payload = {
    journey_id: entry.journeyId || null,
    journey_ref: entry.journeyRef || '',
    action: entry.action,
    old_journey_payout_gbp: entry.oldJourneyPayoutGbp ?? null,
    new_journey_payout_gbp: entry.newJourneyPayoutGbp ?? null,
    old_per_job_payouts: entry.oldPerJobPayouts || null,
    new_per_job_payouts: entry.newPerJobPayouts || null,
    job_change: entry.jobChange || '',
    reason: entry.reason || '',
    admin_email: adminEmail,
  }

  if (!isSupabaseConfigured || !supabase) {
    appendSession({
      journeyId: payload.journey_id,
      journeyRef: payload.journey_ref,
      action: payload.action,
      oldJourneyPayoutGbp: payload.old_journey_payout_gbp,
      newJourneyPayoutGbp: payload.new_journey_payout_gbp,
      oldPerJobPayouts: payload.old_per_job_payouts || {},
      newPerJobPayouts: payload.new_per_job_payouts || {},
      jobChange: payload.job_change,
      reason: payload.reason,
      adminEmail: payload.admin_email,
    })
    return
  }

  const { error } = await supabase.from(TABLE).insert(payload)
  if (error) {
    appendSession({
      journeyId: payload.journey_id,
      journeyRef: payload.journey_ref,
      action: payload.action,
      oldJourneyPayoutGbp: payload.old_journey_payout_gbp,
      newJourneyPayoutGbp: payload.new_journey_payout_gbp,
      oldPerJobPayouts: payload.old_per_job_payouts || {},
      newPerJobPayouts: payload.new_per_job_payouts || {},
      jobChange: payload.job_change,
      reason: payload.reason,
      adminEmail: payload.admin_email,
    })
  }
}
