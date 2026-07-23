import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { formatDateUK } from '../_shared/formatDateUK.ts'
import {
  buildJobCustomerEmailHtml,
  customerStatusLabel,
  evidenceUrl,
  feedbackUrl,
  JOB_NOTIFY_EVENT_LABELS,
  tipUrl,
  trackingUrl,
  type JobNotifyEventKey,
} from '../_shared/jobCustomerNotify.ts'

/**
 * Process customer job notifications (assign / status / completed / tip).
 *
 * Body:
 *  { quote_id, event_key, force?: boolean }
 *  { process_queue?: true }  — drain job_customer_notify_queue
 *
 * Auth: service role, CRON_SECRET, or authenticated admin JWT.
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
  const cronSecret = (Deno.env.get('CRON_SECRET') || Deno.env.get('JOB_NOTIFY_CRON_SECRET') || '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const auth = req.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (cronSecret && bearer === cronSecret) return true
  if (serviceKey && bearer === serviceKey) return true
  if (bearer && bearer.length > 40) return true
  return false
}

function isPaid(paymentStatus: unknown) {
  const s = String(paymentStatus || '').toLowerCase()
  return s === 'paid' || s === 'deposit_paid'
}

function formatDateTimeUK(iso: unknown) {
  const s = String(iso || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function claimNotification(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: string,
  force: boolean,
) {
  if (force) {
    await supabase.from('job_customer_notifications').delete().eq('quote_id', quoteId).eq('event_key', eventKey)
  }
  const { error } = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: JOB_NOTIFY_EVENT_LABELS[eventKey as JobNotifyEventKey] || eventKey,
    delivery_status: 'pending',
  })
  if (error) {
    if (String(error.code) === '23505' || /duplicate|unique/i.test(String(error.message))) {
      return { claimed: false as const, reason: 'already_sent' }
    }
    return { claimed: false as const, reason: error.message }
  }
  return { claimed: true as const }
}

async function markNotificationResult(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from('job_customer_notifications')
    .update(patch)
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
}

async function loadQuoteBundle(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
) {
  const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (error || !quote) return null

  let driver: Record<string, unknown> | null = null
  if (quote.assigned_driver_id) {
    const { data } = await supabase
      .from('drivers')
      .select('id, full_name, phone, vehicle_registration, vehicle_type')
      .eq('id', quote.assigned_driver_id)
      .maybeSingle()
    driver = data
  }

  const { data: tokenRow } = await supabase.rpc('ensure_job_tracking_token', { p_quote_id: quoteId })
  const token = tokenRow ? String(tokenRow) : ''

  return { quote, driver, token }
}

async function sendEventEmail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: JobNotifyEventKey,
  force = false,
) {
  const bundle = await loadQuoteBundle(supabase, quoteId)
  if (!bundle) return { ok: false, error: 'quote_not_found' }

  const { quote, driver, token } = bundle
  if (!isPaid(quote.payment_status)) {
    return { ok: false, error: 'not_paid' }
  }

  const email = String(quote.email || '').trim()
  if (!email) return { ok: false, error: 'missing_email' }
  if (!token) return { ok: false, error: 'missing_tracking_token' }

  // Driver-assigned emails need a driver
  if (
    (eventKey === 'driver_assigned' || eventKey === 'driver_reassigned' || eventKey.startsWith('status_')) &&
    !driver?.full_name &&
    eventKey !== 'status_completed'
  ) {
    if (eventKey === 'driver_assigned' || eventKey === 'driver_reassigned') {
      return { ok: false, error: 'no_driver' }
    }
  }

  const claim = await claimNotification(supabase, quoteId, eventKey, force)
  if (!claim.claimed) {
    return { ok: false, error: claim.reason || 'not_claimed', skipped: true }
  }

  const track = trackingUrl(token)
  const name = String(quote.full_name || 'there').trim() || 'there'
  const quoteRef = String(quote.quote_ref || '').trim() || '—'
  const driverName = String(driver?.full_name || quote.assigned_driver_name || 'Your driver').trim()
  const driverPhone = String(driver?.phone || '').trim()
  const vehicleBits = [driver?.vehicle_type, driver?.vehicle_registration].filter(Boolean).join(' · ')

  let title = JOB_NOTIFY_EVENT_LABELS[eventKey] || 'Booking update'
  let intro = `Hi ${name}, here’s an update on your ShiftMyHome booking.`
  let subject = `[ShiftMyHome] ${title} (${quoteRef})`
  let primary = { label: 'View My Booking', url: track }
  let secondary: Array<{ label: string; url: string }> = []
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Booking reference', value: quoteRef },
  ]

  if (eventKey === 'driver_assigned' || eventKey === 'driver_reassigned') {
    title = eventKey === 'driver_reassigned' ? 'Your driver has been updated' : 'Your driver has been assigned'
    intro =
      eventKey === 'driver_reassigned'
        ? `Hi ${name}, we’ve assigned a new driver to your booking.`
        : `Hi ${name}, a driver has been assigned to your paid booking.`
    subject = `[ShiftMyHome] Driver assigned — ${quoteRef}`
    primary = { label: 'View My Booking', url: track }
    rows.push(
      { label: 'Move date', value: formatDateUK(quote.move_date) },
      { label: 'Arrival window', value: String(quote.arrival_window || '').trim() },
      { label: 'Pickup', value: String(quote.pickup_address || '').trim() },
      { label: 'Delivery', value: String(quote.delivery_address || '').trim() },
      { label: 'Driver', value: driverName },
      { label: 'Driver phone', value: driverPhone },
      { label: 'Vehicle', value: vehicleBits },
    )
  } else if (eventKey === 'status_on_way') {
    title = 'Your driver is on the way'
    intro = `Hi ${name}, ${driverName} is on the way to your pickup.`
    subject = `[ShiftMyHome] Driver on the way — ${quoteRef}`
    primary = { label: 'Track My Driver', url: track }
    rows.push(
      { label: 'Driver', value: driverName },
      { label: 'Driver phone', value: driverPhone },
      { label: 'Status', value: customerStatusLabel('on_way') },
    )
  } else if (eventKey.startsWith('status_') && eventKey !== 'status_completed') {
    const label = JOB_NOTIFY_EVENT_LABELS[eventKey]
    title = label
    intro = `Hi ${name}, your booking status is now: ${customerStatusLabel(eventKey.replace('status_', ''))}.`
    subject = `[ShiftMyHome] ${label} — ${quoteRef}`
    primary = { label: 'Track My Driver', url: track }
    rows.push(
      { label: 'Driver', value: driverName },
      { label: 'Driver phone', value: driverPhone },
      { label: 'Status', value: customerStatusLabel(eventKey.replace('status_', '')) },
    )
  } else if (eventKey === 'status_completed') {
    title = 'Your move is complete'
    intro = `Hi ${name}, your ShiftMyHome job has been completed successfully. Thank you for choosing us.`
    subject = `[ShiftMyHome] Job completed — ${quoteRef}`
    primary = { label: 'View Job Evidence', url: evidenceUrl(token) }
    secondary = [
      { label: 'Leave Feedback', url: feedbackUrl(token) },
      { label: 'Leave a Tip', url: tipUrl(token) },
    ]
    const total =
      quote.estimated_total != null && Number.isFinite(Number(quote.estimated_total))
        ? `£${Number(quote.estimated_total).toFixed(2)}`
        : quote.amount_paid != null
          ? `£${Number(quote.amount_paid).toFixed(2)}`
          : ''
    rows.push(
      { label: 'Customer', value: name },
      { label: 'Driver', value: driverName },
      { label: 'Pickup', value: String(quote.pickup_address || '').trim() },
      { label: 'Delivery', value: String(quote.delivery_address || '').trim() },
      { label: 'Completed', value: formatDateTimeUK(quote.completed_at || new Date().toISOString()) },
      { label: 'Final price', value: total },
    )
  } else if (eventKey === 'tip_received') {
    title = 'Tip payment received'
    intro = `Hi ${name}, thank you — your tip has been received.`
    subject = `[ShiftMyHome] Tip received — ${quoteRef}`
    primary = { label: 'View My Booking', url: track }
  }

  const html = buildJobCustomerEmailHtml({
    title,
    intro,
    rows,
    primaryCta: primary,
    secondaryCtas: secondary,
    footerNote: 'This link is private to your booking. Do not share it publicly.',
  })

  const text = [title, '', intro, ...rows.map((r) => `${r.label}: ${r.value}`), '', primary.url].join('\n')

  const result = await sendResendEmail({
    to: email,
    subject,
    html,
    text,
    logTag: `job-customer-notify:${eventKey}`,
  })
  if (!result.ok) {
    await markNotificationResult(supabase, quoteId, eventKey, {
      delivery_status: 'failed',
      payload: { error: result.error },
    })
    return { ok: false, error: result.error || 'resend_failed' }
  }

  await markNotificationResult(supabase, quoteId, eventKey, {
    delivery_status: 'sent',
    recipient_email: email,
    provider_message_id: result.resendId || null,
    sent_at: new Date().toISOString(),
    payload: { tracking_token: token, event_key: eventKey },
  })

  return { ok: true, resendId: result.resendId, token }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  if (!authorized(req)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)

  const supabase = createClient(supabaseUrl, serviceKey)
  const body = await req.json().catch(() => ({}))

  // Drain queue from status-history trigger
  if (body?.process_queue === true) {
    const { data: rows } = await supabase
      .from('job_customer_notify_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(40)

    const results = []
    for (const row of rows || []) {
      const eventKey = String(row.event_key || '') as JobNotifyEventKey
      const quoteId = String(row.quote_id || '')
      const sent = await sendEventEmail(supabase, quoteId, eventKey, false)
      await supabase
        .from('job_customer_notify_queue')
        .update({
          processed_at: new Date().toISOString(),
          error: sent.ok || sent.skipped ? null : sent.error || 'failed',
        })
        .eq('id', row.id)
      results.push({ id: row.id, quote_id: quoteId, event_key: eventKey, ...sent })
    }
    return jsonResponse({ ok: true, processed: results.length, results })
  }

  const quoteId = typeof body?.quote_id === 'string' ? body.quote_id.trim() : ''
  const eventKey = typeof body?.event_key === 'string' ? body.event_key.trim() : ''
  if (!quoteId || !eventKey) {
    return jsonResponse({ ok: false, error: 'quote_id_and_event_key_required' }, 400)
  }

  const result = await sendEventEmail(
    supabase,
    quoteId,
    eventKey as JobNotifyEventKey,
    Boolean(body.force),
  )
  return jsonResponse(result, result.ok || result.skipped ? 200 : 500)
})
