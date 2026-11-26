import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { formatDateUK } from '../_shared/formatDateUK.ts'
import {
  bookingInventoryLines,
  buildBookingMoveSectionsHtml,
  buildJobCompletedThankYouEmailHtml,
  buildJobCustomerEmailHtml,
  customerAccountUrl,
  customerFirstName,
  customerInstructionText,
  customerStatusLabel,
  JOB_NOTIFY_EVENT_LABELS,
  resolveGoogleReviewUrl,
  siteBaseUrl,
  tipUrl,
  trackingUrl,
  type JobNotifyEventKey,
} from '../_shared/jobCustomerNotify.ts'
import { buildPortalMagicUrl } from '../_shared/customerPortalMagicLink.ts'
import { phoneQuoteFinalTotal } from '../_shared/phoneQuotePaymentRules.ts'
import {
  isUniqueViolation,
  notificationClaimDecision,
  queueProcessingIsTerminal,
} from '../_shared/deliveryRetryPolicy.js'
import { saveCustomerEmailArchive } from '../_shared/customerEmailArchive.ts'
import { CASH_INVOICE_EVENT } from '../_shared/cashPaidInvoicePolicy.js'
import { cardPaidInvoiceAttachment, sendCashPaidInvoice } from '../_shared/cashPaidInvoice.ts'

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

function isReleasedPhoneBooking(quote: Record<string, unknown>) {
  const source = String(quote.source || '').toLowerCase()
  const operational = String(quote.operational_status || '').toLowerCase()
  return (
    (source === 'phone_booking' || source === 'admin_phone_booking') &&
    operational !== 'phone_booking_pending' &&
    operational !== 'cancelled'
  )
}

function arrivalFromWizard(step1: Record<string, unknown>) {
  const windowKey = String(step1.arrivalWindow || '').trim()
  const from = String(step1.flexibleArrivalFrom || '').trim()
  const until = String(step1.flexibleArrivalUntil || '').trim()
  if (windowKey === 'flex_window' && from && until) {
    return `Flexible window · ${from}–${until}`
  }
  const exact = String(step1.exactArrivalTime || '').trim()
  if (windowKey === 'exact' && exact) return `${exact} (Exact time)`
  const labels: Record<string, string> = {
    morning: 'Morning · 08:00–12:00',
    afternoon: 'Evening · 16:00–20:00',
    evening: 'Evening · 16:00–20:00',
  }
  return labels[windowKey] || ''
}

function customerNoteFromDetails(details: unknown, priceNote: string) {
  const line = String(details || '')
    .split(/\r?\n/)
    .find((row) => row.trim().toLowerCase().startsWith('customer notes:'))
  if (!line) return ''
  return customerInstructionText(line.replace(/^customer notes:\s*/i, ''), priceNote)
}

/**
 * Items, the customer's instructions, and the price note for the confirmation email.
 * The job row is used first. A converted lead fills anything the job does not have yet.
 */
async function bookingConfirmationContent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quote: Record<string, unknown>,
) {
  let inventory = bookingInventoryLines(quote.inventory)
  let priceReason = String(quote.price_override_reason || '').trim()
  let arrival = String(quote.arrival_window || '').trim()
  let customerNote = ''

  const quoteId = String(quote.id || '').trim()
  const quoteRef = String(quote.quote_ref || '').trim()
  let lead: Record<string, unknown> | null = null
  if (quoteId) {
    const { data } = await supabase
      .from('customer_leads')
      .select('wizard_data, price_override_reason')
      .eq('quote_id', quoteId)
      .maybeSingle()
    lead = data
  }
  if (!lead && quoteRef) {
    const { data } = await supabase
      .from('customer_leads')
      .select('wizard_data, price_override_reason')
      .eq('quote_ref', quoteRef)
      .maybeSingle()
    lead = data
  }

  const wizard = lead?.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const step1 =
    wizard && typeof wizard === 'object' && (wizard as Record<string, unknown>).step1
      ? ((wizard as Record<string, unknown>).step1 as Record<string, unknown>)
      : {}
  const step2 =
    wizard && typeof wizard === 'object' && (wizard as Record<string, unknown>).step2
      ? ((wizard as Record<string, unknown>).step2 as Record<string, unknown>)
      : {}
  const step3 =
    wizard && typeof wizard === 'object' && (wizard as Record<string, unknown>).step3
      ? ((wizard as Record<string, unknown>).step3 as Record<string, unknown>)
      : {}

  if (!inventory.length) inventory = bookingInventoryLines(step2.inventoryLines)
  if (!priceReason) priceReason = String(lead?.price_override_reason || '').trim()
  if (!arrival) arrival = arrivalFromWizard(step1)
  const fromWizard =
    typeof step3.customerSpecialInstructions === 'string'
      ? customerInstructionText(step3.customerSpecialInstructions, priceReason)
      : customerInstructionText(step3.specialInstructions, priceReason)
  customerNote = fromWizard || customerNoteFromDetails(quote.details, priceReason)

  return {
    arrival,
    inventory,
    customerNote,
    priceReason,
    sectionsHtml: buildBookingMoveSectionsHtml({ inventory, customerNote, priceReason }),
  }
}

