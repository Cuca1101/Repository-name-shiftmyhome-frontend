import { fetchAssignedByActor } from './quotesAdminRepository'
import { isSupabaseConfigured, supabase } from '../supabase'
import { normalizeDriverChargeStatus } from '../driverChargeStatus'

const TABLE = 'driver_charges'

/**
 * @param {Record<string, unknown>} row
 */
export function mapChargeRow(row) {
  const status = normalizeDriverChargeStatus(row.status)
  return {
    id: String(row.id),
    driverId: String(row.driver_id),
    quoteId: row.quote_id != null ? String(row.quote_id) : null,
    jobId: row.job_id != null ? String(row.job_id) : null,
    chargeType: String(row.charge_type || 'other'),
    amount: Number(row.amount) || 0,
    reason: String(row.reason || ''),
    notes: String(row.notes || ''),
    evidenceUrl: row.evidence_url != null ? String(row.evidence_url) : null,
    status,
    createdAt: row.created_at != null ? String(row.created_at) : null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
    paidAt: row.paid_at != null ? String(row.paid_at) : null,
    paidBy: row.paid_by != null ? String(row.paid_by) : null,
    removedAt: row.removed_at != null ? String(row.removed_at) : null,
    removedBy: row.removed_by != null ? String(row.removed_by) : null,
    removedReason: String(row.removed_reason || ''),
    statusChangedAt: row.status_changed_at != null ? String(row.status_changed_at) : null,
    statusChangedBy: row.status_changed_by != null ? String(row.status_changed_by) : null,
    statusPrevious: row.status_previous != null ? String(row.status_previous) : null,
    statusChangeNote: String(row.status_change_note || ''),
  }
}

/**
 * @returns {Promise<ReturnType<typeof mapChargeRow>[]>}
 */
export async function fetchAllDriverCharges(limit = 2000) {
  if (!isSupabaseConfigured || !supabase) return []
  const cap = Math.min(5000, Math.max(1, Math.round(Number(limit) || 2000)))
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(cap)
  if (error) throw error
  return (data || []).map(mapChargeRow)
}

/**
 * @param {string} driverId
 */
export async function fetchDriverChargesByDriverId(driverId) {
  const id = String(driverId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('driver_id', id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapChargeRow)
}

/**
 * @param {string[]} quoteIds
 */
export async function fetchDriverChargesByQuoteIds(quoteIds) {
  const ids = [...new Set((quoteIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!ids.length || !isSupabaseConfigured || !supabase) {
    return []
  }
  const { data, error } = await supabase.from(TABLE).select('*').in('quote_id', ids)
  if (error) throw error
  return (data || []).map(mapChargeRow)
}

/**
 * @param {{
 *   driverId: string,
 *   quoteId?: string | null,
 *   jobId?: string | null,
 *   chargeType: string,
 *   amount: number,
 *   reason: string,
 *   notes?: string,
 *   evidenceUrl?: string | null,
 *   status?: string,
 * }} input
 */
export async function createDriverCharge(input) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }
  const actor = await fetchAssignedByActor()
  const payload = {
    driver_id: String(input.driverId),
    quote_id: input.quoteId ? String(input.quoteId) : null,
    job_id: input.jobId ? String(input.jobId) : null,
    charge_type: String(input.chargeType || 'other'),
    amount: Math.round(Math.max(0, Number(input.amount)) * 100) / 100,
    reason: String(input.reason || '').trim(),
    notes: String(input.notes || '').trim(),
    evidence_url: input.evidenceUrl ? String(input.evidenceUrl).trim() : null,
    status: normalizeDriverChargeStatus(input.status || 'pending'),
    created_by: actor,
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (error) throw error
  return mapChargeRow(data)
}

/**
 * @param {string} chargeId
 * @param {Partial<{ status: string, notes: string, reason: string, evidenceUrl: string | null }>} patch
 */
export async function updateDriverCharge(chargeId, patch) {
  const id = String(chargeId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }
  /** @type {Record<string, unknown>} */
  const row = {}
  if (patch.status != null) {
    row.status = normalizeDriverChargeStatus(patch.status)
  }
  if (patch.notes != null) row.notes = String(patch.notes)
  if (patch.reason != null) row.reason = String(patch.reason)
  if ('evidenceUrl' in patch) row.evidence_url = patch.evidenceUrl

  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return mapChargeRow(data)
}

/**
 * @param {ReturnType<typeof mapChargeRow>} charge
 * @param {'paid'|'not_paid'|'pending'} newStatus
 * @param {string} [note]
 */
export async function setDriverChargePaymentStatus(charge, newStatus, note = '') {
  const id = String(charge?.id || '').trim()
  if (!id) throw new Error('Invalid charge.')
  const next = normalizeDriverChargeStatus(newStatus)
  if (next !== 'paid' && next !== 'not_paid' && next !== 'pending') {
    throw new Error('Invalid payment status.')
  }
  const actor = await fetchAssignedByActor()
  const now = new Date().toISOString()
  const previous = normalizeDriverChargeStatus(charge.status)

  /** @type {Record<string, unknown>} */
  const row = {
    status: next,
    status_previous: previous,
    status_changed_at: now,
    status_changed_by: actor,
    status_change_note: String(note || '').trim(),
    resolved_at: now,
  }

  if (next === 'paid') {
    row.paid_at = now
    row.paid_by = actor
  } else {
    row.paid_at = null
    row.paid_by = null
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }

  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return mapChargeRow(data)
}

/**
 * Soft-remove charge (status removed + audit; never deletes row).
 * @param {ReturnType<typeof mapChargeRow>} charge
 * @param {string} removalReason
 */
export async function removeDriverCharge(charge, removalReason) {
  const id = String(charge?.id || '').trim()
  const reason = String(removalReason || '').trim()
  if (!id) throw new Error('Invalid charge.')
  if (!reason) throw new Error('Removal reason is required.')

  const actor = await fetchAssignedByActor()
  const now = new Date().toISOString()
  const previous = normalizeDriverChargeStatus(charge.status)

  /** @type {Record<string, unknown>} */
  const row = {
    status: 'removed',
    status_previous: previous,
    status_changed_at: now,
    status_changed_by: actor,
    status_change_note: reason,
    removed_at: now,
    removed_by: actor,
    removed_reason: reason,
    resolved_at: now,
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }

  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return mapChargeRow(data)
}
