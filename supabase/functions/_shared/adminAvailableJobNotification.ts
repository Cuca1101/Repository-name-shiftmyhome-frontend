import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@14.21.0'
import { sendResendEmail } from './resendClient.ts'
import { renderAdminBookingConfirmedEmail } from './adminNotificationEmailTemplates.ts'
import { validateQuoteForAdminBookingNotify } from './adminNotificationValidation.ts'
import { quoteIsCardPaid, type QuoteRow } from './quoteAvailableJobEligibility.ts'

export type AdminNotifyResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  email_sent?: boolean
  email_error?: string
  quote_id?: string
  quote_ref?: string
}

const EVENT_KEY = 'admin_booking_confirmed'
const EVENT_LABEL = 'Admin: new booking confirmed'

/** Optional extra recipients from Edge secrets (comma-separated). */
export function getAdminNotificationRecipientsFromEnv(): string[] {
  const raw = (
    Deno.env.get('ADMIN_NOTIFICATION_EMAILS') ||
    Deno.env.get('ADMIN_NOTIFICATION_EMAIL') ||
    ''
  ).trim()
  if (!raw) return []
  return [...new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)))]
}

/**
 * All Auth users with role=admin, plus any emails in ADMIN_NOTIFICATION_EMAILS.
 * Falls back to admin@shiftmyhome.co.uk if none found.
 */
export async function resolveAdminNotificationRecipients(
  supabase?: SupabaseClient | null,
): Promise<string[]> {
  const emails = new Set<string>(getAdminNotificationRecipientsFromEnv())

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('list_admin_notification_emails')
      if (!error && Array.isArray(data)) {
        for (const e of data) {
          const v = String(e || '').trim().toLowerCase()
          if (v.includes('@')) emails.add(v)
        }
      } else if (error) {
        console.warn('[admin-notify] list_admin_notification_emails failed', error.message)
      }
    } catch (e) {
      console.warn(
        '[admin-notify] list_admin_notification_emails threw',
        e instanceof Error ? e.message : String(e),
      )
    }
  }

  if (!emails.size) emails.add('admin@shiftmyhome.co.uk')
  return [...emails]
}

/** @deprecated Prefer resolveAdminNotificationRecipients(supabase) */
export function getAdminNotificationRecipients(): string[] {
  const fromEnv = getAdminNotificationRecipientsFromEnv()
  return fromEnv.length ? fromEnv : ['admin@shiftmyhome.co.uk']
}

export function adminSiteOrigin(): string {
  const origin = (
    Deno.env.get('ADMIN_SITE_ORIGIN') ||
    Deno.env.get('SITE_URL') ||
    'https://www.shiftmyhome.co.uk'
  ).trim()
  return origin.replace(/\/$/, '')
}

async function loadQuoteById(supabase: SupabaseClient, quoteId: string): Promise<QuoteRow | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (error) throw error
  return (data as QuoteRow) || null
}

async function loadQuoteByPaymentIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<QuoteRow | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (error) throw error
  if (data) return data as QuoteRow

  const { data: data2, error: error2 } = await supabase
    .from('quotes')
    .select('*')
    .filter('stripe_payment_intent_id', 'eq', paymentIntentId)
    .limit(1)
    .maybeSingle()
  if (error2) throw error2
  return (data2 as QuoteRow) || null
}

async function loadQuoteInventoryItems(supabase: SupabaseClient, quoteId: string) {
  const { data } = await supabase
    .from('quote_inventory_items')
    .select('item_name, quantity, volume_m3')
    .eq('quote_id', quoteId)
    .limit(200)
  return data || []
}

async function logEmailHistory(
  supabase: SupabaseClient,
  quoteId: string,
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
    .from('job_customer_notifications')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('event_key', EVENT_KEY)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('job_customer_notifications')
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

  await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: EVENT_KEY,
    event_label: EVENT_LABEL,
    channel: 'email',
    recipient_email: patch.recipient_email ?? null,
    provider_message_id: patch.provider_message_id ?? null,
    delivery_status: patch.delivery_status,
    payload: patch.payload ?? {},
    sent_at: now,
  })
}

/**
 * Idempotent admin alert when a customer completes booking / Stripe payment.
 * Claim booking_notification_sent_at once so verify + webhook cannot double-send.
 */
