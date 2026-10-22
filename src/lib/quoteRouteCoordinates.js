import { geocodeAddressCached } from './operationsMapGeocodeCache'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  resolveQuoteCollectionAddress,
  resolveQuoteDeliveryAddress,
} from './quoteAddressResolve'
import { parseDetailsKeyValues } from './quoteJobAdminModel'

/** @param {unknown} s */
function clean(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

const UK_REGION_ONLY = new Set([
  'scotland',
  'england',
  'wales',
  'northern ireland',
  'uk',
  'united kingdom',
  'great britain',
  'gb',
])

/** @param {unknown} s */
function isRegionOnlyLabel(s) {
  const t = clean(s).toLowerCase()
  return !t || UK_REGION_ONLY.has(t)
}

/** @param {unknown} s */
function looksLikeFullAddress(s) {
  const t = clean(s)
  if (!t || isRegionOnlyLabel(t)) return false
  if (/\d/.test(t)) return true
  if (t.includes(',')) return true
  if (/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(t)) return true
  return t.split(',').map((p) => p.trim()).filter(Boolean).length >= 2
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} job
 * @param {'collection' | 'delivery'} kind
 */
export function resolveQuotePostcode(q, job, kind) {
  if (!q || typeof q !== 'object') return ''
  const kv = {
    ...(job?.details ? parseDetailsKeyValues(job.details) : {}),
    ...parseDetailsKeyValues(q.details),
  }
  const prefix = kind === 'collection' ? 'pickup' : 'delivery'
  const camel = kind === 'collection' ? 'pickup' : 'delivery'
  return clean(
    q[`${prefix}_postcode`] ??
      q[`${camel}Postcode`] ??
      kv[kind === 'collection' ? 'Pickup postcode' : 'Delivery postcode'],
  )
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} job
 * @param {'collection' | 'delivery'} kind
 * @param {string} token
 */
async function geocodeStop(q, job, kind, token) {
  const addr =
    kind === 'collection'
      ? resolveQuoteCollectionAddress(q, job)
      : resolveQuoteDeliveryAddress(q, job)
  const postcode = resolveQuotePostcode(q, job, kind)
  const queries = []

  if (addr && addr !== '—') {
    if (looksLikeFullAddress(addr)) queries.push(addr)
    else if (!isRegionOnlyLabel(addr)) queries.push(`${addr}, United Kingdom`)
  }
  if (postcode) {
    queries.push(`${postcode}, United Kingdom`)
    if (addr && addr !== '—' && !queries.includes(addr)) {
      queries.push(`${addr}, ${postcode}, United Kingdom`)
    }
  }

  const seen = new Set()
  for (const query of queries) {
    const key = query.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const hit = await geocodeAddressCached(query, token)
    if (hit) return hit
  }
  return null
}

/**
 * Geocode pickup + delivery for admin dispatch map.
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} [job]
 * @param {string} token
 */
function savedStop(record, latKey, lngKey) {
  const lat = Number(record?.[latKey])
  const lng = Number(record?.[lngKey])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export async function resolveQuoteRouteCoordinates(q, job, token) {
  const pickupAddr = resolveQuoteCollectionAddress(q, job)
  const deliveryAddr = resolveQuoteDeliveryAddress(q, job)
  const savedPickup = savedStop(q, 'pickup_lat', 'pickup_lng') || savedStop(job, 'pickup_lat', 'pickup_lng')
  const savedDelivery = savedStop(q, 'delivery_lat', 'delivery_lng') || savedStop(job, 'delivery_lat', 'delivery_lng')
  if (savedPickup && savedDelivery) {
    return {
      pickupLng: savedPickup.lng,
      pickupLat: savedPickup.lat,
      deliveryLng: savedDelivery.lng,
      deliveryLat: savedDelivery.lat,
      error: null,
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
      coordinateSource: 'saved',
    }
  }

  if (!token) {
    return {
      pickupLng: savedPickup?.lng ?? null,
      pickupLat: savedPickup?.lat ?? null,
      deliveryLng: savedDelivery?.lng ?? null,
      deliveryLat: savedDelivery?.lat ?? null,
      error: savedPickup || savedDelivery
        ? ''
        : 'Map token not configured. Add VITE_MAPBOX_TOKEN to your .env file and restart npm run dev.',
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
      coordinateSource: savedPickup || savedDelivery ? 'saved' : '',
    }
  }

  if (
    (!pickupAddr || pickupAddr === '—' || isRegionOnlyLabel(pickupAddr)) &&
    (!deliveryAddr || deliveryAddr === '—' || isRegionOnlyLabel(deliveryAddr))
  ) {
    return {
      pickupLng: null,
      pickupLat: null,
      deliveryLng: null,
      deliveryLat: null,
      error: 'Add pickup and delivery addresses (or postcodes) on this job to show the route map.',
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
    }
  }

  const [pickup, delivery] = await Promise.all([
    savedPickup ? Promise.resolve(savedPickup) : geocodeStop(q, job, 'collection', token),
    savedDelivery ? Promise.resolve(savedDelivery) : geocodeStop(q, job, 'delivery', token),
  ])

  const parts = []
  if (!pickup) parts.push('pickup')
  if (!delivery) parts.push('delivery')

  return {
    pickupLng: pickup?.lng ?? null,
    pickupLat: pickup?.lat ?? null,
    deliveryLng: delivery?.lng ?? null,
    deliveryLat: delivery?.lat ?? null,
    error:
      parts.length === 0
        ? ''
        : `Could not locate ${parts.join(' and ')} on the map. Check postcodes in Job details.`,
    pickupAddress: pickupAddr,
    deliveryAddress: deliveryAddr,
    coordinateSource: savedPickup && savedDelivery ? 'saved' : 'geocoded',
  }
}

/**
 * Keep the map point and the 100 m arrival point the same. Only fills
 * coordinates that are not already saved.
 * @param {Record<string, unknown>} quote
 * @param {{ pickupLat?: number | null, pickupLng?: number | null, deliveryLat?: number | null, deliveryLng?: number | null }} result
 */
export async function persistMissingStopCoordinates(quote, result) {
  if (!isSupabaseConfigured || !supabase || !quote?.id) return
  const patch = {}
  if (
    !savedStop(quote, 'pickup_lat', 'pickup_lng')
    && Number.isFinite(Number(result?.pickupLat))
    && Number.isFinite(Number(result?.pickupLng))
  ) {
    patch.pickup_lat = Number(result.pickupLat)
    patch.pickup_lng = Number(result.pickupLng)
  }
  if (
    !savedStop(quote, 'delivery_lat', 'delivery_lng')
    && Number.isFinite(Number(result?.deliveryLat))
    && Number.isFinite(Number(result?.deliveryLng))
  ) {
    patch.delivery_lat = Number(result.deliveryLat)
    patch.delivery_lng = Number(result.deliveryLng)
  }
  if (!Object.keys(patch).length) return
  const { error } = await supabase.from('quotes').update(patch).eq('id', String(quote.id))
  if (error && import.meta.env.DEV) {
    console.warn('[stop coordinates] save failed', error.message)
  }
}
