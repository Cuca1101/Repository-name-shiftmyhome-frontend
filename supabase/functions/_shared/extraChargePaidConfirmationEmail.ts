/**
 * Send customer email with paid amount + items after extra charge Stripe payment succeeds.
 */
import type Stripe from 'npm:stripe@14.21.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { enrichExtraChargeFromQuote, normalizeAddedItemsForEmail } from './extraChargePayment.ts'
import { renderExtraChargePaidEmailTemplate } from './extraChargeEmailTemplate.ts'
import { sendResendEmailMinimal } from './postResendEmail.ts'

const SUPPORT_EMAIL = 'admin@shiftmyhome.co.uk'

export async function sendExtraChargePaidConfirmationEmail(opts: {
  supabase: SupabaseClient
  paymentIntent: Stripe.PaymentIntent
  requestId: string
  resendApiKey: string
  resendFrom: string
}): Promise<{ sent: boolean; error?: string }> {
  const { supabase, paymentIntent, requestId, resendApiKey, resendFrom } = opts

  if (!resendApiKey) {
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  const { data: ecr, error: fetchErr } = await supabase
    .from('extra_charge_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchErr || !ecr) {
    return { sent: false, error: 'Extra charge request not found' }
  }

  const row = ecr as Record<string, unknown>
  const alreadySent = row.paid_confirmation_email_sent_at != null
  const sameIntent =
    row.paid_confirmation_email_intent_id != null &&
    String(row.paid_confirmation_email_intent_id) === paymentIntent.id
  if (alreadySent && sameIntent) {
    return { sent: true }
  }

  const enriched = await enrichExtraChargeFromQuote(supabase, row)
  const customerEmail = String(
    paymentIntent.receipt_email ||
      paymentIntent.metadata?.customer_email ||
      enriched.customerEmail ||
      '',
  ).trim()
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { sent: false, error: 'Customer email missing' }
  }

  const amountPaid = Math.max(
    0,
    (typeof paymentIntent.amount_received === 'number'
      ? paymentIntent.amount_received
      : paymentIntent.amount ?? 0) / 100,
  )
  const paidAmount =
    amountPaid > 0
      ? amountPaid
      : Number(row.approved_amount) || Number(row.estimated_amount) || 0

  const { subject, html, text } = renderExtraChargePaidEmailTemplate({
    bookingReference: enriched.bookingRef,
    customerName: enriched.customerName,
    paidAmount,
    currency: String(row.currency || 'GBP'),
    addedItems: normalizeAddedItemsForEmail(row.added_items),
    supportEmail: SUPPORT_EMAIL,
  })

  const result = await sendResendEmailMinimal({
    logTag: 'extraChargePaidConfirmation',
    apiKey: resendApiKey,
    from: resendFrom,
    to: [customerEmail],
    subject,
    html,
    text,
    attachments: [],
  })

  if (result.ok) {
    await supabase
      .from('extra_charge_requests')
      .update({
        paid_confirmation_email_sent_at: new Date().toISOString(),
        paid_confirmation_email_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
    return { sent: true }
  }

  return { sent: false, error: result.bodyText || 'Email send failed' }
}
