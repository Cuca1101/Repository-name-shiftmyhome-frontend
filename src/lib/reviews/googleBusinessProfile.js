/**
 * Public Google Business Profile listing for ShiftMyHome.
 * Place ID comes from the existing review link (g.page → placeid).
 * Places API (New) returns the live rating, total count, and the latest reviews.
 */

import { hasGoogleMapsKey } from '../googlePlaces.js'

export const GOOGLE_BUSINESS_PLACE_ID = 'ChIJV4pdS8SwgS4RabBFQ_PZ0Ls'

const FIELD_MASK = [
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'reviews.rating',
  'reviews.text',
  'reviews.publishTime',
  'reviews.authorAttribution.displayName',
].join(',')

/**
 * @typedef {Object} GoogleBusinessReview
 * @property {string} id
 * @property {'google'} source
 * @property {string} authorName
 * @property {string} body
 * @property {number} rating
 * @property {string} date
 */

/**
 * @typedef {Object} GoogleBusinessProfile
 * @property {number} rating
 * @property {number} reviewCount
 * @property {string} mapsUri
 * @property {GoogleBusinessReview[]} reviews
 */

/** @type {GoogleBusinessProfile | null} */
let cachedProfile = null
/** @type {Promise<GoogleBusinessProfile | null> | null} */
let profilePromise = null

/** @returns {GoogleBusinessProfile | null} */
export function getCachedGoogleBusinessProfile() {
  return cachedProfile
}

/**
 * @param {unknown} value
 * @returns {GoogleBusinessReview | null}
 */
function mapReview(value, index) {
  if (!value || typeof value !== 'object') return null
  const row = /** @type {Record<string, any>} */ (value)
  const body = String(row.text?.text || '').trim()
  const authorName = String(row.authorAttribution?.displayName || '').trim()
  const rating = Number(row.rating)
  const published = String(row.publishTime || '')
  if (!body || !authorName || !Number.isFinite(rating)) return null
  return {
    id: `google-${published || index}`,
    source: 'google',
    authorName,
    body,
    rating,
    date: published.slice(0, 10) || '1970-01-01',
  }
}

/**
 * @returns {Promise<GoogleBusinessProfile | null>}
 */
async function requestProfile() {
  const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
  if (!key) return null

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(GOOGLE_BUSINESS_PLACE_ID)}`,
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    },
  )
  if (!response.ok) return null

  const data = await response.json()
  const rating = Number(data?.rating)
  const reviewCount = Number(data?.userRatingCount)
  if (!Number.isFinite(rating) || !Number.isFinite(reviewCount) || reviewCount < 1) return null

  const reviews = Array.isArray(data.reviews)
    ? data.reviews.map(mapReview).filter(Boolean)
    : []

  return {
    rating,
    reviewCount,
    mapsUri: String(data.googleMapsUri || '').trim(),
    reviews,
  }
}

/** One request per page load, shared by the badge and the reviews drawer. */
export function fetchGoogleBusinessProfile() {
  if (!hasGoogleMapsKey()) return Promise.resolve(null)
  if (cachedProfile) return Promise.resolve(cachedProfile)
  if (!profilePromise) {
    profilePromise = requestProfile()
      .then((profile) => {
        cachedProfile = profile
        return profile
      })
      .catch(() => null)
      .finally(() => {
        profilePromise = null
      })
  }
  return profilePromise
}
