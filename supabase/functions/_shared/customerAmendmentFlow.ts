import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'
import { STRIPE_LOCALE } from './stripeMode.ts'
import { siteBaseUrl } from './jobCustomerNotify.ts'
import { sendResendEmail } from './resendClient.ts'
import {
  blocksNewAmendment,
  customerOwnsBooking,
  decideCustomerAmendment,
  londonTodayIso,
  normalizeEmail,
  round2,
} from '../../../src/lib/customerPortalModel.js'
import { previousChargeableTotal, pricePortalBooking } from '../../../src/lib/customerPortalPricing.js'
import {
  applyCustomerEdits,
  arrivalColumnsFromWizard,
  bookingChangeRows,
  hydratePortalWizard,
  inventoryJsonFromLines,
  inventoryTextFromLines,
  patchWizardSnapshot,
  volumeIncreased,
} from '../../../src/lib/customerPortalQuote.js'
import { inventorySignature } from '../../../src/lib/customerPortalModel.js'
import { dateSlotOpen } from '../../../src/lib/customerPortalModel.js'
import { fetchDrivingRoute, geocodeAddress, metersToMiles } from '../../../src/lib/mapboxRouteApi.js'

const PAID = new Set(['paid', 'deposit_paid'])

export async function loadCustomerQuote(supabase: SupabaseClient, quoteId: string) {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (error || !data) return null
  if (!PAID.has(String(data.payment_status || '').toLowerCase())) return null
  return data as Record<string, unknown>
}

async function loadSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('public_get_pricing_settings')
  if (error) throw new Error(error.message || 'Could not load prices.')
  const row = Array.isArray(data) ? data[0] : null
  const settings = row?.data
  if (!settings || typeof settings !== 'object') throw new Error('Pricing is not available.')
  return settings as Record<string, unknown>
}

function serviceTypeOf(quote: Record<string, unknown>) {
  return String(quote.service_type || quote.service || 'House Removals')
}

function routeQuery(wizard: Record<string, unknown>, side: string) {
  const house = String(wizard[`${side}HouseNumber`] || '').trim()
  const street = String(wizard[`${side}Street`] || '').trim()
  const town = String(wizard[`${side}Town`] || '').trim()
  const postcode = String(wizard[`${side}Postcode`] || '').trim()
  const structured = [house, street, town, postcode].filter(Boolean).join(', ')
  return structured.length >= 8 ? structured : String(wizard[`${side}Address`] || '')
}

function mapboxToken() {
  const fromAccess = Deno.env.get('MAPBOX_ACCESS_TOKEN') || ''
  const fromVite = Deno.env.get('VITE_MAPBOX_TOKEN') || ''
  return (fromAccess || fromVite).trim()
}

async function applyServerRoute(
  base: Record<string, unknown>,
  wizard: Record<string, unknown>,
  addressChanged: boolean,
) {
  wizard.distanceMiles = base.distanceMiles
  wizard.mapboxRouteDurationSeconds = base.mapboxRouteDurationSeconds ?? null
  wizard.pickupLng = base.pickupLng ?? null
  wizard.pickupLat = base.pickupLat ?? null
  wizard.deliveryLng = base.deliveryLng ?? null
  wizard.deliveryLat = base.deliveryLat ?? null
  if (!addressChanged) return { ok: true as const, wizard, distanceChanged: false }
  const sameRoute = routeQuery(base, 'pickup') === routeQuery(wizard, 'pickup')
    && routeQuery(base, 'delivery') === routeQuery(wizard, 'delivery')
  if (sameRoute) return { ok: true as const, wizard, distanceChanged: false }

  const token = mapboxToken()
  if (!token) {
    return { ok: false as const, error: 'The new route could not be checked. Try again shortly.' }
  }
    const pickup = await geocodeAddress(routeQuery(wizard, 'pickup'), token)
    const delivery = await geocodeAddress(routeQuery(wizard, 'delivery'), token)
  if (!pickup || !delivery) {
    return { ok: false as const, error: 'Check the collection and delivery addresses. We could not place them on the route.' }
  }
  const route = await fetchDrivingRoute(pickup, delivery, token)
  if (!route || !(route.distanceMeters > 0)) {
    return { ok: false as const, error: 'We could not calculate the driving route for these addresses.' }
  }
  wizard.pickupLng = pickup.lng
  wizard.pickupLat = pickup.lat
  wizard.deliveryLng = delivery.lng
  wizard.deliveryLat = delivery.lat
  wizard.distanceMiles = metersToMiles(route.distanceMeters)
  wizard.mapboxRouteDurationSeconds = route.durationSeconds
  const before = Number(base.distanceMiles) || 0
  const after = Number(wizard.distanceMiles) || 0
  return { ok: true as const, wizard, distanceChanged: Math.abs(before - after) > 0.15 }
}

