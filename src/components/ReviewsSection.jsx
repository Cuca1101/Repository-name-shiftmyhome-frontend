import { useEffect, useState } from 'react'
import { fetchPublicDisplayReviews } from '../lib/data/reviewsRepository'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import { DEFAULT_REVIEWS } from '../lib/websiteCmsDefaults'

function Stars({ count = 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${i <= count ? 'text-amber-400' : 'text-slate-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function formatReviewDate(isoDate) {
  if (!isoDate) return null
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return null
  }
}

function mapCmsReviews(cmsReviews) {
  return cmsReviews
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      id: r.id || `${r.author_name}-${r.body?.slice(0, 12)}`,
      author_name: r.author_name,
      body: r.body,
      stars: r.stars ?? 5,
      avatar_url: r.avatar_url ?? null,
      created_at: r.created_at ?? null,
    }))
}

function mapDefaultReviews() {
  return DEFAULT_REVIEWS.map((r) => ({
    id: r.id,
    author_name: r.author_name,
    body: r.body,
    stars: r.stars ?? 5,
    avatar_url: r.avatar_url ?? null,
    created_at: null,
  }))
}

export default function ReviewsSection() {
  const { reviews: cmsReviews, hasCmsReviews } = useWebsiteCms()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromAdmin, setFromAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const adminReviews = await fetchPublicDisplayReviews()
        if (cancelled) return

        if (adminReviews.length > 0) {
          setReviews(adminReviews)
          setFromAdmin(true)
          return
        }

        if (hasCmsReviews) {
          setReviews(mapCmsReviews(cmsReviews))
          setFromAdmin(false)
          return
        }

        setReviews(mapDefaultReviews())
        setFromAdmin(false)
      } catch {
        if (cancelled) return
        if (hasCmsReviews) {
          setReviews(mapCmsReviews(cmsReviews))
        } else {
          setReviews(mapDefaultReviews())
        }
        setFromAdmin(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hasCmsReviews, cmsReviews])

  return (
    <section id="reviews" className="scroll-mt-[76px] border-y border-slate-200 bg-slate-50 py-12 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">What customers say</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Real feedback from recent moves across Glasgow and beyond.
            {fromAdmin && <span className="sr-only"> Reviews loaded from admin.</span>}
          </p>
        </div>

        {loading ? (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
                aria-hidden
              >
                <div className="h-5 w-28 rounded bg-slate-100" />
                <div className="mt-4 h-16 w-full rounded bg-slate-100" />
                <div className="mt-4 h-4 w-24 rounded bg-slate-100" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map(({ id, author_name, body, stars, avatar_url, created_at }) => {
              const dateLabel = formatReviewDate(created_at)
              return (
                <li
                  key={id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
                >
                  {avatar_url ? (
                    <img src={avatar_url} alt="" className="mb-3 h-10 w-10 rounded-full object-cover" />
                  ) : null}
                  <Stars count={stars} />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{body}&rdquo;</p>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{author_name}</p>
                    {dateLabel ? <p className="text-xs text-slate-500">{dateLabel}</p> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && reviews.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
            Customer reviews will appear here once published in admin.
          </p>
        ) : null}
      </div>
    </section>
  )
}
