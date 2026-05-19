import { upsertWebsiteLead } from './data/websiteLeadsRepository'
import { insertWebsiteEvent } from './data/websiteEventsRepository'
import { getVisitorTrackingContext } from './visitorContext'
import { getWebsiteLeadSessionId } from './websiteLeadSession'

/** @typedef {import('./data/websiteLeadsRepository').WebsiteLeadStatus} WebsiteLeadStatus */

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

/** @type {Record<string, unknown>|null} */
let visitorContextCache = null
/** @type {Promise<Record<string, unknown>>|null} */
let visitorContextPromise = null

/**
 * @param {string} [address]
 */
export function extractUkPostcode(address) {
  const m = String(address || '').match(UK_POSTCODE_RE)
  return m ? m[1].toUpperCase().replace(/\s+/g, ' ').trim() : ''
}

/**
 * @returns {Promise<Record<string, unknown>>}
 */
async function getCachedVisitorContext() {
  if (visitorContextCache) return visitorContextCache
  if (!visitorContextPromise) {
    visitorContextPromise = getVisitorTrackingContext().then((ctx) => {
      visitorContextCache = ctx
      return ctx
    })
  }
  return visitorContextPromise
}

/**
 * @param {string} path
 */
function cityRouteFromPath(path) {
  const p = String(path || '').replace(/^\//, '').split('/')[0]
  return p && p !== 'quote' && p !== 'payment-success' ? p : null
}

/**
 * @param {string} event
 * @param {number} [step]
 */
function canonicalFunnelEventName(event, step) {
  const e = String(event || '')
  if (e === 'step_completed' && step != null) {
    const n = Number(step)
    if (n >= 1 && n <= 4) return `quote_step_${n}`
  }
  if (e === 'payment_completed') return 'booking_completed'
  return e
}

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} patch
 * @param {Record<string, unknown>} data
 */
async function recordWebsiteEvent(eventName, patch, data = {}) {
  const ctx = await getCachedVisitorContext()
  const pagePath =
    typeof data.returnPath === 'string' && data.returnPath
      ? data.returnPath
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/'

  await insertWebsiteEvent({
    session_id: getWebsiteLeadSessionId(),
    event_name: eventName,
    page_path: pagePath,
    referrer: ctx.referrer ?? patch.referrer ?? null,
    quote_ref: patch.quote_ref ?? data.quoteRef ?? null,
    funnel_step: data.step != null ? Number(data.step) : patch.current_step ?? null,
    ip_address: ctx.ip_address ?? null,
    ip_hash: ctx.ip_hash ?? null,
    ip_masked: ctx.ip_masked ?? null,
    city: ctx.city ?? null,
    region: ctx.region ?? null,
    country: ctx.country ?? null,
    user_agent: ctx.user_agent ?? null,
    device_type: ctx.device_type ?? null,
    browser_name: ctx.browser_name ?? null,
    metadata: {
      service_type: patch.service_type ?? data.serviceType ?? null,
      payment_type: data.paymentType ?? null,
    },
  })
}

/**
 * @param {Record<string, unknown>} patch
 */
