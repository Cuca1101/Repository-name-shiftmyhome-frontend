import { fetchAssignedByActor } from './quotesAdminRepository'
import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'driver_payout_audit_log'
const SESSION_KEY = 'smh_driver_payout_audit_v1'

/**
 * @param {Record<string, unknown>} row
 */
function mapAuditRow(row) {
  return {
    id: String(row.id),
    quoteId: row.quote_id != null ? String(row.quote_id) : null,
    quoteRef: String(row.quote_ref || ''),
    driverId: row.driver_id != null ? String(row.driver_id) : null,
    driverName: String(row.driver_name || ''),
    action: String(row.action || 'manual_override'),
    defaultPayoutGbp: row.default_payout_gbp != null ? Number(row.default_payout_gbp) : null,
    newPayoutGbp: row.new_payout_gbp != null ? Number(row.new_payout_gbp) : null,
    differenceGbp: row.difference_gbp != null ? Number(row.difference_gbp) : null,
    reason: String(row.reason || ''),
    adminEmail: row.admin_email != null ? String(row.admin_email) : null,
    createdAt: row.created_at != null ? String(row.created_at) : null,
  }
}

function readSessionAudits() {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(mapAuditRow) : []
  } catch {
    return []
  }
}

function appendSessionAudit(entry) {
  if (typeof sessionStorage === 'undefined') return
  const all = readSessionAudits()
  all.unshift({
    id: `local-${Date.now()}`,
    ...entry,
    createdAt: new Date().toISOString(),
  })
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(all.slice(0, 500)))
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<ReturnType<typeof mapAuditRow>[]>}
 */
export async function fetchAllDriverPayoutAudits(limit = 2000) {
  if (!isSupabaseConfigured || !supabase) {
    return readSessionAudits()
  }
  const cap = Math.min(5000, Math.max(1, Math.round(Number(limit) || 2000)))
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(cap)
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverPayoutAudit] fetch failed', error.message)
    }
    return readSessionAudits()
  }
  try {
    return (data || []).map(mapAuditRow)
  } catch {
    return readSessionAudits()
  }
}

/**
 * Latest manual-override audit row per quote (auditLogs must be newest-first).
 * @param {ReturnType<typeof mapAuditRow>[]} auditLogs
 */
export function buildLatestManualPayoutAuditByQuoteId(auditLogs) {
  /** @type {Map<string, ReturnType<typeof mapAuditRow>>} */
  const map = new Map()
  if (!Array.isArray(auditLogs)) return map
  for (const a of auditLogs) {
    if (!a || typeof a !== 'object') continue
    if (a.action !== 'manual_override' || !a.quoteId) continue
    const qid = String(a.quoteId)
    if (!map.has(qid)) map.set(qid, a)
  }
  return map
}

/**
 * @param {string} quoteId
 * @returns {Promise<ReturnType<typeof mapAuditRow> | null>}
 */
export async function fetchLatestDriverPayoutAuditForQuote(quoteId) {
  const id = String(quoteId || '').trim()
  if (!id) return null

  const fromSession = () =>
    readSessionAudits().find((a) => a.quoteId === id && a.action === 'manual_override') || null

  if (!isSupabaseConfigured || !supabase) {
    return fromSession()
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('quote_id', id)
    .eq('action', 'manual_override')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverPayoutAudit] quote fetch failed', error.message)
    }
    return fromSession()
  }

  if (data) return mapAuditRow(data)
  return fromSession()
}

/**
 * @param {{
 *   quoteId: string,
 *   quoteRef: string,
 *   driverId?: string | null,
 *   driverName: string,
 *   action: 'manual_override' | 'reset_to_default',
 *   defaultPayoutGbp?: number | null,
 *   newPayoutGbp?: number | null,
 *   reason?: string,
 * }} input
 */
export async function recordDriverPayoutAudit(input) {
  const defaultPayout = input.defaultPayoutGbp != null ? Number(input.defaultPayoutGbp) : null
  const newPayout = input.newPayoutGbp != null ? Number(input.newPayoutGbp) : null
  const difference =
    defaultPayout != null && newPayout != null
      ? Math.round((newPayout - defaultPayout) * 100) / 100
      : null

  const actor = await fetchAssignedByActor()
  const entry = {
    quoteId: String(input.quoteId),
    quoteRef: String(input.quoteRef || ''),
    driverId: input.driverId ? String(input.driverId) : null,
    driverName: String(input.driverName || ''),
    action: input.action,
    defaultPayoutGbp: defaultPayout,
    newPayoutGbp: newPayout,
    differenceGbp: difference,
    reason: String(input.reason || '').trim(),
    adminEmail: actor,
  }

  if (!isSupabaseConfigured || !supabase) {
    appendSessionAudit(entry)
    return entry
  }

  const payload = {
    quote_id: entry.quoteId,
    quote_ref: entry.quoteRef,
    driver_id: entry.driverId,
    driver_name: entry.driverName,
    action: entry.action,
    default_payout_gbp: defaultPayout,
    new_payout_gbp: newPayout,
    difference_gbp: difference,
    reason: entry.reason,
    admin_email: actor,
  }

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (error) {
    appendSessionAudit(entry)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverPayoutAudit] insert failed', error.message)
    }
    return entry
  }
  return mapAuditRow(data)
}
