import { sendResendEmail } from './resendClient.ts'
import { formatDateUK } from './formatDateUK.ts'
import {
  alreadySentStage,
  kindForAbandonedCount,
  nextRecoveryAtAfterSend,
} from './recoverySchedule.js'

export { alreadySentStage, kindForAbandonedCount, nextRecoveryAtAfterSend }

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
  customer_phone?: string | null
  pickup_address?: string | null
  delivery_address?: string | null
  quote_ref?: string | null
  route_label?: string | null
  service_type?: string | null
  move_date?: string | null
  estimated_total?: number | null
  calculated_total?: number | null
  agreed_price?: number | null
  price_override_reason?: string | null
  wizard_data?: Record<string, unknown> | null
}

function inventoryFromLead(lead: LeadLike) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? (wd.step2 as Record<string, unknown>) : {}
  const lines = Array.isArray(s2.inventoryLines) ? s2.inventoryLines : []
  return lines as Array<Record<string, unknown>>
}

/** A short list stays in one column. A long list uses three columns so the email stays short. */
function inventoryRowsHtml(inventory: Array<Record<string, unknown>>) {
  if (!inventory.length) {
    return `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">No items listed</td></tr>`
  }
  const items = inventory.map((line) => ({
    label: String(line.name || line.label || 'Item').trim() || 'Item',
    qty: Number(line.qty ?? line.quantity ?? 1) || 1,
  }))
  if (items.length < 6) {
    return items
      .map(
        (item) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${escHtml(item.label)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">×${item.qty}</td></tr>`,
      )
      .join('')
  }
  const rows: string[] = []
  for (let i = 0; i < items.length; i += 3) {
    const slice: Array<{ label: string; qty: number } | null> = items.slice(i, i + 3)
    while (slice.length < 3) slice.push(null)
    rows.push(
      `<tr>${slice
        .map((item) =>
          item
            ? `<td width="33%" valign="top" style="width:33%;padding:6px 8px 6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;line-height:1.35;color:#334155;">${escHtml(item.label)} <span style="color:#0f172a;font-weight:600;white-space:nowrap;">×${item.qty}</span></td>`
            : `<td width="33%" style="width:33%;padding:6px 0;border-bottom:1px solid #f1f5f9;">&nbsp;</td>`,
        )
        .join('')}</tr>`,
    )
  }
  return rows.join('')
}

function floorLabel(value: unknown) {
  if (value == null || value === '') return ''
  const labels: Record<string, string> = {
    '-1': 'Basement',
    '0': 'Ground Floor',
    '1': '1st Floor',
    '2': '2nd Floor',
    '3': '3rd Floor',
    '4': '4th Floor',
    '5': '5th Floor',
    '6': '6th Floor',
    '7': '7th Floor',
    '8': '8th Floor',
    '9': '9th Floor',
    '10': '10+ Floors',
  }
  const n = Number(value)
  if (Number.isFinite(n) && labels[String(n)]) return labels[String(n)]
  const text = String(value).trim()
  if (/ground/i.test(text)) return 'Ground Floor'
  return text
}

function contactFromLead(lead: LeadLike) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s1 = wd.step1 && typeof wd.step1 === 'object' ? (wd.step1 as Record<string, unknown>) : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? (wd.step2 as Record<string, unknown>) : {}
  return {
    phone: String(lead.customer_phone || s2.phone || '').trim(),
    email: String(lead.customer_email || s2.email || '').trim(),
    collection: String(lead.pickup_address || s1.pickupAddress || '').trim(),
    dropoff: String(lead.delivery_address || s1.deliveryAddress || '').trim(),
    collectionFloor: floorLabel(s1.pickupFloor),
    dropoffFloor: floorLabel(s1.deliveryFloor),
  }
}