export async function trackWebsiteLeadPatch(patch) {
  if (typeof window === 'undefined') return null
  try {
    const ctx = await getCachedVisitorContext()
    const landingPath =
      typeof patch.landing_path === 'string' && patch.landing_path
        ? patch.landing_path
        : typeof window !== 'undefined'
          ? window.location.pathname
          : '/'

    const merged = {
      ...ctx,
      ...patch,
      landing_path: patch.landing_path || landingPath,
      city_route: patch.city_route ?? cityRouteFromPath(landingPath),
      referrer: patch.referrer ?? ctx.referrer ?? null,
      last_activity_at: new Date().toISOString(),
    }

    return await upsertWebsiteLead(merged)
  } catch {
    return null
  }
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export async function trackWebsiteLeadEvent(event, data = {}) {
  const landingPath =
    typeof data.returnPath === 'string' && data.returnPath
      ? data.returnPath
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/'

  const allowPii =
    data.allowPii === true ||
    event === 'quote_completed' ||
    event === 'payment_started' ||
    event === 'payment_completed' ||
    event === 'booking_completed'

  /** @type {Record<string, unknown>} */
  const patch = {
    landing_path: landingPath,
    city_route: cityRouteFromPath(landingPath),
  }

  if (data.quoteRef) patch.quote_ref = data.quoteRef
  if (data.serviceType) patch.service_type = data.serviceType
  if (data.step != null) patch.current_step = data.step
  if (data.estimatedTotal != null) patch.estimated_total = data.estimatedTotal

  if (allowPii) {
    if (data.customerName) patch.customer_name = data.customerName
    if (data.customerEmail) patch.customer_email = data.customerEmail
    if (data.customerPhone) patch.customer_phone = data.customerPhone
    if (data.pickupAddress) {
      patch.pickup_address = data.pickupAddress
      patch.pickup_postcode = extractUkPostcode(String(data.pickupAddress))
    }
    if (data.deliveryAddress) {
      patch.delivery_address = data.deliveryAddress
      patch.delivery_postcode = extractUkPostcode(String(data.deliveryAddress))
    }
  }

  switch (event) {
    case 'page_view':
      patch.status = 'visited'
      patch.funnel_event = 'page_view'
      break
    case 'visitor_started_quote':
      patch.status = 'visited'
      patch.funnel_event = 'visitor_started_quote'
      break
    case 'quote_started':
    case 'new_quote_started':
    case 'new_quote_from_service':
      patch.status = 'quote_started'
      patch.funnel_event = event
      break
    case 'saved_quote_created':
      patch.status = 'quote_started'
      patch.funnel_event = 'saved_quote_created'
      break
    case 'saved_quote_resumed':
      patch.status = 'quote_started'
      patch.funnel_event = 'saved_quote_resumed'
      break
    case 'step_completed':
      patch.status = 'step_completed'
      patch.funnel_event = 'step_completed'
      break
    case 'quote_step_1':
    case 'quote_step_2':
    case 'quote_step_3':
    case 'quote_step_4':
      patch.status = 'step_completed'
      patch.funnel_event = event
      patch.current_step = Number(String(event).replace('quote_step_', '')) || patch.current_step
      break
    case 'payment_option_selected':
      patch.funnel_event = 'payment_option_selected'
      break
    case 'pickup_address_changed':
    case 'dropoff_address_changed':
      patch.funnel_event = event
      break
    case 'quote_abandoned':
      patch.status = 'quote_abandoned'
      patch.abandoned_at = new Date().toISOString()
      patch.funnel_event = 'quote_abandoned'
      break
    case 'quote_completed':
      patch.status = 'quote_completed'
      patch.funnel_event = 'quote_completed'
      break
    case 'payment_started':
      patch.status = 'payment_started'
      patch.funnel_event = 'payment_started'
      break
    case 'payment_completed':
    case 'booking_completed':
      patch.status = 'payment_completed'
      patch.funnel_event = event === 'booking_completed' ? 'booking_completed' : 'payment_completed'
      patch.recovered_booking = data.recoveredBooking === true
      break
    default:
      patch.funnel_event = event
  }

  if (data.appendTimelineEvent) {
    patch.timeline_event = data.appendTimelineEvent
  }

  const funnelEvent = String(patch.funnel_event || event)
  const canonical = canonicalFunnelEventName(funnelEvent, patch.current_step)
  void recordWebsiteEvent(canonical, patch, data)
  if (event === 'payment_completed' && canonical !== 'booking_completed') {
    void recordWebsiteEvent('booking_completed', patch, data)
  }

  return trackWebsiteLeadPatch(patch)
}

/**
 * Sync wizard snapshot to website_leads (same session / quote ref).
 * Contact fields only when allowContactInLead is true (quote submit / payment).
 * @param {{
 *   step: number,
 *   quoteRef: string,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   estimatedTotal?: number | null,
 *   status?: WebsiteLeadStatus,
 *   landingPath?: string,
 *   allowContactInLead?: boolean,
 * }} opts
 */
export function trackQuoteWizardSnapshot(opts) {
  const w = opts.wizard || {}
  const allowContact = opts.allowContactInLead === true

  return trackWebsiteLeadPatch({
    status: opts.status || (opts.step > 1 ? 'step_completed' : 'quote_started'),
    quote_ref: opts.quoteRef,
    service_type: opts.serviceType,
    current_step: opts.step,
    landing_path: opts.landingPath || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    funnel_event: opts.step >= 1 && opts.step <= 4 ? `quote_step_${opts.step}` : 'step_completed',
    ...(allowContact
      ? {
          customer_name: String(w.fullName || '').trim() || null,
          customer_email: String(w.email || '').trim() || null,
          customer_phone: String(w.phone || '').trim() || null,
          pickup_address: String(w.pickupAddress || '').trim() || null,
          delivery_address: String(w.deliveryAddress || '').trim() || null,
          pickup_postcode: extractUkPostcode(String(w.pickupAddress || '')),
          delivery_postcode: extractUkPostcode(String(w.deliveryAddress || '')),
        }
      : {}),
    estimated_total: opts.estimatedTotal ?? null,
    last_activity_at: new Date().toISOString(),
  })
}