export async function evaluateCustomerEdit(
  supabase: SupabaseClient,
  quote: Record<string, unknown>,
  edits: Record<string, unknown>,
) {
  const settings = await loadSettings(supabase)
  const base = hydratePortalWizard(quote)
  const edited = applyCustomerEdits(base, edits)
  if (!edited.ok) return { ok: false as const, error: edited.error || 'Check the booking details.' }
  const routed = await applyServerRoute(base, edited.wizard, Boolean(edited.addressChanged))
  if (!routed.ok) return { ok: false as const, error: routed.error }

  const serviceType = serviceTypeOf(quote)
  const beforePrice = pricePortalBooking({ settings, serviceType, wizard: base })
  const priced = pricePortalBooking({ settings, serviceType, wizard: routed.wizard })
  const previous = previousChargeableTotal(quote)
  if (previous == null) return { ok: false as const, error: 'This booking has no price to adjust.' }

  const currentDate = String(quote.move_date || base.moveDate || '').slice(0, 10)
  const nextDate = String(routed.wizard.moveDate || '').slice(0, 10)
  const dateChanged = nextDate !== currentDate
  let booked = 0
  if (dateChanged) {
    const { data } = await supabase.rpc('public_quote_day_slot_counts', { p_from: nextDate, p_to: nextDate })
    booked = Array.isArray(data) ? Number(data[0]?.booked || 0) : 0
  }
  let driverBusy = false
  if (quote.assigned_driver_id && dateChanged) {
    const { data } = await supabase.rpc('customer_portal_driver_busy', {
      p_driver: quote.assigned_driver_id,
      p_date: nextDate,
      p_exclude: quote.id,
    })
    driverBusy = Boolean(data)
  }

  const beforeArrival = arrivalColumnsFromWizard(base).arrivalWindow
  const afterArrival = arrivalColumnsFromWizard(routed.wizard)
  const arrivalChanged = beforeArrival !== afterArrival.arrivalWindow
  const inventoryChanged = inventorySignature(base.inventoryLines) !== inventorySignature(routed.wizard.inventoryLines)
  const routeTextSame = routeQuery(base, 'pickup') === routeQuery(routed.wizard, 'pickup')
    && routeQuery(base, 'delivery') === routeQuery(routed.wizard, 'delivery')
  const textOnlyAddress = Boolean(edited.addressChanged) && routeTextSame && !dateChanged && !arrivalChanged && !inventoryChanged
  const nextTotal = textOnlyAddress ? previous : priced.total
  const decision = decideCustomerAmendment({
    quote,
    previousTotal: previous,
    nextTotal,
    dateChanged,
    arrivalChanged,
    inventoryChanged,
    addressChanged: Boolean(edited.addressChanged),
    distanceChanged: textOnlyAddress ? false : routed.distanceChanged,
    volumeIncreased: textOnlyAddress ? false : volumeIncreased(base.inventoryLines, routed.wizard.inventoryLines),
    crewIncreased: textOnlyAddress
      ? false
      : Number(priced.crewSize) > (Number(quote.crew_size) || Number(beforePrice.crewSize) || 0),
    driverAssigned: Boolean(quote.assigned_driver_id),
    driverBusy,
    dateAvailable: !dateChanged || dateSlotOpen(settings, nextDate, booked, currentDate),
    dateInPast: nextDate < londonTodayIso(),
  })

  const changes = bookingChangeRows(
    {
      dateLabel: currentDate,
      arrivalLabel: beforeArrival,
      lines: base.inventoryLines,
      total: previous,
      pickupLabel: String(base.pickupAddress || ''),
      deliveryLabel: String(base.deliveryAddress || ''),
      miles: Number(base.distanceMiles) || 0,
    },
    {
      dateLabel: nextDate,
      arrivalLabel: afterArrival.arrivalWindow,
      lines: routed.wizard.inventoryLines,
      total: nextTotal,
      pickupLabel: String(routed.wizard.pickupAddress || ''),
      deliveryLabel: String(routed.wizard.deliveryAddress || ''),
      miles: textOnlyAddress ? Number(base.distanceMiles) || 0 : Number(routed.wizard.distanceMiles) || 0,
    },
  )

  const proposed: Record<string, unknown> = {
    moveDate: nextDate,
    arrivalWindow: afterArrival.arrivalWindow,
    arrivalType: afterArrival.arrivalType,
    arrivalTime: afterArrival.arrivalTime,
    inventory: inventoryJsonFromLines(routed.wizard.inventoryLines),
    inventoryText: inventoryTextFromLines(routed.wizard.inventoryLines),
    crewSize: textOnlyAddress ? quote.crew_size ?? null : priced.crewSize,
    total: nextTotal,
    details: patchWizardSnapshot(String(quote.details || ''), routed.wizard),
    dateChanged,
    priceUnchanged: textOnlyAddress,
  }
  if (edited.addressChanged) {
    proposed.addressChanged = true
    proposed.pickupAddress = routed.wizard.pickupAddress
    proposed.deliveryAddress = routed.wizard.deliveryAddress
    proposed.distanceMiles = Number(routed.wizard.distanceMiles) || 0
  }

  return { ok: true as const, decision, changes, proposed }
}

