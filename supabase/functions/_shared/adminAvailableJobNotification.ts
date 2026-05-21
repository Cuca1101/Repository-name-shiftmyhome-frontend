import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@14.21.0'
import { sendResendEmail } from './resendClient.ts'
import { renderAdminAvailableJobEmail } from './transactionalEmailTemplates.ts'
import {
  estimatedTotalFromQuote,
  formatVolumeAndCrewLine,
  locationLabel,
  paymentStatusLabel,
  quoteEligibleForAdminAvailableJobEmail,
  type QuoteRow,
} from './quoteAvailableJobEligibility.ts'

export type AdminNotifyResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  email_sent?: boolean
  email_error?: string
  quote_id?: string
  quote_ref?: string
}

/** Comma-separated ADMIN_NOTIFICATION_EMAILS or single ADMIN_NOTIFICATION_EMAIL. */
export function getAdminNotificationRecipients(): string[] {
  const raw =
    (Deno.env.get('ADMIN_NOTIFICATION_EMAILS') || Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || '')
      .trim() || 'admin@shiftmyhome.co.uk'
  return [...new Set(raw.split(',').map((e) => e.trim()).filter((e) => /@/.test(e)))]
}

export function adminSiteOrigin(): string {
  const origin = (
    Deno.env.get('ADMIN_SITE_ORIGIN') ||
    Deno.env.get('SITE_URL') ||
    'https://www.shiftmyhome.co.uk'
  ).trim()
  return origin.replace(/\/$/, '')
}

function formatMoveDateUK(q: QuoteRow): string {
  const raw = q.move_date
  if (raw == null || raw === '') return '—'
  try {
    const d = new Date(String(raw))
    if (!Number.isFinite(d.getTime())) return String(raw)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return String(raw)
  }
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

/**
 * Idempotent admin alert when a quote enters Available Jobs after payment.
 * Call after payment is verified (PaymentIntent succeeded + quote row paid).
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

  if (quote.admin_notified_at) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified',
      quote_id: quoteId,
      quote_ref: String(quote.quote_ref || ''),
    }
  }

  if (!quoteEligibleForAdminAvailableJobEmail(quote)) {
    return {
      ok: true,
      skipped: true,
      reason: 'not_eligible',
      quote_id: quoteId,
      quote_ref: String(quote.quote_ref || ''),
    }
  }

  const recipients = getAdminNotificationRecipients()
  if (!recipients.length) {
    return { ok: false, reason: 'no_admin_recipients', quote_id: quoteId }
  }

  const quoteRef = String(quote.quote_ref || 'Booking').trim() || 'Booking'
  const viewJobUrl = `${adminSiteOrigin()}/admin/available-jobs/${encodeURIComponent(quoteId)}`

  const now = new Date().toISOString()
  const { data: claimed, error: claimErr } = await params.supabase
    .from('quotes')
    .update({
      admin_notified_at: now,
      admin_notification_intent_id: piId || null,
    })
    .eq('id', quoteId)
    .is('admin_notified_at', null)
    .select('id, quote_ref')
    .maybeSingle()

  if (claimErr) {
    console.error('[admin-available-job] claim update failed', claimErr.message)
    return { ok: false, email_error: claimErr.message, quote_id: quoteId, quote_ref: quoteRef }
  }

  if (!claimed) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_notified_race',
      quote_id: quoteId,
      quote_ref: quoteRef,
    }
  }

  const { subject, html, text } = renderAdminAvailableJobEmail({
    quoteRef,
    customerName: String(quote.full_name || quote.customer_name || 'Customer').trim() || 'Customer',
    serviceType: String(quote.service || quote.service_type || 'Removals').trim() || 'Removals',
    pickupLabel: locationLabel(quote.pickup_address),
    deliveryLabel: locationLabel(quote.delivery_address),
    moveDate: formatMoveDateUK(quote),
    estimatedTotal: estimatedTotalFromQuote(quote),
    paymentStatus: paymentStatusLabel(quote),
    volumeCrew: formatVolumeAndCrewLine(quote),
    viewJobUrl,
  })

  const idempotencyKey = piId
    ? `admin-available-job-${piId}`
    : `admin-available-job-quote-${quoteId}`

  const sendResult = await sendResendEmail({
    to: recipients,
    subject,
    html,
    text,
    idempotencyKey,
  })

  if (!sendResult.ok) {
    await params.supabase
      .from('quotes')
      .update({ admin_notified_at: null, admin_notification_intent_id: null })
      .eq('id', quoteId)
      .eq('admin_notification_intent_id', piId || null)

    return {
      ok: false,
      email_sent: false,
      email_error: sendResult.error || 'send_failed',
      quote_id: quoteId,
      quote_ref: quoteRef,
    }
  }

  return {
    ok: true,
    email_sent: true,
    quote_id: quoteId,
    quote_ref: quoteRef,
  }
}