function notesFromLead(lead: LeadLike) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? (wd.step3 as Record<string, unknown>) : {}
  const current = String(s3.specialInstructions || '').trim()
  const note = String(lead.price_override_reason || '').trim()
  const source = String(s3.specialInstructionsSource || '').trim()
  const hasSnapshot = typeof s3.customerSpecialInstructions === 'string'
  const stripNote = (text: string) => {
    if (!text) return ''
    if (!note || text === note) return text === note ? '' : text
    const kept: string[] = []
    let removed = false
    for (const line of text.split('\n')) {
      if (!removed && line.trim() === note) {
        removed = true
        continue
      }
      kept.push(line)
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  const customer = hasSnapshot
    ? String(s3.customerSpecialInstructions).trim()
    : source === 'admin'
      ? ''
      : stripNote(current)
  let admin = ''
  if (source === 'admin' && current && current !== customer) {
    admin = customer && current.startsWith(`${customer}\n`) ? current.slice(customer.length).trim() : current
  }
  if (note && admin !== note && !admin.split('\n').some((line) => line.trim() === note)) {
    admin = admin ? `${admin}\n${note}` : note
  }
  if (admin === customer) admin = note && note !== customer ? note : ''
  return { customer, admin }
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

  const notes = notesFromLead(lead)
  const customerNote = notes.customer
  const contact = contactFromLead(lead)
  const phone = contact.phone
  const email = contact.email
  const collection = contact.collection || route
  const dropoff = contact.dropoff || '—'
  const collectionFloor = contact.collectionFloor
  const dropoffFloor = contact.dropoffFloor
  const year = new Date().getFullYear()
  const siteUrl = siteBase()
  const inventory = inventoryFromLead(lead)
  const invRows = inventoryRowsHtml(inventory)

  const firstName = name.split(/\s+/)[0] || 'there'
  const payLabel = kind === 'payment_failed' ? 'Retry Payment' : 'Pay Now'
  const banner =
    kind === 'payment_failed'
      ? 'Payment unsuccessful'
      : kind === 'abandoned_final'
        ? 'Final reminder: your quote is still reserved'
        : kind === 'abandoned_reminder'
          ? 'Reminder: your quote is still reserved'
          : 'Your quote is still reserved'
  const introPlain =
    kind === 'payment_failed'
      ? `Hi ${firstName}, your payment for quote ${quoteRef} didn’t go through. No charge was made. You can retry payment or resume your quote below.`
      : kind === 'abandoned_final'
        ? `Hi ${firstName}, this is your final reminder. Your quote is still reserved — resume or pay now to secure your move.`
        : kind === 'abandoned_reminder'
          ? `Hi ${firstName}, just a reminder that your ShiftMyHome quote is still reserved and ready to finish.`
          : `Hi ${firstName}, you left before completing payment. Good news — your quote is still reserved.`
  const intro = `Hi ${escHtml(firstName)},<br />${escHtml(introPlain.replace(/^Hi [^,]+, /, ''))}`
  const subject =
    kind === 'payment_failed'
      ? `Your ShiftMyHome quote ${quoteRef} — payment unsuccessful`
      : `Your ShiftMyHome quote ${quoteRef} — ${total}`
  const priceReason = String(lead.price_override_reason || '').trim()
  const unpaidLine = kind === 'payment_failed' ? 'Not paid. No charge was made.' : 'Not paid yet.'
  const reducedBy =
    hasOverride && Number.isFinite(calculatedNum) && Number.isFinite(agreedNum) && calculatedNum - agreedNum > 0.009
      ? calculatedNum - agreedNum
      : 0
  const priceNote = hasOverride
    ? reducedBy
      ? `${unpaidLine} Was ${calculatedLabel}. Reduced by £${reducedBy.toFixed(2)}. Amount to pay ${total}.`
      : `${unpaidLine} Was ${calculatedLabel}. Amount to pay ${total}.`
    : `${unpaidLine} Amount to pay ${total}.`
  const priceBox = `<div style="font-size:13px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Amount to pay</div>
    ${hasOverride ? `<div style="margin-top:6px;font-size:16px;line-height:1.3;color:#64748b;">Was <span style="text-decoration:line-through;">${escHtml(calculatedLabel)}</span></div>` : ''}
    <div style="font-size:30px;font-weight:800;color:#047857;margin-top:2px;">${escHtml(total)}</div>
    <div style="font-size:13px;color:#065f46;margin-top:6px;line-height:1.5;">${escHtml(priceNote)}</div>`
  const logoUrl = `${siteUrl}/logo.png`
  const splitLines = (value: string) =>
    String(value || '')
      .split(/\s*,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => escHtml(part))
      .join('<br />')
  const detailLabel =
    'font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;'
  const detailValue = 'margin-top:4px;font-size:13px;font-weight:600;line-height:1.4;color:#0f172a;'
  const buttonStyle =
    'display:inline-block;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:12px;'
  const includedHtml = priceReason
    ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;"><span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid #a7f3d0;border-radius:999px;padding:3px 8px;">Included in price</span><div style="margin-top:6px;font-size:14px;line-height:1.55;color:#334155;white-space:pre-wrap;">${escHtml(priceReason)}</div></div>`
    : ''
  const notesBlock =
    customerNote || priceReason
      ? `<tr><td style="padding:14px 24px 0 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;"><div style="font-size:15px;font-weight:700;color:#0f172a;">Special instructions</div>${customerNote ? `<div style="margin-top:6px;font-size:14px;line-height:1.55;color:#334155;white-space:pre-wrap;">${escHtml(customerNote)}</div>` : ''}${includedHtml}</td></tr></table></td></tr>`
      : ''

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#eff6ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">
  Your quote ${escHtml(quoteRef)} for ${escHtml(moveDate)} is still reserved — ${escHtml(total)}.
  ${openTrack ? `<img src="${escHtml(openTrack)}" width="1" height="1" alt="" />` : ''}
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;border:1px solid #dbeafe;overflow:hidden;">
<tr><td style="padding:20px 24px;">
  <a href="${escHtml(siteUrl)}" style="text-decoration:none;"><img src="${escHtml(logoUrl)}" width="170" alt="ShiftMyHome" style="display:block;width:170px;max-width:100%;height:auto;border:0;" /></a>
</td></tr>
<tr><td style="padding:0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1d4ed8;border-radius:14px;"><tr><td style="padding:22px;">
    <div style="font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">${escHtml(banner)}</div>
    <div style="margin-top:6px;font-size:13px;color:#dbeafe;">Reference ${escHtml(quoteRef)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 24px 0 24px;font-size:15px;line-height:1.6;color:#334155;">
  ${intro}
</td></tr>
<tr><td style="padding:16px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 14px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td width="34%" valign="top" style="width:34%;padding-right:10px;border-right:1px solid #f1f5f9;">
          <div style="${detailLabel}">Name</div>
          <div style="${detailValue}">${escHtml(name)}</div>
          ${phone ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#334155;">${escHtml(phone)}</div>` : ''}
          ${email ? `<div style="margin-top:2px;font-size:12px;line-height:1.4;color:#334155;word-break:break-all;">${escHtml(email)}</div>` : ''}
        </td>
        <td width="33%" valign="top" style="width:33%;padding:0 10px;border-right:1px solid #f1f5f9;">
          <div style="${detailLabel}">Collection</div>
          <div style="${detailValue}">${splitLines(collection)}</div>
          ${collectionFloor ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#475569;">${escHtml(collectionFloor)}</div>` : ''}
        </td>
        <td width="33%" valign="top" style="width:33%;padding-left:10px;">
          <div style="${detailLabel}">Drop-off</div>
          <div style="${detailValue}">${splitLines(dropoff)}</div>
          ${dropoffFloor ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#475569;">${escHtml(dropoffFloor)}</div>` : ''}
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid #f1f5f9;">
      <tr>
        <td width="34%" valign="top" style="width:34%;padding:8px 10px 0 0;">
          <div style="${detailLabel}">Move date</div>
          <div style="${detailValue}">${escHtml(moveDate)}</div>
        </td>
        <td width="33%" valign="top" style="width:33%;padding:8px 10px 0 10px;">
          <div style="${detailLabel}">Service</div>
          <div style="${detailValue}">${escHtml(service)}</div>
        </td>
        <td width="33%" valign="top" style="width:33%;padding:8px 0 0 10px;">
          <div style="${detailLabel}">Crew</div>
          <div style="${detailValue}">${escHtml(crewLabel)}</div>
        </td>
      </tr>
    </table>
  </td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Inventory</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${invRows}</table>
  </td></tr></table>
</td></tr>
${notesBlock}
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;"><tr><td style="padding:16px;">
    ${priceBox}
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 24px 6px 24px;">
  <a href="${escHtml(trackPay)}" style="${buttonStyle}background:#2563eb;margin:0 0 10px 0;">${escHtml(payLabel)}</a><br />
  <a href="${escHtml(trackResume)}" style="${buttonStyle}background:#1d4ed8;">Resume Quote</a>
</td></tr>
<tr><td style="padding:6px 24px 0 24px;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
  If a button does not work, copy this link:<br />
  ${escHtml(payLabel)}: <a href="${escHtml(trackPay)}" style="color:#2563eb;word-break:break-all;">${escHtml(trackPay)}</a><br />
  Resume Quote: <a href="${escHtml(trackResume)}" style="color:#2563eb;word-break:break-all;">${escHtml(trackResume)}</a>
</td></tr>
<tr><td style="padding:20px 24px 24px 24px;font-size:12px;line-height:1.6;background:#020617;color:#cbd5e1;border-top:1px solid #1e293b;">
  Questions? Call <a href="tel:+441414614813" style="color:#e2e8f0;text-decoration:none;">0141 461 4813</a> or email <a href="mailto:admin@shiftmyhome.co.uk" style="color:#e2e8f0;text-decoration:none;">admin@shiftmyhome.co.uk</a>.<br />
  ShiftMyHome · <a href="${escHtml(siteUrl)}" style="color:#94a3b8;text-decoration:none;">${escHtml(siteUrl.replace(/^https?:\/\//, ''))}</a><br />
  <span style="color:#94a3b8;">© ${year} ShiftMyHome</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    banner,
    '',
    introPlain,
    name,
    phone || null,
    email || null,
    `Collection: ${collection}${collectionFloor ? ` · ${collectionFloor}` : ''}`,
    `Drop-off: ${dropoff}${dropoffFloor ? ` · ${dropoffFloor}` : ''}`,
    `Quote: ${quoteRef}`,
    `Service: ${service}`,
    `Move date: ${moveDate}`,
    `Crew: ${crewLabel}`,
    hasOverride ? `Was: ${calculatedLabel}` : null,
    reducedBy ? `Reduced by: £${reducedBy.toFixed(2)}` : null,
    hasOverride ? `Amount to pay: ${total}` : `Total: ${total}`,
    customerNote ? `Special instructions: ${customerNote}` : null,
    priceReason ? `Included in price: ${priceReason}` : null,
    '',
    `Resume Quote: ${trackResume}`,
    `${payLabel}: ${trackPay}`,
    '',
    'Glasgow, Scotland',
    '0141 461 4813 · admin@shiftmyhome.co.uk',
    siteUrl,
  ]
    .filter((line) => line != null)
    .join('\n')

  return { subject, html, text, resumeUrl: trackResume, payUrl: trackPay }
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
