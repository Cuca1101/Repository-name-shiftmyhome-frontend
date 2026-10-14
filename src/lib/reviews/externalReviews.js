/**
 * External review platforms. Google totals come from Places.
 * Trustpilot totals come from the public profile proxy.
 */

import { fetchPublicDisplayReviews } from '../data/reviewsRepository'
import { fetchGoogleBusinessProfile, getCachedGoogleBusinessProfile } from './googleBusinessProfile.js'
import { fetchTrustpilotProfile, getCachedTrustpilotProfile } from './trustpilotProfile.js'
/** @typedef {'google' | 'trustpilot' | 'customer'} ReviewSource */

/**
 * @typedef {Object} ExternalReview
 * @property {string} id
 * @property {ReviewSource} source
 * @property {string} authorName
 * @property {string} body
 * @property {number} rating
 * @property {string} date ISO date string (YYYY-MM-DD)
 */

/**
 * @typedef {Object} ReviewPlatformSummary
 * @property {ReviewSource} source
 * @property {string} label
 * @property {number} averageRating
 * @property {number} reviewCount
 * @property {string} [subtitle]
 */

export const REVIEWS_BADGE_DISMISS_KEY = 'smh-reviews-badge-dismissed'
export const REVIEWS_BADGE_VERSION_KEY = 'smh-reviews-badge-version'
/** Bump when badge UI changes so returning visitors see the new widget. */
export const REVIEWS_BADGE_VERSION = '4'
export const REVIEWS_BADGE_DISMISS_DAYS = 30

/** Google Business Profile totals come from Places. Trustpilot totals come from the public profile proxy. */
export function isGoogleReviewsLive() {
  return Boolean(getCachedGoogleBusinessProfile())
}

export function isTrustpilotReviewsLive() {
  return Boolean(getCachedTrustpilotProfile())
}

export const GOOGLE_LEAVE_REVIEW_URL =
  String(import.meta.env.VITE_GOOGLE_REVIEWS_URL || '').trim()
  || 'https://g.page/r/CWmwRUPz2dC7EAE/review'

export const TRUSTPILOT_LEAVE_REVIEW_URL =
  import.meta.env.VITE_TRUSTPILOT_REVIEWS_URL ||
  'https://www.trustpilot.com/evaluate/www.shiftmyhome.co.uk'

/** @param {import('./googleBusinessProfile.js').GoogleBusinessProfile | null} profile */
function googleSummaryFromProfile(profile) {
  if (!profile) return null
  return {
    averageRating: profile.rating,
    reviewCount: profile.reviewCount,
    label: 'Google Reviews',
  }
}

/** @param {import('./trustpilotProfile.js').TrustpilotProfile | null} profile */
function trustpilotSummaryFromProfile(profile) {
  if (!profile) return null
  return {
    averageRating: profile.reviewCount > 0 ? profile.rating : 0,
    reviewCount: profile.reviewCount,
    label: 'Trustpilot Reviews',
  }
}

function combinedLiveSummary() {
  const google = googleSummaryFromProfile(getCachedGoogleBusinessProfile())
  const trustpilot = trustpilotSummaryFromProfile(getCachedTrustpilotProfile())
  const parts = [google, trustpilot].filter((item) => item && item.reviewCount > 0)
  if (parts.length) {
    const reviewCount = parts.reduce((sum, item) => sum + item.reviewCount, 0)
    const weighted = parts.reduce((sum, item) => sum + item.averageRating * item.reviewCount, 0)
    return {
      averageRating: weighted / reviewCount,
      reviewCount,
      label: 'All platforms',
    }
  }
  if (google) return { ...google, label: 'All platforms' }
  if (trustpilot) return { ...trustpilot, label: 'All platforms' }
  return null
}

/**
 * Lazy-load review data when the drawer opens.
 * Google cards and totals come from the Business Profile listing.
 * @returns {Promise<ExternalReview[]>}
 */