export function callerOwnsQuote(userEmail: string | null | undefined, quote: Record<string, unknown>) {
  return customerOwnsBooking(userEmail, quote.email)
}

async function openAmendment(supabase: SupabaseClient, quoteId: string) {
  const { data } = await supabase
    .from('customer_booking_amendments')
    .select('*')
    .eq('quote_id', quoteId)
    .in('status', ['pending_payment', 'pending_approval', 'paid_needs_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function commitCustomerEdit(opts: {
  supabase: SupabaseClient
  stripeKey: string
  quote: Record<string, unknown>
  edits: Record<string, unknown>
  expectedTotal: number | null
  userId: string | null
  actedAs?: 'customer' | 'admin'
  returnCustomerId?: string
}) {
  const evaluated = await evaluateCustomerEdit(opts.supabase, opts.quote, opts.edits)
  if (!evaluated.ok) return evaluated
  const { decision, changes, proposed } = evaluated

  if (
    opts.expectedTotal == null ||
    Math.abs(round2(opts.expectedTotal) - decision.nextTotal) > 0.02
  ) {
    return { ok: true as const, preview: true, decision, changes }
  }

  if (decision.outcome === 'unchanged' || decision.outcome === 'blocked' || decision.outcome === 'unavailable') {
    return { ok: true as const, preview: false, decision, changes }
  }

  const existing = await openAmendment(opts.supabase, String(opts.quote.id))
  if (existing && blocksNewAmendment(String(existing.status))) {
    return {
      ok: true as const,
      preview: false,
      decision: { ...decision, outcome: existing.status, reason: 'already_open' },
      changes: existing.changes || changes,
      amendmentId: existing.id,
    }
  }
  if (existing && existing.status === 'pending_payment') {
    await opts.supabase
      .from('customer_booking_amendments')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('status', 'pending_payment')
      .is('paid_at', null)
  }

  const now = new Date().toISOString()
  const status = decision.outcome === 'pending_payment'
    ? 'pending_payment'
    : decision.outcome === 'pending_approval'
      ? 'pending_approval'
      : 'pending_approval'
  const paymentDelta = decision.outcome === 'pending_payment'
    ? decision.chargeGbp
    : decision.delta > 0
      ? decision.delta
      : 0

  if (decision.outcome === 'apply') {
    const inserted = await insertAmendment(opts, {
      status: 'pending_approval',
      paymentDelta: 0,
      decision,
      changes,
      proposed,
      now,
    })
    if (!inserted.ok) return inserted
    const { applyAdminCustomerAmendment } = await import('./applyCustomerAmendment.ts')
    const applied = await applyAdminCustomerAmendment(opts.supabase, inserted.id)
    return { ok: applied.ok, preview: false, decision, changes, amendmentId: inserted.id, status: applied.status, error: applied.error }
  }

  const inserted = await insertAmendment(opts, { status, paymentDelta, decision, changes, proposed, now })
  if (!inserted.ok) return inserted

  if (status === 'pending_approval') {
    await notifyAdminsOfApproval(opts.supabase, opts.quote, inserted.id, changes)
    return { ok: true as const, preview: false, decision, changes, amendmentId: inserted.id, status }
  }

  const checkout = await createDifferenceCheckout(opts.stripeKey, opts.quote, inserted.id, paymentDelta, opts.returnCustomerId || '')
  if (!checkout.ok) {
    await opts.supabase
      .from('customer_booking_amendments')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', inserted.id)
      .is('paid_at', null)
    return { ok: false as const, error: checkout.error }
  }
  await opts.supabase
    .from('customer_booking_amendments')
    .update({ stripe_checkout_session_id: checkout.sessionId, updated_at: new Date().toISOString() })
    .eq('id', inserted.id)

  return {
    ok: true as const,
    preview: false,
    decision,
    changes,
    amendmentId: inserted.id,
    status,
    checkoutUrl: checkout.url,
  }
}

async function insertAmendment(
  opts: {
    supabase: SupabaseClient
    quote: Record<string, unknown>
    userId: string | null
    actedAs?: 'customer' | 'admin'
  },
  row: {
    status: string
    paymentDelta: number
    decision: { previousTotal: number; nextTotal: number; existingBalance: number; approvalReasons: string[] }
    changes: unknown
    proposed: unknown
    now: string
  },
) {
  const actedAs = opts.actedAs === 'admin' ? 'admin' : 'customer'
  const proposed = row.proposed && typeof row.proposed === 'object' && !Array.isArray(row.proposed)
    ? { ...(row.proposed as Record<string, unknown>), recorded_by: { role: actedAs, user_id: opts.userId } }
    : row.proposed
  const { data, error } = await opts.supabase
    .from('customer_booking_amendments')
    .insert({
      quote_id: opts.quote.id,
      status: row.status,
      previous_total: row.decision.previousTotal,
      next_total: row.decision.nextTotal,
      payment_delta: row.paymentDelta,
      existing_balance: row.decision.existingBalance,
      changes: row.changes,
      proposed,
      approval_reasons: row.decision.approvalReasons,
      acted_by: opts.userId,
      acted_as: actedAs,
      created_at: row.now,
      updated_at: row.now,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Could not save the change.' }
  return { ok: true as const, id: String(data.id) }
}

async function createDifferenceCheckout(
  stripeKey: string,
  quote: Record<string, unknown>,
  amendmentId: string,
  amountGbp: number,
  returnCustomerId = '',
) {
  const amountPence = Math.round(round2(amountGbp) * 100)
  if (amountPence < 30) return { ok: false as const, error: 'The extra amount is too small to charge online.' }
  const site = siteBaseUrl()
  const quoteId = String(quote.id)
  const ref = String(quote.quote_ref || 'booking')
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const metadata = {
    payment_type: 'customer_booking_amendment',
    customer_booking_amendment_id: amendmentId,
    quote_id: quoteId,
    quote_ref: ref.slice(0, 200),
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: STRIPE_LOCALE,
    customer_email: normalizeEmail(quote.email) || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: amountPence,
          product_data: {
            name: `Booking change — ${ref}`,
            description: 'Difference for the updated date or items. Amounts already paid are not charged again.',
          },
        },
      },
    ],
    success_url: `${site}/portal/bookings/${quoteId}?payment=success&amendment=${amendmentId}&session_id={CHECKOUT_SESSION_ID}${returnCustomerId ? `&customer=${encodeURIComponent(returnCustomerId)}` : ''}`,
    cancel_url: `${site}/portal/bookings/${quoteId}?payment=cancelled&amendment=${amendmentId}${returnCustomerId ? `&customer=${encodeURIComponent(returnCustomerId)}` : ''}`,
    metadata,
    payment_intent_data: { metadata },
  })
  if (!session.url) return { ok: false as const, error: 'Payment could not be started.' }
  return { ok: true as const, url: session.url, sessionId: session.id }
}

