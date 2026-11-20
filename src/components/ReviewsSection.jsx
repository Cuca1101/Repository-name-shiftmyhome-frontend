import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  fetchGoogleBusinessProfile,
  getGoogleBusinessProfileProblem,
} from '../lib/reviews/googleBusinessProfile'

const SPEED_PX_PER_SECOND = 32

function wrapOffset(value, width) {
  if (!width) return 0
  let next = value % width
  if (next > 0) next -= width
  return next
}

function columnsFor(width) {
  if (width >= 960) return 3
  if (width >= 640) return 2
  return 1
}

/** Repeat the real reviews only enough to fill the row, then the carousel duplicates that strip. */
function loopSequence(reviews, columns) {
  if (!reviews.length) return []
  const sequence = []
  const target = Math.max(reviews.length, columns)
  while (sequence.length < target) sequence.push(...reviews)
  return sequence
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return reduced
}

function formatReviewDate(publishedAt, fallbackDate) {
  const source = publishedAt || fallbackDate
  if (!source) return ''
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date)
}

function GoogleMark({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function PreciseStars({ rating }) {
  const value = Number(rating)
  const label = Number.isFinite(value) ? `${value.toFixed(1)} out of 5 stars` : 'No rating'
  return (
    <div className="flex gap-0.5" role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((index) => {
        const amount = Math.min(1, Math.max(0, value - index))
        return (
          <span key={index} className="relative h-5 w-5 shrink-0">
            <Star className="text-slate-200" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${amount * 100}%` }}>
              <Star className="text-amber-400" />
            </span>
          </span>
        )
      })}
    </div>
  )
}

function Star({ className }) {
  return (
    <svg className={`h-5 w-5 ${className}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

function ReviewBody({ text, tabIndex, onReadingChange }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  const expandedRef = useRef(false)
  const onReadingChangeRef = useRef(onReadingChange)
  onReadingChangeRef.current = onReadingChange

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || expanded) return
    setOverflows(node.scrollHeight > node.clientHeight + 1)
  }, [text, expanded])

  useEffect(() => {
    return () => {
      if (expandedRef.current) onReadingChangeRef.current(false)
    }
  }, [])

  return (
    <>
      <p
        ref={ref}
        className={`text-sm leading-relaxed text-slate-700 ${expanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          tabIndex={tabIndex}
          aria-expanded={expanded}
          className="mt-2 self-start text-sm font-semibold text-blue-600 hover:underline"
          onClick={() => {
            setExpanded((open) => {
              const next = !open
              expandedRef.current = next
              onReadingChange(next)
              return next
            })
          }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </>
  )
}

function ReviewCard({ review, loopCopy = false, onReadingChange }) {
  const tabIndex = loopCopy ? -1 : undefined
  const [photoFailed, setPhotoFailed] = useState(false)
  const dateLabel = formatReviewDate(review.publishedAt, review.date)
  const sourceHref = review.reviewUri || review.authorUri || ''

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-center gap-3">
        {review.authorPhoto && !photoFailed ? (
          <img
            src={review.authorPhoto}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setPhotoFailed(true)}
          />
        ) : null}
        <div className="min-w-0">
          {review.authorUri ? (
            <a
              href={review.authorUri}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={tabIndex}
              className="block truncate text-sm font-semibold text-slate-900 hover:underline"
            >
              {review.authorName}
            </a>
          ) : (
            <p className="truncate text-sm font-semibold text-slate-900">{review.authorName}</p>
          )}
          {dateLabel ? <p className="text-xs text-slate-500">{dateLabel}</p> : null}
        </div>
      </div>
      <div className="mt-3">
        <PreciseStars rating={review.rating} />
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <ReviewBody text={review.body} tabIndex={tabIndex} onReadingChange={onReadingChange} />
      </div>
      {sourceHref ? (
        <a
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={tabIndex}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <GoogleMark className="h-3.5 w-3.5" />
          Google
        </a>
      ) : (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <GoogleMark className="h-3.5 w-3.5" />
          Google
        </p>
      )}
    </article>
  )
}

function ReviewSkeleton() {
  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-10 w-32 rounded bg-slate-100" />
          <div className="mt-4 h-5 w-28 rounded bg-slate-100" />
          <div className="mt-4 h-16 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export default function ReviewsSection() {
  const reduced = usePrefersReducedMotion()
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const offsetRef = useRef(0)
  const setWidthRef = useRef(0)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const readingCountRef = useRef(0)

  const [profile, setProfile] = useState(null)
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cardPx, setCardPx] = useState(0)
  const [columns, setColumns] = useState(1)
  const [manualPaused, setManualPaused] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchGoogleBusinessProfile().then((next) => {
      if (cancelled) return
      setProfile(next)
      setProblem(next ? null : getGoogleBusinessProfileProblem())
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reviews = profile?.reviews || []
  const sequence = loopSequence(reviews, columns)
  const paused = reduced || manualPaused || hovering || focused || dragging || reading

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const measure = () => {
      const width = viewport.clientWidth
      const nextColumns = columnsFor(width)
      setColumns(nextColumns)
      setCardPx(width > 0 ? width / nextColumns : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [loading, reviews.length, reduced])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || reduced) return
    const marker = track.querySelector('[data-loop-start]')
    setWidthRef.current = marker ? marker.offsetLeft : 0
    offsetRef.current = wrapOffset(offsetRef.current, setWidthRef.current)
    track.style.transform = `translate3d(${offsetRef.current}px,0,0)`
  }, [cardPx, sequence.length, reduced, loading])

  useEffect(() => {
    if (reduced || paused || cardPx <= 0) return undefined
    let frame = 0
    let last = performance.now()
    const tick = (now) => {
      const width = setWidthRef.current
      const elapsed = Math.min(48, now - last) / 1000
      last = now
      if (width > 0 && !dragRef.current) {
        offsetRef.current = wrapOffset(offsetRef.current - SPEED_PX_PER_SECOND * elapsed, width)
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${offsetRef.current}px,0,0)`
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reduced, paused, cardPx])

  function onReadingChange(open) {
    readingCountRef.current = Math.max(0, readingCountRef.current + (open ? 1 : -1))
    setReading(readingCountRef.current > 0)
  }

  function onPointerDown(event) {
    if (reduced || (event.pointerType === 'mouse' && event.button !== 0)) return
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startOffset: offsetRef.current,
      moved: false,
    }
    setDragging(true)
  }

  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const delta = event.clientX - drag.startX
    if (!drag.moved && Math.abs(delta) < 8) return
    if (!drag.moved) {
      drag.moved = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    offsetRef.current = wrapOffset(drag.startOffset + delta, setWidthRef.current)
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px,0,0)`
    }
  }

  function endDrag(event) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    if (drag.moved) suppressClickRef.current = true
    dragRef.current = null
    setDragging(false)
  }

  function onClickCapture(event) {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function onFocusCapture(event) {
    setFocused(true)
    const slot = event.target.closest?.('[data-review-slot]')
    const viewport = viewportRef.current
    if (!slot || !viewport || reduced) return
    const view = viewport.getBoundingClientRect()
    const rect = slot.getBoundingClientRect()
    if (rect.left < view.left - 1 || rect.right > view.right + 1) {
      offsetRef.current = wrapOffset(offsetRef.current - (rect.left - view.left), setWidthRef.current)
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offsetRef.current}px,0,0)`
      }
    }
  }

  const averageLabel = profile ? profile.rating.toFixed(1) : ''
  const countLabel = profile ? profile.reviewCount.toLocaleString('en-GB') : ''

  return (
    <section id="reviews" className="scroll-mt-[76px] border-y border-slate-200 bg-slate-50 py-12 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">What customers say</h2>
          {profile ? (
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              <span className="font-semibold text-slate-900">{averageLabel}</span>
              {' out of 5 from '}
              <span className="font-semibold text-slate-900">{countLabel}</span>
              {' Google reviews'}
            </p>
          ) : (
            <p className="mt-4 text-base text-slate-600 sm:text-lg">Google reviews for ShiftMyHome.</p>
          )}
          {reviews.length > 0 ? (
            <button
              type="button"
              disabled={reduced}
              aria-pressed={reduced || manualPaused}
              title={reduced ? 'Paused because reduced motion is on' : undefined}
              onClick={() => setManualPaused((value) => !value)}
              className="mt-3 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-default disabled:no-underline"
            >
              {reduced ? 'Paused' : manualPaused ? 'Play reviews' : 'Pause reviews'}
            </button>
          ) : null}
        </div>

        {loading ? <ReviewSkeleton /> : null}

        {!loading && problem ? (
          <p className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm leading-relaxed text-slate-600">
            Google reviews are not connected. {problem.message}
          </p>
        ) : null}

        {!loading && profile && reviews.length === 0 ? (
          <p className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm leading-relaxed text-slate-600">
            Google returned the ShiftMyHome rating
            {averageLabel ? ` of ${averageLabel} from ${countLabel} reviews` : ''}
            , but no review text. Open the profile on Google to read them.
          </p>
        ) : null}

        {!loading && reviews.length > 0 && reduced ? (
          <div className="mt-10 flex snap-x snap-mandatory overflow-x-auto">
            {reviews.map((review) => (
              <div key={review.id} className="w-full shrink-0 snap-start px-2 md:w-1/2 lg:w-1/3">
                <ReviewCard review={review} onReadingChange={onReadingChange} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && reviews.length > 0 && !reduced ? (
          <div
            ref={viewportRef}
            className="mt-10 overflow-x-clip"
            aria-roledescription="carousel"
            aria-label={`Google reviews for ShiftMyHome. Average ${averageLabel} from ${countLabel}.`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocusCapture={onFocusCapture}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            style={{ touchAction: 'pan-y' }}
          >
            {cardPx > 0 ? (
              <div ref={trackRef} className="relative flex w-max items-stretch">
                {sequence.map((review, index) => (
                  <div
                    key={`${review.id}-a-${index}`}
                    data-review-slot
                    className="shrink-0 px-2"
                    style={{ width: cardPx }}
                  >
                    <ReviewCard review={review} onReadingChange={onReadingChange} />
                  </div>
                ))}
                <div className="flex shrink-0 items-stretch" data-loop-start aria-hidden="true">
                  {sequence.map((review, index) => (
                    <div
                      key={`${review.id}-b-${index}`}
                      className="shrink-0 px-2"
                      style={{ width: cardPx }}
                    >
                      <ReviewCard review={review} loopCopy onReadingChange={onReadingChange} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-56" aria-hidden />
            )}
          </div>
        ) : null}

        {profile?.mapsUri ? (
          <p className="mt-6 text-center">
            <a
              href={profile.mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <GoogleMark />
              See all {countLabel} reviews on Google
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
