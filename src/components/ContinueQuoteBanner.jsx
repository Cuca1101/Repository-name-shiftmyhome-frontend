import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearQuoteDraft,
  loadQuoteDraft,
  pathForServiceType,
} from '../lib/quoteDraftStorage'

/**
 * Home page banner when an incomplete quote draft exists in localStorage.
 */
export default function ContinueQuoteBanner() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => loadQuoteDraft())

  const refresh = useCallback(() => {
    setDraft(loadQuoteDraft())
  }, [])

  useEffect(() => {
    window.addEventListener('shiftmyhome-quote-draft', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('shiftmyhome-quote-draft', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  if (!draft) return null

  const continuePath =
    draft.returnPath && draft.returnPath !== '/'
      ? draft.returnPath
      : pathForServiceType(draft.serviceType)

  function handleContinue() {
    navigate(continuePath)
    requestAnimationFrame(() => {
      document.querySelector('#quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleStartNew() {
    clearQuoteDraft()
    refresh()
    navigate('/quote')
  }

  return (
    <div className="home-container min-w-0 px-4 pb-1 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-brand-200/80 bg-white p-3 shadow-sm ring-1 ring-brand-100/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Continue your quote</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">
            You have a saved quote in progress
            {draft.quoteRef ? (
              <>
                {' '}
                (<span className="font-mono font-semibold text-brand-800">{draft.quoteRef}</span>
                {draft.estimatedTotal != null ? (
                  <span>
                    {' '}
                    · est. £{draft.estimatedTotal.toFixed(2)}
                  </span>
                ) : null}
                ).
              </>
            ) : (
              '.'
            )}
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-col gap-2 xs:flex-row sm:flex-col md:flex-row">
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-[44px] rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Continue quote
          </button>
          <button
            type="button"
            onClick={handleStartNew}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Start new quote
          </button>
        </div>
      </div>
    </div>
  )
}
