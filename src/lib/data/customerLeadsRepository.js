import { isSupabaseConfigured, supabase } from '../supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../supabasePublicClient'
import { getWebsiteLeadSessionId } from '../websiteLeadSession'
import {
  CUSTOMER_LEAD_STATUS_LABELS,
  effectiveCustomerLeadStatus,
} from '../customerLeadStatus'

const TABLE = 'customer_leads'

/** Last upsert failure (code/message only — no PII). For support / console diagnosis. */
let lastCustomerLeadUpsertError = null

/**
 * @returns {{ at: string, code: string, message: string } | null}
 */
export function getLastCustomerLeadUpsertError() {
  return lastCustomerLeadUpsertError
}

/**
 * Sanitize PostgREST / Postgres errors for logs (no emails, phones, payloads).
 * @param {unknown} error
 */
function sanitizeLeadError(error) {
  const raw = error && typeof error === 'object' ? error : null
  const code = String(raw?.code || raw?.status || 'unknown').slice(0, 64)
  let message = String(raw?.message || raw?.details || 'upsert_failed').slice(0, 240)
  message = message
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '[redacted-email]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[redacted-phone]')
  return { code, message }
}

function logLeadUpsertFailure(reason, error) {
  const sanitized = error ? sanitizeLeadError(error) : { code: reason, message: reason }
  lastCustomerLeadUpsertError = {
    at: new Date().toISOString(),
    code: sanitized.code,
    message: sanitized.message,
  }
  // Always diagnosable in prod consoles; never surface to customers.
  // eslint-disable-next-line no-console
  console.warn('[customer_leads] upsert failed', sanitized.code, sanitized.message)
}

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
  if (!db) {
    logLeadUpsertFailure('supabase_not_configured', null)
    return null
  }

  const sid = (sessionId || getWebsiteLeadSessionId()).trim()
  if (!sid) {
    logLeadUpsertFailure('missing_session_id', null)
    return null
  }

  const { data, error } = await db.rpc('upsert_customer_lead', {
    p_session_id: sid,
    p_payload: payload,
  })

  if (error) {
    logLeadUpsertFailure('rpc_error', error)
    return null
  }
  lastCustomerLeadUpsertError = null
  return data
}

/**
 * @param {{ filter?: string, search?: string }} [opts]
 */
