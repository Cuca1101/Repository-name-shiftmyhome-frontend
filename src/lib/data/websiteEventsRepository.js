import { isSupabaseConfigured, supabase } from '../supabase'
import { getWebsiteLeadSessionId } from '../websiteLeadSession'
import { trackingDevLog } from '../trackingDevLog'

const TABLE = 'website_events'

function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return msg.includes('does not exist') || msg.includes('42p01') || msg.includes('pgrst205')
}

/**
 * @param {Record<string, unknown>} row
 */
export async function insertWebsiteEvent(row) {
  if (!isSupabaseConfigured || !supabase) return null
  const session_id = (row.session_id || getWebsiteLeadSessionId()).trim()
  if (!session_id || !row.event_name) return null

  const payload = {
    session_id,
    event_name: String(row.event_name),
    page_path: row.page_path != null ? String(row.page_path) : null,
    referrer: row.referrer != null ? String(row.referrer) : null,
    quote_ref: row.quote_ref != null ? String(row.quote_ref) : null,
    funnel_step: row.funnel_step != null ? Number(row.funnel_step) : null,
    ip_address: row.ip_address != null ? String(row.ip_address) : null,
    ip_hash: row.ip_hash != null ? String(row.ip_hash) : null,
    ip_masked: row.ip_masked != null ? String(row.ip_masked) : null,
    city: row.city != null ? String(row.city) : null,
    region: row.region != null ? String(row.region) : null,
    country: row.country != null ? String(row.country) : null,
    user_agent: row.user_agent != null ? String(row.user_agent) : null,
    device_type: row.device_type != null ? String(row.device_type) : null,
    browser_name: row.browser_name != null ? String(row.browser_name) : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  }

  const { data, error } = await supabase.from(TABLE).insert(payload).select('id').maybeSingle()
  if (error) {
    if (isMissingTableError(error)) {
      trackingDevLog('website_events', 'table missing — run migration 032')
      return null
    }
    trackingDevLog('website_events', 'insert failed', error.message)
    return null
  }
  return data
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function fetchWebsiteEventsForAdmin(opts = {}) {
  if (!isSupabaseConfigured || !supabase) return []
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 2000)
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(limit)
  if (opts.since) {
    query = query.gte('created_at', String(opts.since))
  }
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) {
      trackingDevLog('website_events', 'table missing — run migration 032')
      return []
    }
    throw new Error(error.message || 'Failed to load website events.')
  }
  return data ?? []
}
