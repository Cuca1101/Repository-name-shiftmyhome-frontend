import { geocodeAddressCached } from './operationsMapGeocodeCache'
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
export async function resolveQuoteRouteCoordinates(q, job, token) {
  const pickupAddr = resolveQuoteCollectionAddress(q, job)
  const deliveryAddr = resolveQuoteDeliveryAddress(q, job)

  if (!token) {
    return {
      pickupLng: null,
      pickupLat: null,
      deliveryLng: null,
      deliveryLat: null,
      error: 'Map token not configured. Add VITE_MAPBOX_TOKEN to your .env file and restart npm run dev.',
      pickupAddress: pickupAddr,
      deliveryAddress: deliveryAddr,
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
    geocodeStop(q, job, 'collection', token),
    geocodeStop(q, job, 'delivery', token),
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
  }
}
