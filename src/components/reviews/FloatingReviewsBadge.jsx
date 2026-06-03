import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import ReviewStars from './ReviewStars'
import {
  dismissReviewsBadge,
  isReviewsBadgeDismissed,
  REVIEWS_PLATFORM_SUMMARIES,
} from '../../lib/reviews/externalReviews'

const ReviewsDrawer = lazy(() => import('./ReviewsDrawer'))

const googleSummary = REVIEWS_PLATFORM_SUMMARIES.find((p) => p.source === 'google')

/**
 * @param {{ variant?: 'default' | 'quote-flow' }} props
 */
export default function FloatingReviewsBadge({ variant = 'default' }) {
  const { pathname } = useLocation()
  const quoteFlow = variant === 'quote-flow'
  const [hidden, setHidden] = useState(false)
  const [ready, setReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setHidden(isReviewsBadgeDismissed())
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (pathname.startsWith('/admin')) return null
  if (hidden) return null

  const handleDismiss = (e) => {
    e.stopPropagation()
    dismissReviewsBadge()
    setHidden(true)
  }

  const bottomClass = quoteFlow
    ? 'bottom-[max(5.5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:bottom-8'
    : 'bottom-[max(6.5rem,calc(6rem+env(safe-area-inset-bottom,0px)))] sm:bottom-8'

  const rating = googleSummary?.averageRating ?? 4.9
  const reviewCount = googleSummary?.reviewCount ?? 127

  const badge = (
    <>
      <div
        className={`fixed left-[max(0.75rem,env(safe-area-inset-left,0px))] z-[135] sm:left-8 ${bottomClass} transition-all duration-500 ease-premium ${
          ready ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-[7.75rem] flex-col rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-[0_10px_32px_-8px_rgba(0,13,38,0.28)] ring-1 ring-navy/5 transition hover:border-brand-200 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-label={`${rating} stars, ${reviewCount} Google reviews. Open reviews.`}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="#00B67A" aria-hidden>
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
            </div>

            <span className="text-[1.65rem] font-bold leading-none text-slate-900">{rating.toFixed(1)}</span>
            <ReviewStars rating={rating} size="sm" className="mt-1.5" />
            <span className="mt-1.5 text-xs font-medium text-slate-600">
              {reviewCount.toLocaleString('en-GB')} reviews
            </span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Dismiss reviews badge for 30 days"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {drawerOpen ? (
        <Suspense fallback={null}>
          <ReviewsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )

  if (typeof document === 'undefined') return badge
  return createPortal(badge, document.body)
}
