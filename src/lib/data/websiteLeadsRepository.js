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
