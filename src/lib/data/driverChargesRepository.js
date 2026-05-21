import { fetchAssignedByActor } from './quotesAdminRepository'
import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'driver_charges'

/**
 * @param {Record<string, unknown>} row
 */
function mapChargeRow(row) {
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
    status: String(row.status || 'pending').toLowerCase(),
    createdAt: row.created_at != null ? String(row.created_at) : null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
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
  if (!ids.length || !isSupabaseConfigured || !supabase) return []
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
    status: String(input.status || 'pending').toLowerCase(),
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
    row.status = String(patch.status).toLowerCase()
    if (row.status === 'waived' || row.status === 'cancelled' || row.status === 'applied') {
      row.resolved_at = new Date().toISOString()
    }
  }
  if (patch.notes != null) row.notes = String(patch.notes)
  if (patch.reason != null) row.reason = String(patch.reason)
  if ('evidenceUrl' in patch) row.evidence_url = patch.evidenceUrl

  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return mapChargeRow(data)
}
