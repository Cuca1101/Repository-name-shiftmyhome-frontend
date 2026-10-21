import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { siteBaseUrl } from '../_shared/jobCustomerNotify.ts'
import { refreshLeadOfferFlag } from '../_shared/customerOfferCheckout.ts'
import { formatDateUK } from '../_shared/formatDateUK.ts'

/**
 * Customer budget offers.
 * Public: submit, view, accept_counter, decline_counter
 * Admin:  accept, decline, counter
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

function money(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function text(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max)
}

function newToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function offerUrl(token: string) {
  return `${siteBaseUrl()}/offer/${encodeURIComponent(token)}`
}

function gbp(amount: number) {
  return `£${amount.toFixed(2)}`
}

function event(partial: Record<string, unknown>) {
  return { ...partial, at: new Date().toISOString() }
}

async function loadSettings(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from('pricing_settings').select('data').eq('id', 1).maybeSingle()
  const settings = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : {}
  const hours = Number((settings as Record<string, unknown>).offerExpiryHours)
  const offerExpiryHours = Number.isFinite(hours) && hours > 0 ? Math.min(24 * 30, Math.round(hours)) : 48
  const depositRaw = Number((settings as Record<string, unknown>).depositAmount)
  const depositGbp = Number.isFinite(depositRaw) && depositRaw > 0 ? Math.round(depositRaw * 100) / 100 : 0
  return { offerExpiryHours, depositGbp }
}

async function expireIfNeeded(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  const expiresAt = Date.parse(String(row.expires_at || ''))
  const open = ['pending', 'accepted', 'countered', 'counter_accepted'].includes(String(row.status || ''))
  if (!open || !Number.isFinite(expiresAt) || expiresAt > Date.now() || row.booked_at) return row
  const history = Array.isArray(row.history) ? [...row.history] : []
  history.push(event({ type: 'expired', status: 'expired', actor: 'system', actor_label: 'System' }))
  const { data } = await admin
    .from('customer_offers')
    .update({ status: 'expired', history, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select('*')
    .maybeSingle()
  if (row.lead_id) await refreshLeadOfferFlag(admin, String(row.lead_id))
  return (data || { ...row, status: 'expired', history }) as Record<string, unknown>
}

function publicOffer(row: Record<string, unknown>, depositGbp: number) {
  const snapshot = row.move_snapshot && typeof row.move_snapshot === 'object' ? row.move_snapshot as Record<string, unknown> : {}
  const summary = snapshot.summary && typeof snapshot.summary === 'object' ? snapshot.summary : {}
  const agreed = money(row.agreed_amount)
  const payable = ['accepted', 'counter_accepted'].includes(String(row.status)) && !row.booked_at && agreed != null && agreed > 0
  const depositAllowed = payable && depositGbp > 0 && agreed != null && depositGbp < agreed - 0.009
  const history = Array.isArray(row.history)
    ? row.history.map((item) => {
        const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {}
        return {
          type: entry.type || '',
          status: entry.status || '',
          amount: money(entry.amount),
          message: text(entry.message, 2000),
          actor: entry.actor || '',
          actor_label: entry.actor === 'admin' ? 'ShiftMyHome' : text(entry.actor_label, 80) || 'Customer',
          at: entry.at || '',
        }
      })
    : []
  return {
    status: row.status,
    expired: row.status === 'expired',
    payable,
    booked: Boolean(row.booked_at) || row.status === 'booked',
    original_total: money(row.original_total),
    proposed_amount: money(row.proposed_amount),
    agreed_amount: agreed,
    counter_amount: money(row.counter_amount),
    message: text(row.message, 2000),
    date_flexibility: text(row.date_flexibility, 500),
    expires_at: row.expires_at,
    quote_ref: row.quote_ref || '',
    customer_name: row.customer_name || '',
    customer_email: row.customer_email || '',
    summary,
    history,
    deposit_gbp: depositAllowed ? depositGbp : null,
    deposit_allowed: depositAllowed,
  }
}

function escHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function emailShell(title: string, body: string, href: string, cta: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${title}</h1>
          <div style="font-size:15px;line-height:1.55;color:#334155;">${body}</div>
          <p style="margin:22px 0 0;"><a href="${href}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px;">${cta}</a></p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#64748b;">You can open this page without creating an account. An offer does not reserve a removal slot until payment is completed.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function acceptedOfferMail(row: Record<string, unknown>) {
  const snapshot = row.move_snapshot && typeof row.move_snapshot === 'object'
    ? row.move_snapshot as Record<string, unknown>
    : {}
  const summary = snapshot.summary && typeof snapshot.summary === 'object'
    ? snapshot.summary as Record<string, unknown>
    : {}
  const identity = snapshot.identity && typeof snapshot.identity === 'object'
    ? snapshot.identity as Record<string, unknown>
    : {}
  const name = text(row.customer_name, 120) || 'there'
  const quoteRef = text(row.quote_ref, 40) || '—'
  const route = text(summary.route, 300) || '—'
  const service = text(summary.packageName, 80) || '—'
  const moveDate = formatDateUK(summary.moveDate || identity.moveDate)
  const crew = summary.crewSize ?? identity.crewSize
  const crewLabel = crew != null && String(crew).trim() ? String(crew) : '—'
  const agreed = money(row.agreed_amount ?? row.proposed_amount)
  const original = money(row.original_total)
  const agreedLabel = agreed != null ? gbp(agreed) : '—'
  const originalLabel = original != null ? gbp(original) : '—'
  const showOriginal = original != null && agreed != null && Math.abs(original - agreed) > 0.009
  const viewUrl = offerUrl(String(row.view_token || ''))
  const payUrl = `${viewUrl}?pay=1`
  const heldUntil = formatDateUK(row.expires_at)
  const inventory = Array.isArray(identity.inventory) ? identity.inventory : []
  const invRows = inventory.length
    ? inventory.map((line) => {
        const item = line && typeof line === 'object' ? line as Record<string, unknown> : {}
        const label = escHtml(text(item.name, 120) || 'Item')
        const qty = Math.max(1, Math.round(Number(item.quantity ?? item.qty ?? 1) || 1))
        return `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${label}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">×${qty}</td></tr>`
      }).join('')
    : `<tr><td colspan="2" style="padding:6px 0;color:#64748b;">The items are listed on your offer page.</td></tr>`
  const subject = `[ShiftMyHome] Offer accepted — pay for ${quoteRef}`
  const intro = `Hi ${escHtml(name)}, we accepted your offer. Pay now to book this move. Nothing is reserved until payment is completed, and this price is held until ${escHtml(heldUntil)}.`
  const priceRows = showOriginal
    ? `<tr><td style="padding:4px 0;"><strong>Quoted total</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(originalLabel)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Agreed price</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;">${escHtml(agreedLabel)}</td></tr>`
    : `<tr><td style="padding:4px 0;"><strong>Agreed price</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;">${escHtml(agreedLabel)}</td></tr>`
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;">Your offer was accepted</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">${intro}</p>
          <table width="100%" style="font-size:14px;color:#334155;margin-bottom:16px;">
            <tr><td style="padding:4px 0;"><strong>Quote</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(quoteRef)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Route</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(route)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Service</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(service)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Move date</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(moveDate)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Crew</strong></td><td style="padding:4px 0;text-align:right;">${escHtml(crewLabel)}</td></tr>
            ${priceRows}
          </table>
          <h2 style="font-size:15px;margin:0 0 8px;">Inventory</h2>
          <table width="100%" style="font-size:14px;color:#334155;margin-bottom:20px;">${invRows}</table>
          <p style="margin:0 0 12px;">
            <a href="${escHtml(payUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Pay now</a>
          </p>
          <p style="margin:0 0 8px;">
            <a href="${escHtml(viewUrl)}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">View offer</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#64748b;">No account is needed. The amount charged is the agreed price, checked again before payment. If the moving date is full, payment will not start.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  const plain = [
    'Your offer was accepted',
    '',
    `Hi ${name}, we accepted your offer. Pay now to book this move. Nothing is reserved until payment is completed, and this price is held until ${heldUntil}.`,
    `Quote: ${quoteRef}`,
    `Route: ${route}`,
    `Service: ${service}`,
    `Move date: ${moveDate}`,
    `Crew: ${crewLabel}`,
    showOriginal ? `Quoted total: ${originalLabel}` : null,
    `Agreed price: ${agreedLabel}`,
    '',
    `Pay now: ${payUrl}`,
    `View offer: ${viewUrl}`,
  ].filter((line) => line != null).join('\n')
  return { subject, html, text: plain }
}

async function emailCustomer(
  row: Record<string, unknown>,
  subject: string,
  title: string,
  body: string,
  cta: string,
) {
  const to = text(row.customer_email, 200)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return
  const href = offerUrl(String(row.view_token || ''))
  await sendResendEmail({
    to,
    subject,
    html: emailShell(title, body, href, cta),
    text: `${title}\n\n${body.replace(/<[^>]+>/g, ' ')}\n\n${href}`,
    logTag: 'customer-offer',
  })
}

async function notifyAdmins(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  const { data } = await admin.rpc('list_admin_notification_emails')
  const emails = Array.isArray(data) ? data.map((item) => String(item || '').trim()).filter(Boolean) : []
  if (!emails.length) return
  const proposed = money(row.proposed_amount)
  const original = money(row.original_total)
  const ref = text(row.quote_ref, 40) || 'a quote'
  await sendResendEmail({
    to: emails,
    subject: `New customer offer for ${ref}`,
    html: `<p>A customer sent an offer for <strong>${ref}</strong>.</p>
      <p>Quoted total: ${original != null ? gbp(original) : '—'}<br>Offered total: ${proposed != null ? gbp(proposed) : '—'}</p>
      <p>Open the customer lead in admin to accept, decline, or counter.</p>`,
    text: `New customer offer for ${ref}. Quoted ${original ?? '—'}, offered ${proposed ?? '—'}.`,
    logTag: 'customer-offer-admin',
  })
}

async function requireAdmin(req: Request, admin: ReturnType<typeof createClient>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ') || !anonKey) return null
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user) return null
  const allowed = await assertAdminCaller(admin, data.user)
  if (!allowed.ok) return null
  return data.user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
  const admin = createClient(supabaseUrl, serviceKey)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = text(body.action, 40)

  if (action === 'submit') {
    const original = money(body.original_total)
    const proposed = money(body.proposed_amount)
    const hash = text(body.snapshot_hash, 80)
    const email = text(body.customer_email, 200).toLowerCase()
    const name = text(body.customer_name, 120)
    const phone = text(body.customer_phone, 40)
    const quoteRef = text(body.quote_ref, 40)
    const quoteLead = body.quote_lead && typeof body.quote_lead === 'object' && !Array.isArray(body.quote_lead)
      ? body.quote_lead as Record<string, unknown>
      : null
    const identity = body.identity && typeof body.identity === 'object' && !Array.isArray(body.identity)
      ? body.identity as Record<string, unknown>
      : null
    if (original == null || original <= 0 || proposed == null || proposed <= 0) {
      return jsonResponse({ ok: false, error: 'invalid_amount', message: 'Enter a proposed total in pounds.' }, 400)
    }
    if (proposed >= original - 0.009) {
      return jsonResponse({ ok: false, error: 'amount_not_below_quote', message: 'Enter an amount below your current quote.' }, 400)
    }
    if (!/^[a-f0-9]{64}$/.test(hash) || !identity || !quoteLead) {
      return jsonResponse({ ok: false, error: 'invalid_snapshot', message: 'This offer could not be matched to your quote. Refresh and try again.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || phone.length < 6) {
      return jsonResponse({ ok: false, error: 'invalid_contact', message: 'Add your name, phone, and email so we can reply.' }, 400)
    }

    const leadId = text(body.lead_id, 60)
    const sessionId = text(body.session_id, 80)
    let lead: { id: string } | null = null
    if (/^[0-9a-f-]{36}$/i.test(leadId)) {
      const { data } = await admin.from('customer_leads').select('id').eq('id', leadId).maybeSingle()
      lead = data
    }
    if (!lead && sessionId) {
      const { data } = await admin.from('customer_leads').select('id').eq('session_id', sessionId).maybeSingle()
      lead = data
    }
    if (!lead && quoteRef) {
      const { data } = await admin.from('customer_leads').select('id').eq('quote_ref', quoteRef).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      lead = data
    }

    if (lead?.id) {
      const { data: same } = await admin
        .from('customer_offers')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('snapshot_hash', hash)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (same) {
        return jsonResponse({ ok: true, duplicate: true, token: same.view_token, offer: publicOffer(same, 0) })
      }
      const { data: older } = await admin
        .from('customer_offers')
        .select('id, history')
        .eq('lead_id', lead.id)
        .in('status', ['pending', 'countered'])
      for (const item of older || []) {
        const history = Array.isArray(item.history) ? [...item.history] : []
        history.push(event({ type: 'superseded', status: 'superseded', actor: 'customer', actor_label: 'Customer' }))
        await admin.from('customer_offers').update({ status: 'superseded', history, updated_at: new Date().toISOString() }).eq('id', item.id)
      }
    }

    const { offerExpiryHours } = await loadSettings(admin)
    const expires = new Date(Date.now() + offerExpiryHours * 3600 * 1000).toISOString()
    const summary = body.summary && typeof body.summary === 'object' ? body.summary : {}
    const message = text(body.message, 2000)
    const flexibility = text(body.date_flexibility, 500)
    const history = [
      event({
        type: 'customer_offer',
        status: 'pending',
        amount: proposed,
        message,
        actor: 'customer',
        actor_label: name,
      }),
    ]
    const { data: created, error: insertErr } = await admin
      .from('customer_offers')
      .insert({
        lead_id: lead?.id || null,
        quote_ref: quoteRef || null,
        session_id: sessionId || null,
        status: 'pending',
        original_total: original,
        proposed_amount: proposed,
        message: message || null,
        date_flexibility: flexibility || null,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        move_snapshot: { identity, summary },
        quote_lead: { ...quoteLead, quote_ref: quoteRef || quoteLead.quote_ref || null, email, full_name: name, phone },
        snapshot_hash: hash,
        history,
        view_token: newToken(),
        expires_at: expires,
      })
      .select('*')
      .single()
    if (insertErr || !created) {
      console.error('[customer-offer] insert', insertErr?.message)
      return jsonResponse({ ok: false, error: 'save_failed', message: 'We could not save your offer. Please try again.' }, 500)
    }
    if (lead?.id) await refreshLeadOfferFlag(admin, lead.id)
    void notifyAdmins(admin, created).catch((err) => console.error('[customer-offer] admin email', err))
    return jsonResponse({ ok: true, duplicate: false, token: created.view_token, offer: publicOffer(created, 0) })
  }

  if (action === 'view' || action === 'accept_counter' || action === 'decline_counter') {
    const token = text(body.token, 80)
    if (token.length < 20) return jsonResponse({ ok: false, error: 'not_found' }, 404)
    const { data } = await admin.from('customer_offers').select('*').eq('view_token', token).maybeSingle()
    if (!data) return jsonResponse({ ok: false, error: 'not_found', message: 'This offer link is not valid.' }, 404)
    let row = await expireIfNeeded(admin, data)
    const settings = await loadSettings(admin)

    if (action === 'view') return jsonResponse({ ok: true, offer: publicOffer(row, settings.depositGbp) })

    if (String(row.status) !== 'countered') {
      return jsonResponse({ ok: false, error: 'not_countered', message: 'There is no counteroffer waiting for a reply.' }, 409)
    }
    const counter = money(row.counter_amount)
    if (counter == null || counter <= 0) {
      return jsonResponse({ ok: false, error: 'invalid_counter', message: 'This counteroffer is missing an amount.' }, 409)
    }
    const accepting = action === 'accept_counter'
    const history = Array.isArray(row.history) ? [...row.history] : []
    history.push(event({
      type: accepting ? 'customer_accept' : 'customer_decline',
      status: accepting ? 'counter_accepted' : 'counter_declined',
      amount: counter,
      actor: 'customer',
      actor_label: text(row.customer_name, 80) || 'Customer',
    }))
    const { data: updated, error: updateErr } = await admin
      .from('customer_offers')
      .update({
        status: accepting ? 'counter_accepted' : 'counter_declined',
        agreed_amount: accepting ? counter : null,
        history,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'countered')
      .select('*')
      .maybeSingle()
    if (updateErr || !updated) return jsonResponse({ ok: false, error: 'save_failed', message: 'Could not save your reply. Please try again.' }, 500)
    if (row.lead_id) await refreshLeadOfferFlag(admin, String(row.lead_id))
    row = updated
    if (accepting) {
      const mail = acceptedOfferMail(updated)
      const to = text(updated.customer_email, 200)
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        void sendResendEmail({
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          logTag: 'customer-offer',
        }).catch((err) => console.error('[customer-offer] counter accept email', err))
      }
    }
    return jsonResponse({ ok: true, offer: publicOffer(row, settings.depositGbp) })
  }

  if (action === 'accept' || action === 'decline' || action === 'counter') {
    const user = await requireAdmin(req, admin)
    if (!user) return jsonResponse({ ok: false, error: 'unauthorized', message: 'Admin sign-in required.' }, 401)
    const offerId = text(body.offer_id, 60)
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) return jsonResponse({ ok: false, error: 'not_found' }, 404)
    const { data } = await admin.from('customer_offers').select('*').eq('id', offerId).maybeSingle()
    if (!data) return jsonResponse({ ok: false, error: 'not_found' }, 404)
    let row = await expireIfNeeded(admin, data)
    if (row.status === 'expired') {
      return jsonResponse({ ok: false, error: 'expired', message: 'This offer has expired.' }, 409)
    }
    if ((action === 'accept' || action === 'counter') && row.status !== 'pending') {
      return jsonResponse({ ok: false, error: 'not_pending', message: 'This offer is no longer waiting for a decision.' }, 409)
    }
    if (action === 'decline' && row.status !== 'pending' && row.status !== 'countered') {
      return jsonResponse({ ok: false, error: 'not_pending', message: 'This offer can no longer be declined.' }, 409)
    }

    const actor = text(user.email, 120) || 'Admin'
    const note = text(body.message, 2000)
    const history = Array.isArray(row.history) ? [...row.history] : []
    let patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (action === 'accept') {
      if (row.status !== 'pending') {
        return jsonResponse({ ok: false, error: 'not_pending', message: 'Only a pending customer offer can be accepted.' }, 409)
      }
      const proposed = money(row.proposed_amount)
      if (proposed == null) return jsonResponse({ ok: false, error: 'invalid_amount' }, 409)
      history.push(event({ type: 'admin_accept', status: 'accepted', amount: proposed, message: note, actor: 'admin', actor_label: actor }))
      patch = { ...patch, status: 'accepted', agreed_amount: proposed, history }
    } else if (action === 'decline') {
      if (row.status !== 'pending' && row.status !== 'countered') {
        return jsonResponse({ ok: false, error: 'not_pending', message: 'This offer can no longer be declined.' }, 409)
      }
      history.push(event({ type: 'admin_decline', status: 'declined', amount: money(row.proposed_amount), message: note, actor: 'admin', actor_label: actor }))
      patch = { ...patch, status: 'declined', history }
    } else {
      if (row.status !== 'pending') {
        return jsonResponse({ ok: false, error: 'not_pending', message: 'Send a counteroffer while the customer offer is still pending.' }, 409)
      }
      const counter = money(body.counter_amount)
      const proposed = money(row.proposed_amount)
      if (counter == null || counter <= 0 || counter > 500000) {
        return jsonResponse({ ok: false, error: 'invalid_amount', message: 'Enter a counteroffer amount in pounds.' }, 400)
      }
      if (proposed != null && Math.abs(counter - proposed) < 0.009) {
        return jsonResponse({ ok: false, error: 'same_amount', message: 'A counteroffer needs a different amount from the customer offer.' }, 400)
      }
      history.push(event({ type: 'admin_counter', status: 'countered', amount: counter, message: note, actor: 'admin', actor_label: actor }))
      patch = { ...patch, status: 'countered', counter_amount: counter, agreed_amount: null, history }
    }

    const { data: updated, error: updateErr } = await admin
      .from('customer_offers')
      .update(patch)
      .eq('id', row.id)
      .select('*')
      .maybeSingle()
    if (updateErr || !updated) return jsonResponse({ ok: false, error: 'save_failed', message: 'Could not save this decision.' }, 500)
    if (row.lead_id) await refreshLeadOfferFlag(admin, String(row.lead_id))

    const original = money(updated.original_total)
    const proposed = money(updated.proposed_amount)
    const counter = money(updated.counter_amount)
        if (action === 'accept' && proposed != null) {
      const mail = acceptedOfferMail(updated)
      const to = text(updated.customer_email, 200)
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        void sendResendEmail({
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          logTag: 'customer-offer',
        }).catch((err) => console.error('[customer-offer] accept email', err))
      }
    } else if (action === 'decline') {
      void emailCustomer(
        updated,
        `Update on your ShiftMyHome offer`,
        'We could not accept this offer',
        `<p>Thanks for telling us your budget. We are not able to accept ${proposed != null ? gbp(proposed) : 'that amount'} for this move.</p>
         ${note ? `<p>${note.replace(/</g, '')}</p>` : ''}
         <p>Your original quote is unchanged. You can still book it, or send a different offer.</p>`,
        'View the reply',
      )
    } else if (counter != null) {
      void emailCustomer(
        updated,
        `ShiftMyHome sent a counteroffer`,
        'We have a counteroffer',
        `<p>You offered ${proposed != null ? gbp(proposed) : 'a lower total'}${original != null ? ` on a ${gbp(original)} quote` : ''}. We can do this move for <strong>${gbp(counter)}</strong>.</p>
         ${note ? `<p>${note.replace(/</g, '')}</p>` : ''}
         <p>Accepting the counteroffer takes you to checkout at that agreed total. It does not reserve the slot until payment is completed.</p>`,
        'View counteroffer',
      )
    }

    return jsonResponse({ ok: true, offer: updated })
  }

  return jsonResponse({ ok: false, error: 'unknown_action' }, 400)
})