export async function sendAdminAvailableJobNotificationIfNeeded(params: {
  supabase: SupabaseClient
  quoteId?: string | null
  paymentIntentId?: string | null
  stripePaymentIntent?: Stripe.PaymentIntent | null
}): Promise<AdminNotifyResult> {
  const piId = (params.paymentIntentId || params.stripePaymentIntent?.id || '').trim()

  let quote: QuoteRow | null = null
  if (params.quoteId) {
    quote = await loadQuoteById(params.supabase, params.quoteId)
  } else if (piId) {
    quote = await loadQuoteByPaymentIntent(params.supabase, piId)
  }

  if (!quote?.id) {
    return { ok: true, skipped: true, reason: 'quote_not_found' }
  }

  const quoteId = String(quote.id)
  const quoteRefEarly = String(quote.quote_ref || '')

  if (quote.booking_notification_sent_at || quote.admin_notified_at) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified',
      quote_id: quoteId,
      quote_ref: quoteRefEarly,
    }
  }

  if (!quoteIsCardPaid(quote)) {
    return {
      ok: true,
      skipped: true,
      reason: 'not_paid',
      quote_id: quoteId,
      quote_ref: quoteRefEarly,
    }
  }

  const inventoryRows = await loadQuoteInventoryItems(params.supabase, quoteId)
  const validated = validateQuoteForAdminBookingNotify(quote, inventoryRows)
  if (!validated.ok) {
    console.log('[admin-booking-notify] skipped incomplete/invalid', {
      quote_id: quoteId,
      reason: validated.reason,
    })
    return {
      ok: true,
      skipped: true,
      reason: validated.reason,
      quote_id: quoteId,
      quote_ref: quoteRefEarly,
    }
  }

  const fields = validated.fields
  const recipients = await resolveAdminNotificationRecipients(params.supabase)
  if (!recipients.length) {
    return { ok: false, reason: 'no_admin_recipients', quote_id: quoteId }
  }

  const viewJobUrl = `${adminSiteOrigin()}/admin/available-jobs/${encodeURIComponent(quoteId)}`
  if (!viewJobUrl.includes('/admin/')) {
    return { ok: true, skipped: true, reason: 'missing_admin_link', quote_id: quoteId }
  }

  const now = new Date().toISOString()

  // Atomic claim — verify-payment-intent + stripe-webhook race safe
  const { data: claimed, error: claimErr } = await params.supabase
    .from('quotes')
    .update({
      booking_notification_sent_at: now,
      admin_notified_at: now,
      admin_notification_intent_id: piId || null,
    })
    .eq('id', quoteId)
    .is('booking_notification_sent_at', null)
    .select('id, quote_ref')
    .maybeSingle()

  if (claimErr) {
    const { data: claimedLegacy, error: claimLegacyErr } = await params.supabase
      .from('quotes')
      .update({
        admin_notified_at: now,
        admin_notification_intent_id: piId || null,
      })
      .eq('id', quoteId)
      .is('admin_notified_at', null)
      .select('id, quote_ref')
      .maybeSingle()

    if (claimLegacyErr) {
      console.error('[admin-booking-notify] claim update failed', claimErr.message, claimLegacyErr.message)
      return {
        ok: false,
        email_error: claimErr.message,
        quote_id: quoteId,
        quote_ref: fields.reference,
      }
    }
    if (!claimedLegacy) {
      return {
        ok: true,
        skipped: true,
        reason: 'already_notified_race',
        quote_id: quoteId,
        quote_ref: fields.reference,
      }
    }
  } else if (!claimed) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified_race',
      quote_id: quoteId,
      quote_ref: fields.reference,
    }
  }

  const { subject, html, text } = renderAdminBookingConfirmedEmail({
    ...fields,
    adminUrl: viewJobUrl,
  })

  // Quote-scoped key so PaymentIntent verify + webhook share one Resend send
  const idempotencyKey = `admin-booking-confirmed-quote-${quoteId}`

  await logEmailHistory(params.supabase, quoteId, {
    delivery_status: 'pending',
    recipient_email: recipients.join(', '),
    payload: { subject, quote_ref: fields.reference, recipients },
    sent_at: now,
  })

  const sendResult = await sendResendEmail({
    to: recipients,
    subject,
    html,
    text,
    idempotencyKey,
    logTag: 'admin-booking-confirmed',
  })

  if (!sendResult.ok) {
    await params.supabase
      .from('quotes')
      .update({
        booking_notification_sent_at: null,
        admin_notified_at: null,
        admin_notification_intent_id: null,
      })
      .eq('id', quoteId)

    await logEmailHistory(params.supabase, quoteId, {
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
      quote_id: quoteId,
      quote_ref: fields.reference,
    }
  }

  await logEmailHistory(params.supabase, quoteId, {
    delivery_status: 'sent',
    recipient_email: recipients.join(', '),
    provider_message_id: sendResult.resendId || null,
    payload: {
      subject,
      quote_ref: fields.reference,
      recipients,
      resend_id: sendResult.resendId || null,
    },
    sent_at: now,
  })

  return {
    ok: true,
    email_sent: true,
    quote_id: quoteId,
    quote_ref: fields.reference,
  }
}

/** Alias used by after-payment hooks. */
export const sendAdminBookingNotificationIfNeeded = sendAdminAvailableJobNotificationIfNeeded
