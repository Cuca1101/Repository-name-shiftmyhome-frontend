import { parseDetailsKeyValues } from './quoteJobAdminModel'

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
function clean(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** @param {unknown} s */
function isPresent(s) {
  return clean(s).length > 0
}

/** @param {unknown} s */
function isRegionOnlyLabel(s) {
  const t = clean(s).toLowerCase()
  if (!t) return true
  return UK_REGION_ONLY.has(t)
}

/** @param {unknown} s */
function looksLikeFullAddress(s) {
  const t = clean(s)
  if (!t || isRegionOnlyLabel(t)) return false
  if (/\d/.test(t)) return true
  if (t.includes(',')) return true
  if (/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(t)) return true
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length >= 2 && !isRegionOnlyLabel(parts[0])
}

/** @param {unknown[]} parts */
function joinParts(...parts) {
  const seen = new Set()
  const out = []
  for (const p of parts) {
    const s = clean(p)
    if (!s || seen.has(s.toLowerCase())) continue
    seen.add(s.toLowerCase())
    out.push(s)
  }
  return out.join(', ')
}

/**
 * Prefer the longest useful address string.
 * @param {unknown[]} candidates
 */
function pickBestAddress(...candidates) {
  let best = ''
  let bestScore = -1
  for (const c of candidates) {
    const s = clean(c)
    if (!s) continue
    let score = s.length
    if (looksLikeFullAddress(s)) score += 200
    else if (!isRegionOnlyLabel(s)) score += 40
    else score = Math.min(score, 8)
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} [job]
 */
function detailsKv(q, job) {
  const fromQuote = parseDetailsKeyValues(q?.details)
  const fromJob = job?.details ? parseDetailsKeyValues(job.details) : {}
  return { ...fromJob, ...fromQuote }
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown>} kv
 * @param {'collection' | 'delivery'} kind
 */
function addressFromLineFields(q, kv, kind) {
  const prefix = kind === 'collection' ? 'pickup' : 'delivery'
  const camel = kind === 'collection' ? 'pickup' : 'delivery'
  const line =
    q[`${prefix}_line1`] ??
    q[`${prefix}_line_1`] ??
    q[`${prefix}_address_line1`] ??
    q[`${camel}Line1`] ??
    q[`${camel}AddressLine1`] ??
    kv[`${kind === 'collection' ? 'Pickup' : 'Delivery'} address line 1`]
  const line2 = q[`${prefix}_line2`] ?? q[`${prefix}_line_2`] ?? q[`${camel}Line2`]
  const city = q[`${prefix}_city`] ?? q[`${camel}City`] ?? kv[`${kind === 'collection' ? 'Pickup' : 'Delivery'} city`]
  const postcode =
    q[`${prefix}_postcode`] ??
    q[`${camel}Postcode`] ??
    kv[`${kind === 'collection' ? 'Pickup' : 'Delivery'} postcode`]
  return joinParts(line, line2, city, postcode)
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} [job]
 */
export function resolveQuoteCollectionAddress(q, job = null) {
  if (!q || typeof q !== 'object') return '—'
  const kv = detailsKv(q, job)
  const fromParts = addressFromLineFields(q, kv, 'collection')

  const best = pickBestAddress(
    kv['Pickup address'],
    kv['Collection address'],
    kv['Pickup / collection'],
    kv['Pickup / collection address'],
    kv['From address'],
    q.pickup_address,
    q.pickupAddress,
    q.collectionAddress,
    q.collection_address,
    fromParts,
    job?.pickup_address,
    joinParts(q.pickup_city, q.pickup_postcode),
    kv['Pickup city'],
    kv['Pickup postcode'],
    q.pickup_city,
    q.pickup_postcode,
  )

  if (best) return best
  const region = pickBestAddress(q.pickup_address, q.pickup_city, kv['Pickup city'], kv['Pickup region'])
  return region || '—'
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null | undefined} [job]
 */
export function resolveQuoteDeliveryAddress(q, job = null) {
  if (!q || typeof q !== 'object') return '—'
  const kv = detailsKv(q, job)
  const fromParts = addressFromLineFields(q, kv, 'delivery')

  const best = pickBestAddress(
    kv['Delivery address'],
    kv['Drop-off address'],
    kv['Dropoff address'],
    kv['Delivery / drop-off'],
    kv['To address'],
    q.delivery_address,
    q.deliveryAddress,
    q.dropoffAddress,
    q.dropoff_address,
    fromParts,
    job?.delivery_address,
    joinParts(q.delivery_city, q.delivery_postcode),
    kv['Delivery city'],
    kv['Delivery postcode'],
    q.delivery_city,
    q.delivery_postcode,
  )

  if (best) return best
  const region = pickBestAddress(q.delivery_address, q.delivery_city, kv['Delivery city'], kv['Delivery region'])
  return region || '—'
}

/**
 * @param {unknown} address
 * @param {number} [maxLen]
 */
export function truncateAddressForCard(address, maxLen = 72) {
  const full = clean(address)
  if (!full) return { full: '—', display: '—' }
  if (full.length <= maxLen) return { full, display: full }
  return { full, display: `${full.slice(0, maxLen - 1)}…` }
}
