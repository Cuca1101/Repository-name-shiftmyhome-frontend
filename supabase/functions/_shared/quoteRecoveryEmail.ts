import { sendResendEmail } from './resendClient.ts'
import { formatDateUK } from './formatDateUK.ts'

export type RecoveryEmailKind =
  | 'abandoned'
  | 'abandoned_reminder'
  | 'abandoned_final'
  | 'payment_failed'

function escHtml(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function siteBase() {
  return (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')
}

export function recoveryUrls(token: string) {
  const base = siteBase()
  return {
    resumeUrl: `${base}/quote/resume/${token}`,
    payUrl: `${base}/quote/pay/${token}`,
    openPixelUrl: `${base}/.netlify/functions/noop`, // unused; tracking via query on resume
  }
}

export type LeadLike = {
  id: string
  resume_token: string
  recovery_emails_sent_count?: number | null
  last_recovery_email_kind?: string | null
  abandoned_at?: string | null
  payment_failed_at?: string | null
  customer_name?: string | null
  customer_email?: string | null
  quote_ref?: string | null
  route_label?: string | null
  service_type?: string | null
  move_date?: string | null
  estimated_total?: number | null
  calculated_total?: number | null
  agreed_price?: number | null
  wizard_data?: Record<string, unknown> | null
}

function inventoryFromLead(lead: LeadLike) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? (wd.step2 as Record<string, unknown>) : {}
  const lines = Array.isArray(s2.inventoryLines) ? s2.inventoryLines : []
  return lines as Array<Record<string, unknown>>
}

function crewFromLead(lead: LeadLike) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? (wd.step2 as Record<string, unknown>) : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? (wd.step3 as Record<string, unknown>) : {}
  return s3.crewSize ?? s2.crewSize ?? null
}

function moveDateFromLead(lead: LeadLike) {
  if (lead.move_date) return lead.move_date
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s1 = wd.step1 && typeof wd.step1 === 'object' ? (wd.step1 as Record<string, unknown>) : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? (wd.step3 as Record<string, unknown>) : {}
  return s3.selectedMoveDate ?? s1.moveDate ?? null
}

export function buildRecoveryEmailContent(lead: LeadLike, kind: RecoveryEmailKind) {
  const token = String(lead.resume_token)
  const { resumeUrl, payUrl } = recoveryUrls(token)
  const trackResume = `${resumeUrl}?src=email&e=resume`
  const trackPay = `${payUrl}?src=email&e=pay`
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  const openTrack = supabaseUrl
    ? `${supabaseUrl}/functions/v1/track-quote-recovery?t=${encodeURIComponent(token)}&e=open`
    : ''

  const name = String(lead.customer_name || 'there').trim() || 'there'
  const quoteRef = String(lead.quote_ref || '').trim() || '—'
  const route = String(lead.route_label || '').trim() || '—'
  const service = String(lead.service_type || '').trim() || '—'
  const moveDate = formatDateUK(moveDateFromLead(lead))
  const crew = crewFromLead(lead)
  const crewLabel = crew != null && String(crew).trim() ? String(crew) : '—'
  const agreedNum = lead.agreed_price != null ? Number(lead.agreed_price) : NaN
  const calculatedNum =
    lead.calculated_total != null
      ? Number(lead.calculated_total)
      : lead.estimated_total != null
        ? Number(lead.estimated_total)
        : NaN
  const chargeNum = Number.isFinite(agreedNum) ? agreedNum : calculatedNum
  const total = Number.isFinite(chargeNum) ? `£${chargeNum.toFixed(2)}` : '—'
  const hasOverride =
    Number.isFinite(agreedNum) &&
    Number.isFinite(calculatedNum) &&
    Math.abs(agreedNum - calculatedNum) > 0.009
  const calculatedLabel = Number.isFinite(calculatedNum) ? `£${calculatedNum.toFixed(2)}` : '—'

  const inventory = inventoryFromLead(lead)
  const invRows = inventory.length
    ? inventory
        .map((line) => {
          const label = String(line.name || line.label || 'Item').trim()
          const qty = Number(line.qty ?? line.quantity ?? 1) || 1
          return `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${escHtml(label)}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">×${qty}</td></tr>`
        })
        .join('')
    : `<tr><td colspan="2" style="padding:6px 0;color:#64748b;">No inventory items saved</td></tr>`

  const titles: Record<RecoveryEmailKind, string> = {
    abandoned: 'Your quote is still reserved',
    abandoned_reminder: 'Reminder: your quote is waiting',
    abandoned_final: 'Final reminder: complete your booking',
    payment_failed: 'Payment unsuccessful — retry anytime',
  }
  const intros: Record<RecoveryEmailKind, string> = {
    abandoned: `Hi ${escHtml(name)}, you left before completing payment. Good news — your quote is still reserved.`,
    abandoned_reminder: `Hi ${escHtml(name)}, just a reminder that your ShiftMyHome quote is still reserved and ready to finish.`,
    abandoned_final: `Hi ${escHtml(name)}, this is your final reminder. Your quote is still reserved — resume or pay now to secure your move.`,
    payment_failed: `Hi ${escHtml(name)}, your payment for quote ${escHtml(quoteRef)} didn’t go through. No charge was made — you can retry payment or resume your quote below.`,
  }

  const payLabel = kind === 'payment_failed' ? 'Retry Payment' : 'Pay Now'
  const subject =
    kind === 'payment_failed'
      ? `[ShiftMyHome] Payment failed — retry for ${quoteRef}`
      : `[ShiftMyHome] Your quote ${quoteRef} is still reserved`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${escHtml(subject)}</title></head>
<body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${intros[kind]}
    ${openTrack ? `<img src="${escHtml(openTrack)}" width="1" height="1" alt="" />` : ''}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;">${titles[kind]}</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">${intros[kind]}</p>
          <table width="100%" style="font-size:14px;color:#334155;margin-bottom:16px;">
            <tr><td style="padding:4px 0;"><strong>Quote</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(quoteRef)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Route</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(route)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Service</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(service)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Move date</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(moveDate)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Crew</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(crewLabel)}</td></tr>
            ${
              hasOverride
                ? `<tr><td style="padding:4px 0;"><strong>Calculated price</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(calculatedLabel)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Agreed price</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;">${escHtml(total)}</td></tr>`
                : `<tr><td style="padding:4px 0;"><strong>Total</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;">${escHtml(total)}</td></tr>`
            }
          </table>
          <h2 style="font-size:15px;margin:0 0 8px;">Inventory</h2>
          <table width="100%" style="font-size:14px;color:#334155;margin-bottom:20px;">${invRows}</table>
          <p style="margin:0 0 12px;">
            <a href="${escHtml(trackResume)}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Resume Quote</a>
          </p>
          <p style="margin:0 0 8px;">
            <a href="${escHtml(trackPay)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">${payLabel}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Your quote remains reserved until you complete payment or it expires.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = [
    titles[kind],
    '',
    intros[kind].replace(/&[^;]+;/g, ''),
    `Quote: ${quoteRef}`,
    `Route: ${route}`,
    `Service: ${service}`,
    `Move date: ${moveDate}`,
    `Crew: ${crewLabel}`,
    hasOverride ? `Calculated price: ${calculatedLabel}` : null,
    hasOverride ? `Agreed price: ${total}` : `Total: ${total}`,
    '',
    `Resume Quote: ${trackResume}`,
    `${payLabel}: ${trackPay}`,
  ]
    .filter((line) => line != null)
    .join('\n')

  return { subject, html, text, resumeUrl: trackResume, payUrl: trackPay }
}

