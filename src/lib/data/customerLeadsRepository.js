import { isSupabaseConfigured, supabase } from '../supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../supabasePublicClient'
import { getWebsiteLeadSessionId } from '../websiteLeadSession'
import {
  CUSTOMER_LEAD_STATUS_LABELS,
  effectiveCustomerLeadStatus,
} from '../customerLeadStatus'

const TABLE = 'customer_leads'

/**
 * Public funnel writes — always anon (same pattern as homepage quote insert).
 * @param {Record<string, unknown>} payload
 * @param {string} [sessionId]
 */
export async function upsertCustomerLead(payload, sessionId) {
  const db =
    isSupabasePublicConfigured && supabasePublic
      ? supabasePublic
      : isSupabaseConfigured && supabase
        ? supabase
        : null
  if (!db) return null

  const sid = (sessionId || getWebsiteLeadSessionId()).trim()
  if (!sid) return null

  const { data, error } = await db.rpc('upsert_customer_lead', {
    p_session_id: sid,
    p_payload: payload,
  })

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[customer_leads] upsert failed', error.message)
    }
    return null
  }
  return data
}

/**
 * @param {{ filter?: string, search?: string }} [opts]
 */
export async function fetchCustomerLeadsForAdmin(opts = {}) {
  if (!isSupabaseConfigured || !supabase) return []

  try {
    await supabase.rpc('mark_stale_customer_leads_abandoned', { p_inactive_minutes: 30 })
  } catch {
    /* RPC may not exist until migration applied */
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(error.message || 'Failed to load customer leads.')
  }

  let rows = (data ?? []).map((row) => ({
    ...row,
    effective_status: effectiveCustomerLeadStatus(row),
    status_label: CUSTOMER_LEAD_STATUS_LABELS[effectiveCustomerLeadStatus(row)] || row.status,
  }))

  const filter = (opts.filter || 'all').toLowerCase()
  if (filter !== 'all') {
    rows = rows.filter((r) => {
      const eff = r.effective_status
      switch (filter) {
        case 'new':
          return (
            eff === 'new_lead' ||
            eff === 'quote_started' ||
            eff === 'quote_viewed' ||
            eff === 'payment_started'
          )
        case 'abandoned':
          return eff === 'abandoned'
        case 'converted':
          return eff === 'converted_to_booking'
        default:
          return true
      }
    })
  }

  const search = (opts.search || '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((r) => {
      const hay = [
        r.lead_ref,
        r.quote_ref,
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        r.service_type,
        r.route_label,
        r.pickup_address,
        r.delivery_address,
        r.source_page_url,
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
 * @param {string} id
 */
export async function fetchCustomerLeadById(id) {
  if (!isSupabaseConfigured || !supabase || !id) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load lead.')
  if (!data) return null
  const effective_status = effectiveCustomerLeadStatus(data)
  return {
    ...data,
    effective_status,
    status_label: CUSTOMER_LEAD_STATUS_LABELS[effective_status] || data.status,
  }
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateCustomerLeadById(id, patch) {
  if (!isSupabaseConfigured || !supabase || !id) return null
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(error.message || 'Failed to update lead.')
  return data
}

/**
 * Link lead to paid booking by quote reference (admin or post-payment page).
 * @param {{ quoteRef: string, quoteId?: string | null }} params
 */
export async function linkCustomerLeadToBooking({ quoteRef, quoteId }) {
  if (!isSupabaseConfigured || !supabase) return null
  const ref = String(quoteRef || '').trim()
  if (!ref) return null

  const { data: rows, error: findErr } = await supabase
    .from(TABLE)
    .select('id, status')
    .eq('quote_ref', ref)
    .order('last_activity_at', { ascending: false })
    .limit(1)

  if (findErr || !rows?.length) {
    return upsertCustomerLead({
      quote_ref: ref,
      quote_id: quoteId ? String(quoteId) : null,
      status: 'converted_to_booking',
    })
  }

  const row = rows[0]
  return updateCustomerLeadById(row.id, {
    status: 'converted_to_booking',
    quote_ref: ref,
    quote_id: quoteId || null,
    converted_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  })
}