export async function fetchCustomerLeadsForAdmin(opts = {}) {
  if (!isSupabaseConfigured || !supabase) return []

  try {
    await supabase.rpc('mark_stale_customer_leads_abandoned', { p_inactive_minutes: 15 })
  } catch {
    /* RPC may not exist until migration applied */
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('last_activity_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(error.message || 'Failed to load customer leads.')
  }

  let rows = (data ?? [])
    .filter((row) => {
      const name = String(row.customer_name || '').trim()
      const phone = String(row.customer_phone || '').trim()
      const email = String(row.customer_email || '').trim()
      return Boolean(name || phone || email)
    })
    .map((row) => ({
    ...row,
    effective_status: effectiveCustomerLeadStatus(row),
    status_label: CUSTOMER_LEAD_STATUS_LABELS[effectiveCustomerLeadStatus(row)] || row.status,
  }))

  rows = await attachCustomerPaid(rows)
  rows = await attachCustomerOffers(rows)

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
          return eff === 'abandoned' || eff === 'payment_failed'
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
 * Leads an admin has not opened yet. Trashed leads are not counted.
 */
export async function countUnreadCustomerLeads() {
  if (!isSupabaseConfigured || !supabase) return 0
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .is('admin_read_at', null)
    .is('deleted_at', null)
  if (error) return 0
  return Number(count) || 0
}

/**
 * Opening a lead clears it from the unread nav count.
 * @param {string} id
 */
export async function markCustomerLeadRead(id) {
  if (!isSupabaseConfigured || !supabase || !id) return
  const { error } = await supabase
    .from(TABLE)
    .update({ admin_read_at: new Date().toISOString() })
    .eq('id', id)
    .is('admin_read_at', null)
  if (error) return
  window.dispatchEvent(new Event('customer-leads-read'))
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
  const [withPayment] = await attachCustomerPaid([data])
  return {
    ...withPayment,
    effective_status,
    status_label: CUSTOMER_LEAD_STATUS_LABELS[effective_status] || data.status,
  }
}

/**
 * A quote with a Stripe payment intent was paid by the customer.
 * Admin Create job marks a booking paid without that charge.
 * @param {Record<string, unknown>[]} rows
 */
async function attachCustomerPaid(rows) {
  const ids = [...new Set(rows.map((row) => row.quote_id).filter(Boolean).map(String))]
  if (!ids.length || !supabase) {
    return rows.map((row) => ({ ...row, customer_paid: false }))
  }
  const { data, error } = await supabase
    .from('quotes')
    .select('id, stripe_payment_intent_id')
    .in('id', ids)
  if (error) return rows.map((row) => ({ ...row, customer_paid: false }))
  const paid = new Set(
    (data || [])
      .filter((quote) => String(quote.stripe_payment_intent_id || '').trim())
      .map((quote) => String(quote.id)),
  )
  return rows.map((row) => ({
    ...row,
    customer_paid: paid.has(String(row.quote_id || '')),
  }))
}

/**
 * Latest customer offer for each lead, matched by lead, quote reference, or email.
 * @param {Record<string, unknown>[]} rows
 */
async function attachCustomerOffers(rows) {
  if (!rows.length || !supabase) {
    return rows.map((row) => ({ ...row, customer_offer: null }))
  }
  const { data, error } = await supabase
    .from('customer_offers')
    .select('id, lead_id, quote_ref, customer_email, status, proposed_amount, agreed_amount, original_total, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return rows.map((row) => ({ ...row, customer_offer: null }))

  const byLead = new Map()
  const byRef = new Map()
  for (const offer of data || []) {
    const leadId = String(offer.lead_id || '')
    const ref = String(offer.quote_ref || '').trim().toLowerCase()
    if (leadId && !byLead.has(leadId)) byLead.set(leadId, offer)
    if (ref && !byRef.has(ref)) byRef.set(ref, offer)
  }

  return rows.map((row) => {
    const offer =
      byLead.get(String(row.id || '')) ||
      byRef.get(String(row.quote_ref || '').trim().toLowerCase()) ||
      null
    return { ...row, customer_offer: offer }
  })
}

/**
 * Mark the lead as called, store what the customer said, and optionally when to call again.
 * @param {{ id: string, note?: string, callbackAt?: string | null, calledBy?: string }} params
 */
export async function saveCustomerLeadCall({ id, note = '', callbackAt = null, calledBy = '' }) {
  const now = new Date().toISOString()
  const callback = callbackAt ? new Date(callbackAt).toISOString() : null
  if (callbackAt && !Number.isFinite(Date.parse(callback || ''))) {
    throw new Error('That callback time is not valid.')
  }
  const updated = await updateCustomerLeadById(id, {
    called_at: now,
    call_note: String(note || '').trim() || null,
    called_by: String(calledBy || '').trim() || null,
    callback_at: callback,
    callback_dismissed_at: null,
    updated_at: now,
  })
  if (!updated) throw new Error('Failed to save the call.')
  return updated
}

/**
 * Close the callback notice without deleting the call note.
 * @param {string} id
 */
export async function dismissCustomerLeadCallback(id) {
  const now = new Date().toISOString()
  const updated = await updateCustomerLeadById(id, {
    callback_dismissed_at: now,
    updated_at: now,
  })
  if (!updated) throw new Error('Failed to close the callback notice.')
  return updated
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
 * Move a customer lead to Trash. Does not delete the linked quote/booking.
 * @param {string} id
 */
export async function deleteCustomerLeadById(id) {
  if (!isSupabaseConfigured || !supabase || !id) {
    throw new Error('Supabase is not configured.')
  }
  const deletedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      deleted_at: deletedAt,
      next_recovery_email_at: null,
      updated_at: deletedAt,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    throw new Error(error.message || 'Failed to delete lead.')
  }
  if (!data) throw new Error('Failed to delete lead.')
  return data
}

/**
 * Put a trashed customer lead back on the Customer Leads list.
 * @param {string} id
 */
export async function restoreCustomerLeadById(id) {
  if (!isSupabaseConfigured || !supabase || !id) {
    throw new Error('Supabase is not configured.')
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    throw new Error(error.message || 'Failed to restore lead.')
  }
  if (!data) throw new Error('Failed to restore lead.')
  return data
}

/**
 * Remove a trashed lead for good. Active leads are left untouched.
 * A linked quote or booking is not deleted.
 * @param {string} id
 */
export async function purgeCustomerLeadById(id) {
  if (!isSupabaseConfigured || !supabase || !id) {
    throw new Error('Supabase is not configured.')
  }
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id')
  if (error) {
    throw new Error(error.message || 'Failed to delete lead permanently.')
  }
  if (!data?.length) throw new Error('This lead is not in Trash, so it was not deleted.')
  return data[0]
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
    recovery_stopped_at: new Date().toISOString(),
    next_recovery_email_at: null,
    last_activity_at: new Date().toISOString(),
  })
}
