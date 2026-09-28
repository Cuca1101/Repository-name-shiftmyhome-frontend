import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from './resendClient.ts'
import { renderAdminAbandonedQuoteEmail } from './adminNotificationEmailTemplates.ts'
import {
  adminSiteOrigin,
  resolveAdminNotificationRecipients,
} from './adminAvailableJobNotification.ts'
import {
  quoteIndicatesCompletedBooking,
  validateLeadForAdminAbandonedNotify,
} from './adminNotificationValidation.ts'
import type { QuoteRow } from './quoteAvailableJobEligibility.ts'

export type AbandonedAdminNotifyResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  email_sent?: boolean
  email_error?: string
  lead_id?: string
  lead_ref?: string
}

const EVENT_KEY = 'admin_abandoned_quote'
const EVENT_LABEL = 'Admin: abandoned quote'

type LeadRow = Record<string, unknown> & { id: string }

function str(v: unknown): string {
  return String(v ?? '').trim()
}

async function logLeadEmailHistory(
  supabase: SupabaseClient,
  leadId: string,
  patch: {
    delivery_status: string
    recipient_email?: string
    provider_message_id?: string | null
    payload?: Record<string, unknown>
    sent_at?: string
  },
) {
  const now = patch.sent_at || new Date().toISOString()
  const { data: existing } = await supabase
    .from('customer_lead_notifications')
    .select('id')
    .eq('customer_lead_id', leadId)
    .eq('event_key', EVENT_KEY)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('customer_lead_notifications')
      .update({
        event_label: EVENT_LABEL,
        channel: 'email',
        recipient_email: patch.recipient_email ?? null,
        provider_message_id: patch.provider_message_id ?? null,
        delivery_status: patch.delivery_status,
        payload: patch.payload ?? {},
        sent_at: now,
      })
      .eq('id', existing.id)
    return
  }

  const { error } = await supabase.from('customer_lead_notifications').insert({
    customer_lead_id: leadId,
    event_key: EVENT_KEY,
    event_label: EVENT_LABEL,
    channel: 'email',
    recipient_email: patch.recipient_email ?? null,
    provider_message_id: patch.provider_message_id ?? null,
    delivery_status: patch.delivery_status,
    payload: patch.payload ?? {},
    sent_at: now,
  })
  if (error) {
    console.error('[admin-abandoned-notify] history log failed', error.message)
  }
}

async function leadHasCompletedBooking(
  supabase: SupabaseClient,
  lead: LeadRow,
): Promise<boolean> {
  if (lead.converted_at || str(lead.status) === 'converted_to_booking' || lead.recovery_stopped_at) {
    return true
  }

  const quoteId = str(lead.quote_id)
  if (quoteId) {
    const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
    if (quoteIndicatesCompletedBooking(data as QuoteRow | null)) return true
  }

  const quoteRef = str(lead.quote_ref)
  if (quoteRef) {
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_ref', quoteRef)
      .limit(1)
      .maybeSingle()
    if (quoteIndicatesCompletedBooking(data as QuoteRow | null)) return true
  }

  return false
}

/**
 * Send admin abandoned-quote email once per lead (30+ min inactive, not converted/paid).
 * Skips incomplete / test / placeholder leads. Re-checks booking/payment before send.
 */
