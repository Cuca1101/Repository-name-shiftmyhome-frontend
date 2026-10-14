/**
 * Live Trustpilot profile for ShiftMyHome, via the same-origin /api/reviews/trustpilot proxy.
 */

/**
 * @typedef {Object} TrustpilotReview
 * @property {string} id
 * @property {'trustpilot'} source
 * @property {string} authorName
 * @property {string} body
 * @property {number} rating
 * @property {string} date
 */

/**
 * @typedef {Object} TrustpilotProfile
 * @property {string} name
 * @property {number} rating
 * @property {number} reviewCount
 * @property {string} profileUrl
 * @property {TrustpilotReview[]} reviews
 */

/** @type {TrustpilotProfile | null} */
let cachedProfile = null
/** @type {Promise<TrustpilotProfile | null> | null} */
let profilePromise = null

/** @returns {TrustpilotProfile | null} */
export function getCachedTrustpilotProfile() {
  return cachedProfile
}

const PLACEHOLDER_TRUSTPILOT = /excellent\s+4\.8/i

/** CMS still ships the old invented score. Treat that sentence as unset. */
export function isPlaceholderTrustpilotText(text) {
  const value = String(text || '').trim()
  return !value || PLACEHOLDER_TRUSTPILOT.test(value)
}

/** @param {TrustpilotProfile | null | undefined} profile */
export function trustpilotDisplayLabel(profile) {
  if (!profile) return null
  if (profile.reviewCount < 1) return 'Trustpilot · no reviews yet'
  const count = profile.reviewCount.toLocaleString('en-GB')
  return `${profile.rating.toFixed(1)} out of 5 on Trustpilot · ${count} reviews`
}

/** One request per page load, shared by the badge, hero, and reviews drawer. */
export function fetchTrustpilotProfile() {
  if (cachedProfile) return Promise.resolve(cachedProfile)
  if (!profilePromise) {
    profilePromise = fetch('/api/reviews/trustpilot')
      .then(async (response) => {
        if (!response.ok) return null
        const data = await response.json()
        const reviewCount = Number(data?.reviewCount)
        const rating = Number(data?.rating)
        if (!Number.isFinite(reviewCount) || reviewCount < 0 || !Number.isFinite(rating)) return null
        /** @type {TrustpilotProfile} */
        const profile = {
          name: String(data.name || 'ShiftMyHome'),
          rating,
          reviewCount,
          profileUrl: String(data.profileUrl || 'https://www.trustpilot.com/review/www.shiftmyhome.co.uk'),
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
        }
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
