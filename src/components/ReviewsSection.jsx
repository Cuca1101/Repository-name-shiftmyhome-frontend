import { useEffect, useState } from 'react'
import { fetchPublishedReviews } from '../lib/data/reviewsRepository'

const fallbackReviews = [
  {
    author_name: 'James',
    body: 'Brilliant service from start to finish. Arrived on time, nothing scratched, and the price matched the quote. Would use again.',
  },
  {
    author_name: 'Sarah',
    body: 'Needed a sofa and beds moved at short notice. ShiftMyHome sorted same-week slots and were really careful with our narrow staircase.',
  },
  {
    author_name: 'David',
    body: 'Clear communication on WhatsApp, fair price for a full flat move. Crew were friendly and worked fast. Highly recommend.',
  },
]

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState(fallbackReviews)
  const [fromDb, setFromDb] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchPublishedReviews()
        if (cancelled || !rows?.length) return
        setReviews(
          rows.map((r) => ({
            author_name: r.author_name,
            body: r.body,
          })),
        )
        setFromDb(true)
      } catch {
        /* keep fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="reviews" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What customers say</h2>
          <p className="mt-4 text-lg text-slate-600">
            Real feedback from recent moves across Glasgow and beyond.
            {fromDb && (
              <span className="sr-only"> Reviews loaded from the database.</span>
            )}
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map(({ author_name, body }) => (
            <li
              key={`${author_name}-${body.slice(0, 24)}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <Stars />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{body}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">{author_name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
