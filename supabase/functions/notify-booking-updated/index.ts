import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resendClient.ts'
import {
  isUniqueViolation,
  notificationClaimDecision,
} from '../_shared/deliveryRetryPolicy.js'
import { saveCustomerEmailArchive } from '../_shared/customerEmailArchive.ts'
import { customerFirstName } from '../_shared/jobCustomerNotify.ts'

/**
 * Notify customer after admin Edit Booking save.
 *
 * Body: {
 *   quote_id: string,
 *   change_set_id: string,
 *   changes: Array<{ label, previous, next, kind? }>,
 *   quote_ref?: string,
 * }
 *
 * Idempotent per (quote_id, event_key) where event_key = booking_modified:{change_set_id}.
 * Retry reclaims failed/pending claims only — already-sent is skipped (no duplicates).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function authorized(req: Request) {
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const auth = req.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (serviceKey && bearer === serviceKey) return true
  if (bearer && bearer.length > 40) return true
  return false
}

function esc(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

type ChangeRow = { label: string; previous: string; next: string; kind?: string }

function normalizeChanges(raw: unknown): ChangeRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const label = String(r.label || '').trim()
      const previous = String(r.previous ?? '').trim() || '—'
      const next = String(r.next ?? '').trim() || '—'
      if (!label) return null
      if (previous === next) return null
      return {
        label,
        previous,
        next,
        kind: r.kind != null ? String(r.kind) : undefined,
      }
    })
    .filter(Boolean) as ChangeRow[]
}

function buildBookingUpdatedEmail(params: {
  firstName: string
  quoteRef: string
  changes: ChangeRow[]
  supportEmail: string
  companyName: string
  logoUrl: string
  websiteUrl: string
}) {
  const { firstName, quoteRef, changes, supportEmail, companyName, logoUrl, websiteUrl } = params
  const subject = `[${companyName}] Your booking has been updated — ${quoteRef}`

  const changeRowsHtml = changes
    .map(
      (c) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 6px 0;">${esc(c.label)}</div>
          <div style="font-size:13px;line-height:1.5;color:#475569;">
            <span style="color:#94a3b8;">${esc(c.previous)}</span>
            <span style="margin:0 6px;color:#cbd5e1;">→</span>
            <strong style="color:#0f172a;">${esc(c.next)}</strong>
          </div>
        </td>
      </tr>`,
    )
    .join('')

  const changeRowsText = changes
    .map((c) => `- ${c.label}: ${c.previous} → ${c.next}`)
    .join('\n')

  const html = `<!doctype html>
<html>
<body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:22px 24px 12px 24px;background:linear-gradient(180deg,#f0f9ff 0%,#ffffff 100%);border-bottom:1px solid #e2e8f0;">
            ${
              logoUrl
                ? `<img src="${esc(logoUrl)}" alt="${esc(companyName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 14px 0;" />`
                : `<div style="font-size:18px;font-weight:800;color:#0284c7;margin:0 0 10px 0;">${esc(companyName)}</div>`
            }
            <h1 style="margin:0;font-size:20px;line-height:1.3;color:#0f172a;">Your booking has been updated</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px 8px 24px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">Hi ${esc(firstName)},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
              We’ve updated your ShiftMyHome booking. Here is what changed:
            </p>
            <p style="margin:0 0 14px;font-size:13px;color:#64748b;">
              <strong style="color:#0f172a;">Booking reference:</strong> ${esc(quoteRef)}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;">
              ${changeRowsHtml}
            </table>
            <p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#475569;">
              If anything looks incorrect, reply to this email or contact us at
              <a href="mailto:${esc(supportEmail)}" style="color:#0284c7;font-weight:600;text-decoration:none;">${esc(supportEmail)}</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 22px 24px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;">
              ${esc(companyName)} · <a href="${esc(websiteUrl)}" style="color:#64748b;">${esc(websiteUrl.replace(/^https?:\/\//, ''))}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    `Hi ${firstName},`,
    '',
    'We’ve updated your ShiftMyHome booking. Here is what changed:',
    '',
    `Booking reference: ${quoteRef}`,
    '',
    changeRowsText,
    '',
    `If anything looks incorrect, contact us at ${supportEmail}.`,
    '',
    companyName,
  ].join('\n')

  return { subject, html, text }
}

async function claimNotification(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: string,
) {
  const insert = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: 'Booking updated',
    delivery_status: 'pending',
  })
  if (!insert.error) return { claimed: true as const }

  if (!isUniqueViolation(insert.error)) {
    return { claimed: false as const, reason: insert.error.message }
  }

  const { data: existing } = await supabase
    .from('job_customer_notifications')
    .select('id, delivery_status, created_at')
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
    .maybeSingle()

  const decision = notificationClaimDecision(existing)
  if (decision === 'already_sent') return { claimed: false as const, reason: 'already_sent' }
  if (decision === 'in_flight') return { claimed: false as const, reason: 'in_flight' }

  await supabase
    .from('job_customer_notifications')
    .delete()
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
    .in('delivery_status', ['failed', 'pending'])

  const retry = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: 'Booking updated',
    delivery_status: 'pending',
  })
  if (!retry.error) return { claimed: true as const }
  if (isUniqueViolation(retry.error)) return { claimed: false as const, reason: 'already_sent' }
  return { claimed: false as const, reason: retry.error.message }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }
  if (!authorized(req)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const body = await req.json().catch(() => ({}))
    const quoteId = typeof body?.quote_id === 'string' ? body.quote_id.trim() : ''
    const changeSetId =
      typeof body?.change_set_id === 'string' ? body.change_set_id.trim() : ''
    const changes = normalizeChanges(body?.changes)

    if (!quoteId || !changeSetId) {
      return jsonResponse({ ok: false, error: 'quote_id_and_change_set_id_required' }, 400)
    }
    if (!changes.length) {
      return jsonResponse({ ok: false, error: 'no_changes', skipped: true }, 200)
    }

    const eventKey = `booking_modified:${changeSetId}`
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, quote_ref, email, full_name')
      .eq('id', quoteId)
      .maybeSingle()

    if (quoteError || !quote) {
      return jsonResponse({ ok: false, error: 'quote_not_found' }, 404)
    }

    const email = String(quote.email || '').trim()
    if (!email || email.endsWith('@shiftmyhome.local')) {
      return jsonResponse({ ok: false, error: 'missing_email', skipped: true }, 200)
    }

    const claim = await claimNotification(supabase, quoteId, eventKey)
    if (!claim.claimed) {
      return jsonResponse(
        {
          ok: claim.reason === 'already_sent',
          skipped: true,
          reason: claim.reason || 'not_claimed',
          error: claim.reason || 'not_claimed',
        },
        claim.reason === 'already_sent' ? 200 : 409,
      )
    }

    const companyName = (Deno.env.get('COMPANY_NAME') || 'ShiftMyHome').trim()
    const supportEmail = (Deno.env.get('SUPPORT_EMAIL') || 'bookings@shiftmyhome.co.uk').trim()
    const websiteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')
    const logoUrl = (Deno.env.get('COMPANY_LOGO_URL') || Deno.env.get('EMAIL_LOGO_URL') || '').trim()
    const quoteRef =
      (typeof body?.quote_ref === 'string' && body.quote_ref.trim()) ||
      String(quote.quote_ref || '').trim() ||
      '—'

    const rendered = buildBookingUpdatedEmail({
      firstName: customerFirstName(quote.full_name),
      quoteRef,
      changes,
      supportEmail,
      companyName,
      logoUrl,
      websiteUrl,
    })

    const send = await sendResendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `booking-updated-${quoteId}-${changeSetId}`,
      logTag: 'notify-booking-updated',
    })

    if (!send.ok) {
      await supabase
        .from('job_customer_notifications')
        .update({
          delivery_status: 'failed',
          recipient_email: email,
          payload: { changes, change_set_id: changeSetId, error: send.error || 'send_failed' },
        })
        .eq('quote_id', quoteId)
        .eq('event_key', eventKey)

      return jsonResponse({ ok: false, error: send.error || 'send_failed' }, 502)
    }

    const { data: noteRow } = await supabase
      .from('job_customer_notifications')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('event_key', eventKey)
      .maybeSingle()

    await supabase
      .from('job_customer_notifications')
      .update({
        delivery_status: 'sent',
        recipient_email: email,
        provider_message_id: send.resendId || null,
        payload: { changes, change_set_id: changeSetId },
        sent_at: new Date().toISOString(),
      })
      .eq('quote_id', quoteId)
      .eq('event_key', eventKey)

    await saveCustomerEmailArchive(supabase, {
      quoteId,
      notificationId: noteRow?.id || null,
      eventKey,
      subject: rendered.subject,
      recipientEmail: email,
      html: rendered.html,
      text: rendered.text,
      providerMessageId: send.resendId || null,
      providerStatus: 'sent',
    })

    return jsonResponse({
      ok: true,
      event_key: eventKey,
      resend_id: send.resendId || null,
    })
  } catch (e) {
    console.error('[notify-booking-updated]', e)
    return jsonResponse(
      { ok: false, error: e instanceof Error ? e.message : 'notify_failed' },
      500,
    )
  }
})