/** The price the admin set for this booking. Never the higher calculator figure. */
function bookingPriceLabel(quote: Record<string, unknown>) {
  const total = phoneQuoteFinalTotal(quote)
  if (total == null) return ''
  return `£${total.toFixed(2)}`
}

function newPayToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** Card payment page for this booking. Creates the pay link the first time it is needed. */
async function cardPayUrl(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quote: Record<string, unknown>,
) {
  let token = String(quote.quote_pay_token || '').trim()
  if (!token) {
    token = newPayToken()
    const { data, error } = await supabase
      .from('quotes')
      .update({ quote_pay_token: token })
      .eq('id', quote.id)
      .is('quote_pay_token', null)
      .select('quote_pay_token')
      .maybeSingle()
    token = String(data?.quote_pay_token || '').trim()
    if (error || !token) {
      const { data: existing } = await supabase.from('quotes').select('quote_pay_token').eq('id', quote.id).maybeSingle()
      token = String(existing?.quote_pay_token || '').trim()
    }
    if (token) quote.quote_pay_token = token
  }
  if (!token) return ''
  return `${siteBaseUrl()}/quote/view/${encodeURIComponent(token)}?pay=full`
}

function customerEmailAddress(quote: Record<string, unknown>) {
  const email = String(quote.email || '').trim()
  if (!email || email.toLowerCase() === 'phone-booking@shiftmyhome.local') return ''
  return email
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

async function insertNotificationClaim(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: string,
) {
  return supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: JOB_NOTIFY_EVENT_LABELS[eventKey as JobNotifyEventKey] || eventKey,
    delivery_status: 'pending',
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
  const { error } = await insertNotificationClaim(supabase, quoteId, eventKey)
  if (!error) return { claimed: true as const }
  if (!isUniqueViolation(error)) return { claimed: false as const, reason: error.message }

  const { data: existing } = await supabase
    .from('job_customer_notifications')
    .select('delivery_status, created_at')
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

  const retry = await insertNotificationClaim(supabase, quoteId, eventKey)
  if (!retry.error) return { claimed: true as const }
  if (isUniqueViolation(retry.error)) return { claimed: false as const, reason: 'already_sent' }
  return { claimed: false as const, reason: retry.error.message }
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
  if (String(eventKey) === 'card_paid_invoice') {
    return await sendCashPaidInvoice(supabase, quoteId, { onCardSettled: true })
  }
  if (String(eventKey) === CASH_INVOICE_EVENT) {
    return await sendCashPaidInvoice(supabase, quoteId, { onCompleted: true })
  }

  const bundle = await loadQuoteBundle(supabase, quoteId)
  if (!bundle) return { ok: false, error: 'quote_not_found' }

  const { quote, driver, token } = bundle
  if (eventKey === 'status_completed') {
    try {
      const invoice = await sendCashPaidInvoice(supabase, quoteId, { onCompleted: true })
      console.log('[job-customer-notify] completion invoice', { quoteId, ok: invoice.ok, error: invoice.error || null })
    } catch (invoiceError) {
      console.error('[job-customer-notify] completion invoice failed', invoiceError)
    }
  }
  // Website quotes still need card payment before status emails.
  // A phone booking released to Available Jobs can be tracked and emailed while unpaid.
  // Completion thank-you also covers unpaid phone bookings (pay driver / office).
  if (
    !isPaid(quote.payment_status) &&
    eventKey !== 'status_completed' &&
    eventKey !== 'tip_received' &&
    !isReleasedPhoneBooking(quote)
  ) {
    return { ok: false, error: 'not_paid' }
  }

  const email = customerEmailAddress(quote)
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
    return {
      ok: false,
      error: claim.reason || 'not_claimed',
      skipped: claim.reason === 'already_sent',
    }
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
  let footerNote = 'This link is private to your booking. Do not share it publicly.'
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Booking reference', value: quoteRef },
  ]
  const unpaid = !isPaid(quote.payment_status)
  let moveSectionsHtml = ''
  let plainMoveLines: string[] = []
  let accountSignInUrl = ''

  if (eventKey === 'booking_confirmed') {
    title = 'Your booking is confirmed'
    const priceLabel = bookingPriceLabel(quote)
    const extras = await bookingConfirmationContent(supabase, quote)
    const payUrl = unpaid && priceLabel ? await cardPayUrl(supabase, quote) : ''
    intro = unpaid
      ? `Hi ${name}, your booking is confirmed. Payment has not been taken yet. You can pay by card at any time, or pay your driver when they arrive. You can also follow the job from the link below.`
      : `Hi ${name}, your booking is confirmed. You can follow the job from the link below.`
    subject = `[ShiftMyHome] Booking confirmed — ${quoteRef}`
    primary = payUrl
      ? { label: 'Pay by card', url: payUrl }
      : { label: 'Track my booking', url: track }
    secondary = payUrl ? [{ label: 'Track my booking', url: track }] : []
    footerNote = unpaid
      ? 'Pay by card whenever you like, or pay your driver when they arrive. These links are private to your booking.'
      : 'This tracking link is private to your booking.'
    if (email) {
      const magic = await buildPortalMagicUrl(supabase, email, `/portal/bookings/${quoteId}`)
      accountSignInUrl = magic.ok ? magic.url : customerAccountUrl(email)
    }
    moveSectionsHtml = extras.sectionsHtml
    const itemTotal = extras.inventory.reduce((sum, line) => sum + line.quantity, 0)
    plainMoveLines = [
      itemTotal ? `Items: ${itemTotal === 1 ? '1 item' : `${itemTotal} items`}` : '',
      ...extras.inventory.map((line) => `- ${line.name} ×${line.quantity}`),
      extras.customerNote ? `Special instructions: ${extras.customerNote}` : '',
      extras.priceReason ? `Included in price: ${extras.priceReason}` : '',
    ].filter(Boolean)
    rows.push(
      { label: 'Move date', value: formatDateUK(quote.move_date) },
      { label: 'Arrival window', value: extras.arrival },
      { label: 'Pickup', value: String(quote.pickup_address || '').trim() },
      { label: 'Delivery', value: String(quote.delivery_address || '').trim() },
      { label: 'Price', value: priceLabel },
      {
        label: 'Payment',
        value: unpaid
          ? 'Not paid yet — pay by card anytime, or pay the driver on arrival'
          : String(quote.payment_status || '').toLowerCase() === 'deposit_paid'
            ? 'Deposit paid'
            : 'Paid',
      },
    )
  } else if (eventKey === 'driver_assigned' || eventKey === 'driver_reassigned') {
    title = eventKey === 'driver_reassigned' ? 'Your driver has been updated' : 'Your driver has been assigned'
    intro =
      eventKey === 'driver_reassigned'
        ? `Hi ${name}, we’ve assigned a new driver to your booking.`
        : unpaid
          ? `Hi ${name}, a driver has been assigned to your booking. Please pay the driver when they arrive.`
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
    title = 'Left for collection'
    intro = `Hi ${name}, ${driverName} has left for collection.`
    subject = `[ShiftMyHome] Left for collection — ${quoteRef}`
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
    const first = customerFirstName(quote.full_name)
    const googleReviewUrl = await resolveGoogleReviewUrl(supabase)
    title = 'Thank you for choosing ShiftMyHome'
    intro = `Hi ${first}, thank you for choosing ShiftMyHome for your move.`
    subject = 'Thank you for choosing ShiftMyHome 🚚'
    primary = { label: '⭐ Leave us a Google Review', url: googleReviewUrl }
    secondary = [{ label: '💷 Leave a Tip', url: tipUrl(token) }]
    // Dedicated HTML below — rows unused for this event
    rows.length = 0
  } else if (eventKey === 'tip_received') {
    title = 'Tip payment received'
    intro = `Hi ${name}, thank you — your tip has been received.`
    subject = `[ShiftMyHome] Tip received — ${quoteRef}`
    primary = { label: 'View My Booking', url: track }
  }

  const html =
    eventKey === 'status_completed'
      ? buildJobCompletedThankYouEmailHtml({
          firstName: customerFirstName(quote.full_name),
          googleReviewUrl: primary.url,
          tipPageUrl: tipUrl(token),
        })
      : buildJobCustomerEmailHtml({
          title,
          intro,
          rows,
          primaryCta: primary,
          secondaryCtas: secondary,
          footerNote,
          moveSectionsHtml,
          companyFooter: eventKey === 'booking_confirmed',
          accountCta:
            eventKey === 'booking_confirmed' && accountSignInUrl
              ? { label: 'My account', url: accountSignInUrl }
              : undefined,
        })

  const text =
    eventKey === 'status_completed'
      ? [
          `Hi ${customerFirstName(quote.full_name)},`,
          '',
          'Thank you for choosing ShiftMyHome for your move. We hope everything went smoothly and that you were happy with the service provided by our team.',
          '',
          'Your feedback means a lot to us and helps other customers choose a reliable moving company.',
          '',
          `Leave us a Google Review: ${primary.url}`,
          '',
          'Would you like to thank your moving team?',
          'If you feel the team did a great job, you can optionally leave them a tip. This is completely optional and there is absolutely no obligation.',
          '',
          `Leave a Tip: ${tipUrl(token)}`,
          '',
          'Thank you again for trusting ShiftMyHome with your move.',
          'The ShiftMyHome Team',
          'Moving made simple.',
        ].join('\n')
      : [
          title,
          '',
          intro,
          ...rows.filter((r) => r.value && r.value.trim()).map((r) => `${r.label}: ${r.value}`),
          ...(plainMoveLines.length ? ['', ...plainMoveLines] : []),
          '',
          primary.url,
          ...(eventKey === 'booking_confirmed'
            ? [
                '',
                `My account: ${accountSignInUrl}`,
                '',
                '0141 461 4813',
                'www.shiftmyhome.co.uk',
                `© ${new Date().getFullYear()} ShiftMyHome. All rights reserved.`,
              ]
            : []),
        ].join('\n')

  const invoice =
    eventKey === 'booking_confirmed' ? await cardPaidInvoiceAttachment(supabase, quoteId) : null
  const result = await sendResendEmail({
    to: email,
    subject,
    html,
    text,
    attachments: invoice ? [invoice] : [],
    logTag: `job-customer-notify:${eventKey}`,
  })
  if (!result.ok) {
    await markNotificationResult(supabase, quoteId, eventKey, {
      delivery_status: 'failed',
      payload: { error: result.error },
    })
    return { ok: false, error: result.error || 'resend_failed' }
  }

  const sentAt = new Date().toISOString()
  await markNotificationResult(supabase, quoteId, eventKey, {
    delivery_status: 'sent',
    provider_status: 'sent',
    recipient_email: email,
    provider_message_id: result.resendId || null,
    sent_at: sentAt,
    payload: { tracking_token: token, event_key: eventKey },
  })

  try {
    const { data: note } = await supabase
      .from('job_customer_notifications')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('event_key', eventKey)
      .maybeSingle()
    await saveCustomerEmailArchive(supabase, {
      quoteId,
      notificationId: note?.id || null,
      eventKey,
      subject,
      recipientEmail: email,
      html,
      text,
      providerMessageId: result.resendId || null,
      providerStatus: 'sent',
      sentAt,
    })
  } catch (archiveError) {
    console.error('[job-customer-notify] archive save failed', archiveError)
  }

  if (eventKey === 'status_completed') {
    await supabase
      .from('quotes')
      .update({
        completion_email_sent: true,
        completion_email_sent_at: sentAt,
      })
      .eq('id', quoteId)
  }

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
      const finished = queueProcessingIsTerminal(sent)
      await supabase
        .from('job_customer_notify_queue')
        .update({
          processed_at: finished ? new Date().toISOString() : null,
          error: sent.ok ? null : sent.error || 'failed',
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
