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

/** Britain and Ireland. A point outside this box is not a usable stop. */
export function isBritainOrIreland(lat, lng) {
  return lat >= 49 && lat <= 61.2 && lng >= -11 && lng <= 2.2
}

function usableStop(record, latKey, lngKey) {
  const point = savedStop(record, latKey, lngKey)
  if (!point || !isBritainOrIreland(point.lat, point.lng)) return null
  return point
}

/** A new address this far from the saved pin replaces it. The job status is left alone. */
const ADDRESS_PIN_MOVE_METRES = 250

function metresBetween(a, b) {
  const earth = 6371000
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Saved pins stay while they still match the address.
 * An edited address moves the pin to the new place.
 */
async function resolveStopPin(saved, q, job, kind, token) {
  if (!token) return { point: saved, moved: false }
  const hit = await geocodeStop(q, job, kind, token)
  const next = hit && isBritainOrIreland(hit.lat, hit.lng) ? hit : null
  if (!next) return { point: saved, moved: false }
  if (!saved) return { point: next, moved: true }
  if (metresBetween(saved, next) > ADDRESS_PIN_MOVE_METRES) return { point: next, moved: true }
  return { point: saved, moved: false }
}

export async function resolveQuoteRouteCoordinates(q, job, token) {
  const pickupAddr = resolveQuoteCollectionAddress(q, job)
  const deliveryAddr = resolveQuoteDeliveryAddress(q, job)
  const savedPickup = usableStop(q, 'pickup_lat', 'pickup_lng') || usableStop(job, 'pickup_lat', 'pickup_lng')
  const savedDelivery = usableStop(q, 'delivery_lat', 'delivery_lng') || usableStop(job, 'delivery_lat', 'delivery_lng')
  const pickupHasAddress = Boolean(pickupAddr && pickupAddr !== '—' && !isRegionOnlyLabel(pickupAddr))
  const deliveryHasAddress = Boolean(deliveryAddr && deliveryAddr !== '—' && !isRegionOnlyLabel(deliveryAddr))
  if (token && (pickupHasAddress || deliveryHasAddress)) {
    const [pickupPin, deliveryPin] = await Promise.all([
      pickupHasAddress ? resolveStopPin(savedPickup, q, job, 'collection', token) : { point: savedPickup, moved: false },
      deliveryHasAddress ? resolveStopPin(savedDelivery, q, job, 'delivery', token) : { point: savedDelivery, moved: false },
    ])
    const pickup = pickupPin.point
    const delivery = deliveryPin.point
    const parts = []
    if (pickupHasAddress && !pickup) parts.push('pickup')
    if (deliveryHasAddress && !delivery) parts.push('delivery')
    return {
      pickupLng: pickup?.lng ?? null,
      pickupLat: pickup?.lat ?? null,
      deliveryLng: delivery?.lng ?? null,
      deliveryLat: delivery?.lat ?? null,
      error: parts.length ? `Could not locate ${parts.join(' and ')} on the map. Check postcodes in Job details.` : '',
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
      coordinateSource: pickupPin.moved || deliveryPin.moved ? 'geocoded' : 'saved',
      pickupMoved: pickupPin.moved,
      deliveryMoved: deliveryPin.moved,
    }
  }
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
      pickupMoved: false,
      deliveryMoved: false,
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

  return {
    pickupLng: savedPickup?.lng ?? null,
    pickupLat: savedPickup?.lat ?? null,
    deliveryLng: savedDelivery?.lng ?? null,
    deliveryLat: savedDelivery?.lat ?? null,
    error: 'Add pickup and delivery addresses (or postcodes) on this job to show the route map.',
    pickupAddress: pickupAddr,
    deliveryAddress: deliveryAddr,
    coordinateSource: savedPickup || savedDelivery ? 'saved' : '',
    pickupMoved: false,
    deliveryMoved: false,
  }
}

/**
 * Keep the map point and the 100 m arrival point the same.
 * Writes only pickup and delivery coordinates. Job status is not changed.
 * @param {Record<string, unknown>} quote
 * @param {{ pickupLat?: number | null, pickupLng?: number | null, deliveryLat?: number | null, deliveryLng?: number | null }} result
 */
export async function persistMissingStopCoordinates(quote, result) {
  if (!isSupabaseConfigured || !supabase || !quote?.id) return
  const patch = {}
  const nextPickupLat = Number(result?.pickupLat)
  const nextPickupLng = Number(result?.pickupLng)
  const savedPickup = usableStop(quote, 'pickup_lat', 'pickup_lng')
  if (
    (result?.pickupMoved || !savedPickup)
    && Number.isFinite(nextPickupLat)
    && Number.isFinite(nextPickupLng)
    && isBritainOrIreland(nextPickupLat, nextPickupLng)
    && (!savedPickup || metresBetween(savedPickup, { lat: nextPickupLat, lng: nextPickupLng }) > 1)
  ) {
    patch.pickup_lat = nextPickupLat
    patch.pickup_lng = nextPickupLng
  }
  const nextDeliveryLat = Number(result?.deliveryLat)
  const nextDeliveryLng = Number(result?.deliveryLng)
  const savedDelivery = usableStop(quote, 'delivery_lat', 'delivery_lng')
  if (
    (result?.deliveryMoved || !savedDelivery)
    && Number.isFinite(nextDeliveryLat)
    && Number.isFinite(nextDeliveryLng)
    && isBritainOrIreland(nextDeliveryLat, nextDeliveryLng)
    && (!savedDelivery || metresBetween(savedDelivery, { lat: nextDeliveryLat, lng: nextDeliveryLng }) > 1)
  ) {
    patch.delivery_lat = nextDeliveryLat
    patch.delivery_lng = nextDeliveryLng
  }
  if (!Object.keys(patch).length) return
  const { error } = await supabase.from('quotes').update(patch).eq('id', String(quote.id))
  if (error && import.meta.env.DEV) {
    console.warn('[stop coordinates] save failed', error.message)
  }
}