export async function sendAdminAbandonedLeadNotificationIfNeeded(params: {
  supabase: SupabaseClient
  lead: LeadRow
}): Promise<AbandonedAdminNotifyResult> {
  const leadId = str(params.lead?.id)
  if (!leadId) return { ok: true, skipped: true, reason: 'lead_not_found' }

  // Fresh read before any claim
  const { data: fresh, error: loadErr } = await params.supabase
    .from('customer_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (loadErr || !fresh) {
    return { ok: true, skipped: true, reason: 'lead_not_found', lead_id: leadId }
  }

  const lead = fresh as LeadRow

  if (lead.abandoned_notification_sent_at) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified',
      lead_id: leadId,
      lead_ref: str(lead.lead_ref),
    }
  }

  if (await leadHasCompletedBooking(params.supabase, lead)) {
    return {
      ok: true,
      skipped: true,
      reason: 'converted_or_paid',
      lead_id: leadId,
      lead_ref: str(lead.lead_ref),
    }
  }

  const validated = validateLeadForAdminAbandonedNotify(lead)
  if (!validated.ok) {
    console.log('[admin-abandoned-notify] skipped incomplete/invalid', {
      lead_id: leadId,
      reason: validated.reason,
    })
    return {
      ok: true,
      skipped: true,
      reason: validated.reason,
      lead_id: leadId,
      lead_ref: str(lead.lead_ref),
    }
  }

  const fields = validated.fields
  const recipients = await resolveAdminNotificationRecipients(params.supabase)
  if (!recipients.length) {
    return { ok: false, reason: 'no_admin_recipients', lead_id: leadId }
  }

  const adminUrl = `${adminSiteOrigin()}/admin/customer-leads/${encodeURIComponent(leadId)}`
  const now = new Date().toISOString()

  const { data: claimed, error: claimErr } = await params.supabase
    .from('customer_leads')
    .update({ abandoned_notification_sent_at: now, updated_at: now })
    .eq('id', leadId)
    .is('abandoned_notification_sent_at', null)
    .is('converted_at', null)
    .neq('status', 'converted_to_booking')
    .select('id, lead_ref, quote_id, quote_ref, status, converted_at, recovery_stopped_at')
    .maybeSingle()

  if (claimErr) {
    console.error('[admin-abandoned-notify] claim failed', claimErr.message)
    return {
      ok: false,
      email_error: claimErr.message,
      lead_id: leadId,
      lead_ref: fields.reference,
    }
  }
  if (!claimed) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified_race_or_converted',
      lead_id: leadId,
      lead_ref: fields.reference,
    }
  }

  // Final re-check after claim (payment may have landed during the race window)
  if (await leadHasCompletedBooking(params.supabase, claimed as LeadRow)) {
    await params.supabase
      .from('customer_leads')
      .update({ abandoned_notification_sent_at: null, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    return {
      ok: true,
      skipped: true,
      reason: 'converted_or_paid_after_claim',
      lead_id: leadId,
      lead_ref: fields.reference,
    }
  }

  const { subject, html, text } = renderAdminAbandonedQuoteEmail({
    ...fields,
    adminUrl,
  })

  await logLeadEmailHistory(params.supabase, leadId, {
    delivery_status: 'pending',
    recipient_email: recipients.join(', '),
    payload: { subject, lead_ref: fields.reference, recipients },
    sent_at: now,
  })

  const sendResult = await sendResendEmail({
    to: recipients,
    subject,
    html,
    text,
    idempotencyKey: `admin-abandoned-quote-${leadId}`,
    logTag: 'admin-abandoned-quote',
  })

  if (!sendResult.ok) {
    await params.supabase
      .from('customer_leads')
      .update({ abandoned_notification_sent_at: null, updated_at: new Date().toISOString() })
      .eq('id', leadId)

    await logLeadEmailHistory(params.supabase, leadId, {
      delivery_status: 'failed',
      recipient_email: recipients.join(', '),
      provider_message_id: null,
      payload: { subject, error: sendResult.error || 'send_failed', recipients },
      sent_at: now,
    })

    return {
      ok: false,
      email_sent: false,
      email_error: sendResult.error || 'send_failed',
      lead_id: leadId,
      lead_ref: fields.reference,
    }
  }

  await logLeadEmailHistory(params.supabase, leadId, {
    delivery_status: 'sent',
    recipient_email: recipients.join(', '),
    provider_message_id: sendResult.resendId || null,
    payload: {
      subject,
      lead_ref: fields.reference,
      recipients,
      resend_id: sendResult.resendId || null,
    },
    sent_at: now,
  })

  return {
    ok: true,
    email_sent: true,
    lead_id: leadId,
    lead_ref: fields.reference,
  }
}

/**
 * Batch: find 30+ min inactive unfinished leads and email admin once each.
 */
export async function processAdminAbandonedLeadNotifications(params: {
  supabase: SupabaseClient
  inactiveMinutes?: number
  limit?: number
}): Promise<{
  ok: boolean
  candidates: number
  sent: number
  failed: number
  skipped: number
  results: AbandonedAdminNotifyResult[]
}> {
  const inactiveMinutes = params.inactiveMinutes ?? 30
  const limit = params.limit ?? 40

  const { data: rows, error } = await params.supabase.rpc(
    'list_admin_abandoned_notification_candidates',
    {
      p_inactive_minutes: inactiveMinutes,
      p_limit: limit,
    },
  )

  if (error) {
    console.warn('[admin-abandoned-notify] rpc unavailable, using query', error.message)
    const cutoff = new Date(Date.now() - inactiveMinutes * 60 * 1000).toISOString()
    const { data: fallback, error: qErr } = await params.supabase
      .from('customer_leads')
      .select('*')
      .is('abandoned_notification_sent_at', null)
      .is('converted_at', null)
      .neq('status', 'converted_to_booking')
      .is('recovery_stopped_at', null)
      .lt('last_activity_at', cutoff)
      .order('last_activity_at', { ascending: true })
      .limit(limit)

    if (qErr) {
      return { ok: false, candidates: 0, sent: 0, failed: 1, skipped: 0, results: [] }
    }

    const results: AbandonedAdminNotifyResult[] = []
    for (const row of fallback || []) {
      results.push(
        await sendAdminAbandonedLeadNotificationIfNeeded({
          supabase: params.supabase,
          lead: row as LeadRow,
        }),
      )
    }
    return summarize(results)
  }

  const results: AbandonedAdminNotifyResult[] = []
  for (const row of rows || []) {
    results.push(
      await sendAdminAbandonedLeadNotificationIfNeeded({
        supabase: params.supabase,
        lead: row as LeadRow,
      }),
    )
  }
  return summarize(results)
}

function summarize(results: AbandonedAdminNotifyResult[]) {
  return {
    ok: true,
    candidates: results.length,
    sent: results.filter((r) => r.email_sent).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  }
}
