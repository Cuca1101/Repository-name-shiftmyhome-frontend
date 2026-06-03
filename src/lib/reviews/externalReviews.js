/**
 * External review platforms — config, placeholders, and lazy fetch hooks.
 * Replace PLACEHOLDER_* and wire fetchExternalReviews when Google / Trustpilot APIs are connected.
 */

import { fetchPublicDisplayReviews } from '../data/reviewsRepository'
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
export const REVIEWS_BADGE_VERSION = '3'
export const REVIEWS_BADGE_DISMISS_DAYS = 30

/** Set true once Google / Trustpilot APIs supply live averages and counts. */
export const REVIEWS_LIVE_STATS_CONNECTED = false

export const GOOGLE_LEAVE_REVIEW_URL =
  import.meta.env.VITE_GOOGLE_REVIEWS_URL || 'https://g.page/r/CWmwRUPz2dC7EAE/review'

export const TRUSTPILOT_LEAVE_REVIEW_URL =
  import.meta.env.VITE_TRUSTPILOT_REVIEWS_URL ||
  'https://www.trustpilot.com/evaluate/www.shiftmyhome.co.uk'

/** Placeholder averages/counts — replace when live widgets or APIs are connected. */
export const REVIEWS_PLATFORM_SUMMARIES = [
  {
    source: 'google',
    label: 'Google Reviews',
    averageRating: 4.9,
    reviewCount: 127,
    subtitle: 'Google Reviews',
  },
  {
    source: 'trustpilot',
    label: 'Trustpilot Reviews',
    averageRating: 4.8,
    reviewCount: 89,
    subtitle: 'Trustpilot Reviews',
  },
]

/** Placeholder cards — swap with API responses in fetchExternalReviews. */
const PLACEHOLDER_REVIEWS = [
  {
    id: 'google-1',
    source: 'google',
    authorName: 'Michael R.',
    body: 'Fantastic team — punctual, careful with our furniture, and the final price matched the online quote exactly.',
    rating: 5,
    date: '2026-04-12',
  },
  {
    id: 'google-2',
    source: 'google',
    authorName: 'Emma L.',
    body: 'Used ShiftMyHome for a Glasgow flat move. Professional crew, great communication on WhatsApp throughout.',
    rating: 5,
    date: '2026-03-28',
  },
  {
    id: 'google-3',
    source: 'google',
    authorName: 'Andrew K.',
    body: 'Man with van service was brilliant. Sofa and wardrobe moved without a scratch. Would definitely use again.',
    rating: 5,
    date: '2026-02-15',
  },
  {
    id: 'google-4',
    source: 'google',
    authorName: 'Priya S.',
    body: 'Same-week slot for an Edinburgh move. Friendly drivers and very fair pricing compared to other quotes.',
    rating: 5,
    date: '2026-01-20',
  },
  {
    id: 'trustpilot-1',
    source: 'trustpilot',
    authorName: 'Helen M.',
    body: 'Excellent service from booking to completion. Everything was wrapped and handled with care.',
    rating: 5,
    date: '2026-04-05',
  },
  {
    id: 'trustpilot-2',
    source: 'trustpilot',
    authorName: 'Chris B.',
    body: 'Office relocation handled smoothly over a weekend. Minimal disruption and clear updates at every stage.',
    rating: 5,
    date: '2026-03-10',
  },
  {
    id: 'trustpilot-3',
    source: 'trustpilot',
    authorName: 'Laura T.',
    body: 'Trustworthy local company. IKEA furniture collection and delivery was quick and well organised.',
    rating: 5,
    date: '2026-02-22',
  },
  {
    id: 'trustpilot-4',
    source: 'trustpilot',
    authorName: 'Daniel W.',
    body: 'Stress-free house move across Scotland. Crew worked efficiently and nothing was damaged.',
    rating: 4,
    date: '2026-01-08',
  },
]

/**
 * Lazy-load review data when the modal opens.
 * Merges published admin reviews with platform placeholders until APIs are connected.
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

  await new Promise((r) => setTimeout(r, 80))
  return [...customerReviews, ...PLACEHOLDER_REVIEWS].sort((a, b) => b.date.localeCompare(a.date))
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
    const total = REVIEWS_PLATFORM_SUMMARIES.reduce((s, p) => s + p.reviewCount, 0)
    const weighted = REVIEWS_PLATFORM_SUMMARIES.reduce(
      (s, p) => s + p.averageRating * p.reviewCount,
      0,
    )
    return {
      averageRating: total ? weighted / total : 0,
      reviewCount: total,
      label: 'All platforms',
    }
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

  if (tab === 'google' && reviews.length > 0) {
    const platform = reviews.filter((r) => r.source === 'google')
    if (platform.length) {
      const count = platform.length
      const weighted = platform.reduce((s, r) => s + r.rating, 0)
      return {
        averageRating: weighted / count,
        reviewCount: count,
        label: 'Google Reviews',
      }
    }
  }

  if (tab === 'trustpilot' && reviews.length > 0) {
    const platform = reviews.filter((r) => r.source === 'trustpilot')
    if (platform.length) {
      const count = platform.length
      const weighted = platform.reduce((s, r) => s + r.rating, 0)
      return {
        averageRating: weighted / count,
        reviewCount: count,
        label: 'Trustpilot Reviews',
      }
    }
  }

  const platform = REVIEWS_PLATFORM_SUMMARIES.find((p) => p.source === tab)
  return platform
    ? {
        averageRating: platform.averageRating,
        reviewCount: platform.reviewCount,
        label: platform.label,
      }
    : { averageRating: 0, reviewCount: 0, label: '' }
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
