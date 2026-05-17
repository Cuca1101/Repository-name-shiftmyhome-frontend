import { useEffect, useState } from 'react'
import { fetchPublishedReviews } from '../lib/data/reviewsRepository'
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

export default function ReviewsSection() {
  const { reviews: cmsReviews, hasCmsReviews } = useWebsiteCms()
  const [reviews, setReviews] = useState(DEFAULT_REVIEWS)
  const [fromDb, setFromDb] = useState(false)

  useEffect(() => {
    if (hasCmsReviews) {
      setReviews(
        cmsReviews.map((r) => ({
          author_name: r.author_name,
          body: r.body,
          stars: r.stars ?? 5,
          avatar_url: r.avatar_url,
        })),
      )
      setFromDb(true)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchPublishedReviews()
        if (cancelled || !rows?.length) return
        setReviews(
          rows.map((r) => ({
            author_name: r.author_name,
            body: r.body,
            stars: r.rating ?? 5,
            avatar_url: null,
          })),
        )
        setFromDb(true)
      } catch {
        setReviews(DEFAULT_REVIEWS)
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
            {fromDb && <span className="sr-only"> Reviews loaded from the database.</span>}
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map(({ author_name, body, stars, avatar_url }) => (
            <li
              key={`${author_name}-${body.slice(0, 24)}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              {avatar_url ? (
                <img src={avatar_url} alt="" className="mb-3 h-10 w-10 rounded-full object-cover" />
              ) : null}
              <Stars count={stars} />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{body}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">{author_name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
