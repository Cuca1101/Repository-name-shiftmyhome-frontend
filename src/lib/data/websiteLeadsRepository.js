import { isSupabaseConfigured, supabase } from '../supabase'
import { getWebsiteLeadSessionId } from '../websiteLeadSession'

const TABLE = 'website_leads'
const ABANDON_MS = 30 * 60 * 1000

/** @typedef {'visited'|'quote_started'|'step_completed'|'quote_abandoned'|'quote_completed'|'payment_started'|'payment_completed'} WebsiteLeadStatus */

/**
 * @param {string} lastActivityAt
 * @returns {boolean}
 */
export function isWebsiteLeadAbandoned(lastActivityAt) {
  const t = new Date(lastActivityAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t > ABANDON_MS
}

/**
 * Derive display status (abandoned is computed, not written by the client).
 * @param {{ status: string, last_activity_at: string }} row
 * @returns {WebsiteLeadStatus}
 */
export function effectiveWebsiteLeadStatus(row) {
  const raw = String(row?.status || 'visited')
  if (raw === 'quote_completed' || raw === 'payment_started' || raw === 'payment_completed') {
    return /** @type {WebsiteLeadStatus} */ (raw)
  }
  if (
    (raw === 'quote_started' || raw === 'step_completed') &&
    isWebsiteLeadAbandoned(row.last_activity_at)
  ) {
    return 'quote_abandoned'
  }
  return /** @type {WebsiteLeadStatus} */ (raw)
}

/**
 * @param {Record<string, unknown>} patch fields for upsert (no passwords/card data)
 * @param {string} [sessionId]
 */
export async function upsertWebsiteLead(patch, sessionId) {
  if (!isSupabaseConfigured || !supabase) return null
  const sid = (sessionId || getWebsiteLeadSessionId()).trim()
  if (!sid) return null

  const payload = { ...patch }
  if (payload.estimated_total != null) {
    payload.estimated_total = Number(payload.estimated_total)
  }

  const { data, error } = await supabase.rpc('upsert_website_lead', {
    p_session_id: sid,
    p_payload: payload,
  })

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[website_leads] upsert failed', error.message)
    }
    return null
  }
  return data
}

/**
 * @param {{ filter?: string, cityRoute?: string, search?: string }} [opts]
 */
export async function fetchWebsiteLeadsForAdmin(opts = {}) {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('last_activity_at', { ascending: false })
    .limit(500)
  if (error) {
    throw new Error(error.message || 'Failed to load website leads.')
  }

  let rows = (data ?? []).map((row) => ({
    ...row,
    effective_status: effectiveWebsiteLeadStatus(row),
  }))

  const city = (opts.cityRoute || '').trim()
  if (city) {
    rows = rows.filter(
      (r) =>
        String(r.city_route || '') === city ||
        String(r.landing_path || '') === `/${city}` ||
        String(r.landing_path || '').replace(/^\//, '') === city,
    )
  }

  const filter = (opts.filter || 'all').toLowerCase()
  if (filter !== 'all') {
    rows = rows.filter((r) => {
      const eff = r.effective_status
      switch (filter) {
        case 'visitors':
          return eff === 'visited'
        case 'started':
          return eff === 'quote_started' || eff === 'step_completed'
        case 'abandoned':
          return eff === 'quote_abandoned'
        case 'completed':
          return eff === 'quote_completed'
        case 'payment_started':
          return eff === 'payment_started'
        case 'payment_completed':
          return eff === 'payment_completed'
        default:
          return true
      }
    })
  }

  const search = (opts.search || '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((r) => {
      const hay = [
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        r.quote_ref,
        r.landing_path,
        r.city_route,
        r.city,
        r.region,
        r.country,
        r.ip_masked,
        r.device_type,
        r.browser_name,
        r.referrer,
        r.service_type,
        r.session_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(search)
    })
  }

  return rows
}

/**
 * @param {unknown[]} rows
 * @returns {string[]}
 */
export function distinctCityRoutesFromLeads(rows) {
  const set = new Set()
  for (const r of rows) {
    if (r.city_route) set.add(String(r.city_route))
    else if (r.landing_path && r.landing_path !== '/') set.add(String(r.landing_path).replace(/^\//, ''))
  }
  return [...set].sort()
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateWebsiteLeadById(id, patch) {
  if (!isSupabaseConfigured || !supabase || !id) return null
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(error.message || 'Failed to update lead.')
  return data
}

/**
 * Mark inactive started quotes abandoned and schedule recovery (30+ min idle).
 * @param {Record<string, unknown>[]} rows
 */
export async function scheduleAbandonedRecoveryForRows(rows) {
  if (!isSupabaseConfigured || !supabase) return
  const now = new Date().toISOString()
  const scheduleAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const targets = (rows || []).filter((row) => {
    const eff = effectiveWebsiteLeadStatus(row)
    if (eff === 'payment_completed' || eff === 'payment_started' || eff === 'quote_completed') {
      return false
    }
    if (eff !== 'quote_abandoned' && !isWebsiteLeadAbandoned(row.last_activity_at)) return false
    return !row.abandoned_at && !row.recovery_scheduled_at
  })

  await Promise.all(
    targets.slice(0, 25).map((row) =>
      updateWebsiteLeadById(row.id, {
        abandoned_at: row.abandoned_at || now,
        recovery_scheduled_at: scheduleAt,
        status: row.status === 'visited' ? 'quote_started' : row.status,
      }).catch(() => null),
    ),
  )
}

/**
 * @param {string} id
 */
export async function markRecoveryEmailSent(id) {
  const now = new Date().toISOString()
  return updateWebsiteLeadById(id, {
    recovery_email_sent: true,
    recovery_email_sent_at: now,
  })
}

/**
 * @param {string} id
 */
export async function markLeadRecovered(id) {
  const now = new Date().toISOString()
  return updateWebsiteLeadById(id, {
    recovered_booking: true,
    recovered_booking_at: now,
  })
}

/**
 * @param {string} id
 */
export async function archiveWebsiteLead(id) {
  return updateWebsiteLeadById(id, {
    archived_at: new Date().toISOString(),
  })
}
