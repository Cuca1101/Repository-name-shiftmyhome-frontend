import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import {
  QUOTE_STEP2_TRANSITION_DURATION_MS,
  QUOTE_STEP2_TRANSITION_HEADLINE,
  QUOTE_STEP2_TRANSITION_MESSAGES,
  QUOTE_STEP2_TRANSITION_ROTATE_MS,
} from '../../lib/quoteStep2Transition'

/**
 * Shown on Step 2 after validation while transitioning to Step 3 (visual only — no extra pricing calls).
 */
export default function QuoteStep2TransitionLoading() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % QUOTE_STEP2_TRANSITION_MESSAGES.length)
    }, QUOTE_STEP2_TRANSITION_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  const rotatingMessage = QUOTE_STEP2_TRANSITION_MESSAGES[messageIndex]

  return createPortal(
    <div
      id="quote-step2-transition"
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto overscroll-y-contain bg-slate-900/25 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={QUOTE_STEP2_TRANSITION_HEADLINE}
    >
      <div className="mx-auto my-auto w-full max-w-md max-h-[min(90dvh,100%)] shrink-0 rounded-2xl border border-slate-200/90 bg-white px-4 py-5 text-center shadow-lg ring-1 ring-slate-100/80 sm:px-5 sm:py-6 md:px-6 md:py-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2.25} aria-hidden />
        </div>
        <p className="mt-4 text-base font-bold text-slate-900 md:text-lg">
          {QUOTE_STEP2_TRANSITION_HEADLINE}
        </p>
        <p
          key={messageIndex}
          className="mt-3 min-h-[2.75rem] break-words px-0.5 text-sm leading-snug text-slate-700 sm:min-h-[3.25rem] md:min-h-[3.5rem] md:text-base"
        >
          <span className="mr-1" aria-hidden>
            ✅
          </span>
          {rotatingMessage}
        </p>
        <div
          className="mx-auto mt-4 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-slate-100"
          aria-hidden
        >
          <div
            className="quote-step2-progress-bar h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500"
            style={{ animationDuration: `${QUOTE_STEP2_TRANSITION_DURATION_MS}ms` }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