export async function fetchExternalReviews() {
  /** @type {ExternalReview[]} */
  let customerReviews = []
  try {
    const rows = await fetchPublicDisplayReviews()
    customerReviews = rows.map((r) => ({
      id: `customer-${r.id}`,
      source: 'customer',
      authorName: r.author_name,
      body: r.body,
      rating: r.stars ?? 5,
      date: r.created_at?.slice(0, 10) || '1970-01-01',
    }))
  } catch {
    /* admin reviews optional */
  }

  const [profile, trustpilot] = await Promise.all([fetchGoogleBusinessProfile(), fetchTrustpilotProfile()])
  const googleReviews = profile?.reviews || []
  const trustpilotReviews = trustpilot?.reviews || []
  return [...customerReviews, ...googleReviews, ...trustpilotReviews].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * @param {ReviewSource | 'all'} tab
 * @param {ExternalReview[]} reviews
 */
export function filterReviewsByTab(tab, reviews) {
  if (tab === 'all') {
    return [...reviews].sort((a, b) => b.date.localeCompare(a.date))
  }
  return reviews.filter((r) => r.source === tab)
}

/**
 * @param {ReviewSource | 'all'} tab
 * @param {ExternalReview[]} [reviews]
 */
export function getSummaryForTab(tab, reviews = []) {
  if (tab === 'all') {
    const combined = combinedLiveSummary()
    if (combined) return combined
  }

  if (tab === 'all' && reviews.length > 0) {
    const count = reviews.length
    const weighted = reviews.reduce((s, r) => s + r.rating, 0)
    return {
      averageRating: count ? weighted / count : 0,
      reviewCount: count,
      label: 'All platforms',
    }
  }

  if (tab === 'all') {
    const google = googleSummaryFromProfile(getCachedGoogleBusinessProfile())
    return google || { averageRating: 0, reviewCount: 0, label: 'All platforms' }
  }
  if (tab === 'customer' && reviews.length > 0) {
    const customerOnly = reviews.filter((r) => r.source === 'customer')
    const count = customerOnly.length
    const weighted = customerOnly.reduce((s, r) => s + r.rating, 0)
    return {
      averageRating: count ? weighted / count : 0,
      reviewCount: count,
      label: 'Customer Reviews',
    }
  }

  if (tab === 'google') {
    const google = googleSummaryFromProfile(getCachedGoogleBusinessProfile())
    if (google) return google
  }

  if (tab === 'trustpilot') {
    const trustpilot = trustpilotSummaryFromProfile(getCachedTrustpilotProfile())
    if (trustpilot) return trustpilot
  }

  return { averageRating: 0, reviewCount: 0, label: '' }
}

/**
 * @returns {boolean}
 */
export function isReviewsBadgeDismissed() {
  if (typeof window === 'undefined') return false
  try {
    const version = localStorage.getItem(REVIEWS_BADGE_VERSION_KEY)
    if (version !== REVIEWS_BADGE_VERSION) {
      localStorage.removeItem(REVIEWS_BADGE_DISMISS_KEY)
      localStorage.setItem(REVIEWS_BADGE_VERSION_KEY, REVIEWS_BADGE_VERSION)
      return false
    }
    const raw = localStorage.getItem(REVIEWS_BADGE_DISMISS_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt)) return false
    const ms = REVIEWS_BADGE_DISMISS_DAYS * 24 * 60 * 60 * 1000
    return Date.now() - dismissedAt < ms
  } catch {
    return false
  }
}

export function dismissReviewsBadge() {
  try {
    localStorage.setItem(REVIEWS_BADGE_DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} isoDate
 */
export function formatReviewDate(isoDate) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

/**
 * @param {string} isoDate
 */
export function formatRelativeReviewDate(isoDate) {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 14) return `${days} days ago`
    if (days < 60) {
      const weeks = Math.floor(days / 7)
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    }
    return formatReviewDate(isoDate)
  } catch {
    return isoDate
  }
}
