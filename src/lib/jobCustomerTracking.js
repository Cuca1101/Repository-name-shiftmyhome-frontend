/**
 * Client helpers for post-payment job tracking / customer notifications.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { isSupabasePublicConfigured, supabasePublic } from './supabasePublicClient'

export function trackingClient() {
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  if (isSupabaseConfigured && supabase) return supabase
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
    on_way: 'On the way',
    started: 'On the way',
    start: 'On the way',
    arrived: 'Arrived at pickup',
    arrived_pickup: 'Arrived at pickup',
    loading: 'Loading',
    loaded: 'Loading',
    pickup_completed: 'Pickup completed',
    in_transit: 'On the way to delivery',
    in_progress: 'In progress',
    arrived_delivery: 'Arrived at delivery',
    unloading: 'Unloading',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[s] || String(raw || 'Driver assigned')
}

/**
 * @param {string} photoType
 * @param {string} [stopType]
 */
export function photoSectionForType(photoType, stopType) {
  const t = String(photoType || '').toLowerCase()
  const stop = String(stopType || '').toLowerCase()
  if (t === 'damage') return 'damage'
  if (t === 'waiver_signature' || t === 'pod_signature') return 'waiver'
  if (t === 'delivery' || stop === 'delivery') return 'delivery'
  if (t === 'pickup' || t === 'collection' || stop === 'pickup' || stop === 'collection') return 'pickup'
  if (t === 'loaded' || stop === 'loaded' || /load/i.test(t)) return 'loaded'
  return 'general'
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
