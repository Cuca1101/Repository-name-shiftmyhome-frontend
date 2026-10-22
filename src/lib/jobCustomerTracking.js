/**
 * Client helpers for post-payment job tracking / customer notifications.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { isSupabasePublicConfigured, supabasePublic } from './supabasePublicClient'

export function trackingClient() {
  // Public anon client only — never the admin-authenticated browser client.
  // An expired admin session on the same device was breaking Track My Driver.
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  return null
}

export function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '')
  return 'https://www.shiftmyhome.co.uk'
}

/** @param {string} token */
export function buildJobTrackingUrl(token) {
  return `${siteOrigin()}/track/${token}`
}

/**
 * Customer-facing status label (mirrors edge helper).
 * @param {string|null|undefined} raw
 */
export function customerJobStatusLabel(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const map = {
    assigned: 'Driver assigned',
    accepted: 'Driver assigned',
    booked: 'Driver assigned',
    active: 'Driver assigned',
    left_for_collection: 'Left for collection',
    on_way: 'Left for collection',
    started: 'Left for collection',
    start: 'Left for collection',
    at_collection: 'Arrived at collection',
    arrived: 'Arrived at collection',
    arrived_pickup: 'Arrived at collection',
    arrived_at_collection: 'Arrived at collection',
    loading: 'Loading',
    loading_started: 'Loading',
    loaded: 'Items collected',
    collection_finished: 'Items collected',
    items_collected: 'Items collected',
    pickup_completed: 'Items collected',
    left_for_delivery: 'Left for delivery',
    in_transit: 'Left for delivery',
    in_progress: 'Left for collection',
    at_delivery: 'Arrived at delivery',
    arrived_delivery: 'Arrived at delivery',
    arrived_at_delivery: 'Arrived at delivery',
    unloading: 'Unloading',
    unloading_started: 'Unloading',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[s] || String(raw || 'Driver assigned')
}

/**
 * @param {string} photoType
 * @param {string} [stopType]
 */
export function photoSectionForType(photoType, stopType, metadata) {
  const t = String(photoType || '').toLowerCase()
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const stop = String(stopType || meta.stop_type || meta.stopType || '').toLowerCase()
  const evidence = String(meta.evidence_type || '').toLowerCase()
  const location = String(meta.location_type || '').toLowerCase()
  const kind = String(meta.photo_kind || meta.category || '').toLowerCase()
  if (
    t === 'waiver_signature'
    || t === 'pod_signature'
    || evidence === 'waiver_signature'
    || evidence === 'pod_signature'
  ) return 'waiver'
  if (t === 'damage' || kind === 'damage') return 'damage'
  if (t === 'loaded' || stop === 'loaded' || /load/i.test(t)) return 'loaded'
  if (stop === 'pickup' || stop === 'collection' || location === 'collection') return 'pickup'
  if (stop === 'dropoff' || stop === 'delivery' || location === 'delivery' || t === 'delivery') return 'delivery'
  if (t === 'pickup' || t === 'collection') return 'pickup'
  if (t === 'proof') return 'proof'
  return 'general'
}

/** @param {Array<Record<string, unknown>> | null | undefined} photos */
export function groupJobPhotos(photos) {
  const groups = { pickup: [], loaded: [], delivery: [], damage: [], waiver: [], proof: [], general: [] }
  for (const photo of photos || []) {
    const key = photoSectionForType(photo?.photo_type, photo?.stop_type, photo?.metadata)
    if (!groups[key]) groups[key] = []
    groups[key].push(photo)
  }
  return groups
}

/**
 * @param {string} quoteId
 * @param {string} eventKey
 * @param {{ force?: boolean }} [opts]
 */
export async function sendJobCustomerNotify(quoteId, eventKey, opts = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('process-job-customer-notify', {
    body: { quote_id: quoteId, event_key: eventKey, force: Boolean(opts.force) },
  })
  if (error) throw new Error(error.message || 'Notify failed')
  if (data && data.ok === false && !data.skipped) {
    throw new Error(data.error || 'Notify failed')
  }
  return data
}

/** Drain pending job_customer_notify_queue (driver status → email). */
export async function drainJobCustomerNotifyQueue() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.functions.invoke('process-job-customer-notify', {
    body: { process_queue: true },
  })
  if (error) throw new Error(error.message || 'Queue drain failed')
  return data
}

/**
 * @param {string} quoteId
 */
export async function ensureJobTrackingToken(quoteId) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('ensure_job_tracking_token', { p_quote_id: quoteId })
  if (error) throw new Error(error.message || 'Could not create tracking token')
  return String(data)
}

/**
 * @param {string} quoteId
 */
export async function fetchJobCustomerNotifications(quoteId) {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('job_customer_notifications')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sent_at', { ascending: false })
  if (error) return []
  return data || []
}

/**
 * Email History rows for a customer lead (admin abandoned notify, etc.).
 * @param {string} customerLeadId
 */
export async function fetchCustomerLeadNotifications(customerLeadId) {
  if (!isSupabaseConfigured || !supabase) return []
  const id = String(customerLeadId || '').trim()
  if (!id) return []
  const { data, error } = await supabase
    .from('customer_lead_notifications')
    .select('*')
    .eq('customer_lead_id', id)
    .order('sent_at', { ascending: false })
  if (error) return []
  return data || []
}

/**
 * @param {string} quoteId
 */
export async function fetchJobTrackingTokenRow(quoteId) {
  if (!isSupabaseConfigured || !supabase) return null
  const { data } = await supabase
    .from('job_tracking_tokens')
    .select('*')
    .eq('quote_id', quoteId)
    .maybeSingle()
  return data
}

/**
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  const value = String(text || '')
  if (!value) throw new Error('Nothing to copy')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}
