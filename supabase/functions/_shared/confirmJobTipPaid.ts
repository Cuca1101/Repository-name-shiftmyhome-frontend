/**
 * Mark a job tip paid after Stripe Checkout (idempotent).
 * Does NOT modify booking payment_status, amount_paid, remaining_balance, or totals.
 */
import { sendResendEmail } from './resendClient.ts'
import { buildJobCustomerEmailHtml, trackingUrl } from './jobCustomerNotify.ts'

export type TipPaidResult = {
  ok: boolean
  alreadyPaid?: boolean
  tip_id?: string
  amount_gbp?: number
  error?: string
}

/**
 * @param supabase service-role client
 * @param tipId job_tips.id
 * @param session Stripe Checkout Session-like object
 */
export async function applyJobTipPaidFromCheckout(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tipId: string,
  session: {
    payment_intent?: string | { id?: string } | null
    metadata?: Record<string, string> | null
  },
): Promise<TipPaidResult> {
  const id = String(tipId || '').trim()
  if (!id) return { ok: false, error: 'missing tip_id' }

  const { data: tip } = await supabase.from('job_tips').select('*').eq('id', id).maybeSingle()
  if (!tip) return { ok: false, error: 'tip_not_found' }

  const quoteId = String(session.metadata?.quote_id || tip.quote_id || '').trim()
  const amountGbp = Number(tip.amount_gbp)

  if (tip.status === 'paid') {
    return { ok: true, alreadyPaid: true, tip_id: id, amount_gbp: amountGbp }
  }

  const paidAt = new Date().toISOString()
  const pi =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === 'object'
        ? String(session.payment_intent.id || '')
        : tip.stripe_payment_intent_id

  await supabase
    .from('job_tips')
    .update({
      status: 'paid',
      paid_at: paidAt,
      stripe_payment_intent_id: pi || tip.stripe_payment_intent_id,
      updated_at: paidAt,
    })
    .eq('id', id)

  if (quoteId) {
    const { data: paidTips } = await supabase
      .from('job_tips')
      .select('amount_gbp')
      .eq('quote_id', quoteId)
      .eq('status', 'paid')
    const tipTotal = (paidTips || []).reduce(
      (s: number, t: { amount_gbp?: number }) => s + Number(t.amount_gbp || 0),
      0,
    )

    // Tip rollup only — never touch payment_status / amount_paid / remaining_balance.
    await supabase
      .from('quotes')
      .update({ tip_total_gbp: tipTotal, tip_paid_at: paidAt })
      .eq('id', quoteId)

    const { data: quote } = await supabase
      .from('quotes')
      .select('email, full_name, quote_ref')
      .eq('id', quoteId)
      .maybeSingle()
    const email = String(quote?.email || tip.customer_email || '').trim()
    const token = String(tip.tracking_token || session.metadata?.tracking_token || '')
    if (email) {
      const html = buildJobCustomerEmailHtml({
        title: 'Tip payment received',
        intro: `Hi ${String(quote?.full_name || 'there').split(/\s+/)[0] || 'there'}, thank you — your optional tip of £${amountGbp.toFixed(2)} has been received.`,
        rows: [
          { label: 'Booking', value: String(quote?.quote_ref || '') },
          { label: 'Tip amount', value: `£${amountGbp.toFixed(2)}` },
        ],
        primaryCta: token ? { label: 'View My Booking', url: trackingUrl(token) } : undefined,
        footerNote: 'Tips are optional and separate from your booking payment.',
      })
      await sendResendEmail({
        to: email,
        subject: `[ShiftMyHome] Tip received (${quote?.quote_ref || 'booking'})`,
        html,
        text: `Tip of £${amountGbp.toFixed(2)} received.`,
        logTag: 'job-tip-confirmation',
      })
    }
  }

  return { ok: true, tip_id: id, amount_gbp: amountGbp }
}
