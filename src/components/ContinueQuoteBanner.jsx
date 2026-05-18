import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, X } from 'lucide-react'
import {
  clearQuoteDraft,
  loadQuoteDraft,
  pathForServiceType,
} from '../lib/quoteDraftStorage'
import {
  dismissQuoteBannerForSession,
  isQuoteBannerDismissed,
  markNewQuoteFromServiceCard,
  markResumeSavedQuote,
} from '../lib/quoteSessionMode'
import { trackWebsiteLeadEvent } from '../lib/websiteLeadTracker'

/**
 * Compact homepage reminder when an incomplete quote draft exists in localStorage.
 */
export default function ContinueQuoteBanner() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => loadQuoteDraft())
  const [dismissed, setDismissed] = useState(() => isQuoteBannerDismissed())

  const refresh = useCallback(() => {
    setDraft(loadQuoteDraft())
    setDismissed(isQuoteBannerDismissed())
  }, [])

  useEffect(() => {
    window.addEventListener('shiftmyhome-quote-draft', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('shiftmyhome-quote-draft', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  if (!draft || dismissed) return null

  const continuePath =
    draft.returnPath && draft.returnPath !== '/'
      ? draft.returnPath
      : pathForServiceType(draft.serviceType)

  function handleDismiss() {
    dismissQuoteBannerForSession()
    setDismissed(true)
  }

  function handleContinue() {
    markResumeSavedQuote()
    trackWebsiteLeadEvent('saved_quote_resumed', {
      quoteRef: draft.quoteRef,
      serviceType: draft.serviceType,
      returnPath: continuePath,
    })
    navigate(continuePath)
    requestAnimationFrame(() => {
      document.querySelector('#quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleStartNew(e) {
    e.preventDefault()
    clearQuoteDraft()
    markNewQuoteFromServiceCard('', '/quote')
    trackWebsiteLeadEvent('new_quote_started', {
      source: 'start_new_link',
      serviceType: '',
    })
    navigate('/quote')
    requestAnimationFrame(() => {
      document.querySelector('#quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="home-container min-w-0 px-4 pb-0.5 pt-2 sm:px-6 sm:pt-3 lg:px-8">
      <div className="relative flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm sm:gap-3 sm:px-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss saved quote reminder"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
          aria-hidden
        >
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 pr-7">
          <p className="text-[13px] font-semibold leading-tight text-slate-900">Continue your saved quote</p>
          <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-600">
            Reference:{' '}
            <span className="font-mono font-semibold text-slate-800">{draft.quoteRef || '—'}</span>
          </p>
          <button
            type="button"
            onClick={handleStartNew}
            className="mt-1 text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            Start new quote
          </button>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