async function notifyAdminsOfApproval(
  supabase: SupabaseClient,
  quote: Record<string, unknown>,
  amendmentId: string,
  changes: Array<{ label: string; previous: string; next: string }>,
) {
  const { data: admins } = await supabase.rpc('list_admin_notification_emails')
  const list = Array.isArray(admins) ? admins.filter(Boolean) : []
  if (!list.length) return
  const ref = String(quote.quote_ref || quote.id)
  const lines = changes.map((row) => `${row.label}: ${row.previous} → ${row.next}`).join('\n')
  await sendResendEmail({
    to: list,
    subject: `[ShiftMyHome] Customer change needs approval — ${ref}`,
    html: `<p>A customer asked to change ${ref}. It is pending approval and is not confirmed.</p><pre>${lines}</pre><p>Amendment ${amendmentId}</p>`,
    text: `Customer change needs approval for ${ref}.\n${lines}`,
    logTag: 'customer-amendment-approval',
  })
}

export async function startPaymentForAmendment(opts: {
  supabase: SupabaseClient
  stripeKey: string
  quote: Record<string, unknown>
  amendmentId: string
  returnCustomerId?: string
}) {
  const { data: row } = await opts.supabase
    .from('customer_booking_amendments')
    .select('*')
    .eq('id', opts.amendmentId)
    .eq('quote_id', opts.quote.id)
    .maybeSingle()
  if (!row || row.status !== 'pending_payment' || row.paid_at) {
    return { ok: false as const, error: 'This change is not waiting for payment.' }
  }
  const checkout = await createDifferenceCheckout(
    opts.stripeKey,
    opts.quote,
    String(row.id),
    Number(row.payment_delta) || 0,
    opts.returnCustomerId || '',
  )
  if (!checkout.ok) return checkout
  await opts.supabase
    .from('customer_booking_amendments')
    .update({ stripe_checkout_session_id: checkout.sessionId, updated_at: new Date().toISOString() })
    .eq('id', row.id)
  return { ok: true as const, checkoutUrl: checkout.url }
}
