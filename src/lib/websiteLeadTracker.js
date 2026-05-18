import { upsertWebsiteLead } from './data/websiteLeadsRepository'

/** @typedef {import('./data/websiteLeadsRepository').WebsiteLeadStatus} WebsiteLeadStatus */

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

/**
 * @param {string} [address]
 */
export function extractUkPostcode(address) {
  const m = String(address || '').match(UK_POSTCODE_RE)
  return m ? m[1].toUpperCase().replace(/\s+/g, ' ').trim() : ''
}

/**
 * @param {Record<string, unknown>} patch
 */
export async function trackWebsiteLeadPatch(patch) {
  if (typeof window === 'undefined') return null
  try {
    return await upsertWebsiteLead({
      ...patch,
      last_activity_at: new Date().toISOString(),
    })
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

  /** @type {Record<string, unknown>} */
  const patch = {
    landing_path: landingPath,
  }

  if (data.quoteRef) patch.quote_ref = data.quoteRef
  if (data.serviceType) patch.service_type = data.serviceType
  if (data.step != null) patch.current_step = data.step
  if (data.estimatedTotal != null) patch.estimated_total = data.estimatedTotal
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

  switch (event) {
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
      patch.status = 'payment_completed'
      patch.funnel_event = 'payment_completed'
      patch.recovered_booking = data.recoveredBooking === true
      break
    default:
      patch.funnel_event = event
  }

  if (data.appendTimelineEvent) {
    patch.timeline_event = data.appendTimelineEvent
  }

  return trackWebsiteLeadPatch(patch)
}

/**
 * Sync wizard snapshot to website_leads (same session / quote ref).
 * @param {{
 *   step: number,
 *   quoteRef: string,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   estimatedTotal?: number | null,
 *   status?: WebsiteLeadStatus,
 *   landingPath?: string,
 * }} opts
 */
export function trackQuoteWizardSnapshot(opts) {
  const w = opts.wizard || {}
  return trackWebsiteLeadPatch({
    status: opts.status || (opts.step > 1 ? 'step_completed' : 'quote_started'),
    quote_ref: opts.quoteRef,
    service_type: opts.serviceType,
    current_step: opts.step,
    landing_path: opts.landingPath || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    customer_name: String(w.fullName || '').trim() || null,
    customer_email: String(w.email || '').trim() || null,
    customer_phone: String(w.phone || '').trim() || null,
    pickup_address: String(w.pickupAddress || '').trim() || null,
    delivery_address: String(w.deliveryAddress || '').trim() || null,
    pickup_postcode: extractUkPostcode(String(w.pickupAddress || '')),
    delivery_postcode: extractUkPostcode(String(w.deliveryAddress || '')),
    estimated_total: opts.estimatedTotal ?? null,
    last_activity_at: new Date().toISOString(),
  })
}