/**
 * Next send time from abandonment / payment-failed anchor.
 * Cadence: +15m (first), +24h, +72h from abandoned_at / payment_failed_at.
 */
export function nextRecoveryAtAfterSend(
  kind: RecoveryEmailKind,
  lead: LeadLike,
  from = new Date(),
): string | null {
  const anchorIso = lead.abandoned_at || lead.payment_failed_at || from.toISOString()
  const anchor = new Date(anchorIso).getTime()
  if (kind === 'abandoned') {
    return new Date(anchor + 24 * 60 * 60 * 1000).toISOString()
  }
  if (kind === 'abandoned_reminder') {
    return new Date(anchor + 72 * 60 * 60 * 1000).toISOString()
  }
  if (kind === 'payment_failed') {
    return null
  }
  return null
}

export function kindForAbandonedCount(sentCount: number): RecoveryEmailKind | null {
  if (sentCount <= 0) return 'abandoned'
  if (sentCount === 1) return 'abandoned_reminder'
  if (sentCount === 2) return 'abandoned_final'
  return null
}

function alreadySentStage(lead: LeadLike, kind: RecoveryEmailKind): boolean {
  const count = Number(lead.recovery_emails_sent_count || 0)
  const lastKind = String(lead.last_recovery_email_kind || '')
  if (lastKind === kind) return true
  if (kind === 'abandoned' && count >= 1) return true
  if (kind === 'abandoned_reminder' && count >= 2) return true
  if (kind === 'abandoned_final' && count >= 3) return true
  if (kind === 'payment_failed' && lastKind === 'payment_failed') return true
  return false
}

export async function sendRecoveryEmailForLead(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any
  lead: LeadLike
  kind: RecoveryEmailKind
  force?: boolean
}): Promise<{ ok: boolean; error?: string; resendId?: string; skipped?: boolean }> {
  const { supabase, lead, kind, force = false } = params
  const to = String(lead.customer_email || '').trim()
  if (!to) return { ok: false, error: 'missing_email' }

  if (!force && alreadySentStage(lead, kind)) {
    console.warn('[quote-recovery] skip duplicate stage', {
      leadId: lead.id,
      kind,
      count: lead.recovery_emails_sent_count,
      lastKind: lead.last_recovery_email_kind,
    })
    return { ok: true, skipped: true, error: 'already_sent_stage' }
  }

  const content = buildRecoveryEmailContent(lead, kind)
  const idempotencyKey = `quote-recovery:${lead.id}:${kind}:${Number(lead.recovery_emails_sent_count || 0)}`
  // Uses existing production RESEND_API_KEY via shared resendClient → postResendEmail.
  const result = await sendResendEmail({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey,
    logTag: 'quote-recovery',
  })

  if (!result.ok) {
    console.error('[quote-recovery] Resend send failed', {
      leadId: lead.id,
      kind,
      to,
      error: result.error,
      skipped: result.skipped,
    })
    return {
      ok: false,
      error: result.skipped ? 'resend_not_configured' : result.error || 'resend_failed',
    }
  }

  const now = new Date()
  const nextAt = nextRecoveryAtAfterSend(kind, lead, now)
  const { error } = await supabase
    .from('customer_leads')
    .update({
      recovery_emails_sent_count: Number(lead.recovery_emails_sent_count || 0) + 1,
      last_recovery_email_at: now.toISOString(),
      last_recovery_email_kind: kind,
      next_recovery_email_at: nextAt,
      updated_at: now.toISOString(),
    })
    .eq('id', lead.id)

  if (error) {
    console.error('[quote-recovery] sent but failed to update lead', {
      leadId: lead.id,
      kind,
      error: error.message || error,
    })
  }

  return { ok: true, resendId: result.resendId }
}
