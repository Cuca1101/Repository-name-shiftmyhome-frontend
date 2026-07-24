import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import QuoteWizard from '../quote-wizard/QuoteWizard'
import { preloadStripeJs } from '../../lib/stripePromise'
import { resolveServiceLabel } from '../../lib/normalizeServiceType'

/**
 * Full-screen quote flow overlay for SEO landing pages — same QuoteWizard as homepage /quote.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   serviceType?: string,
 *   sessionKey?: number,
 * }} props
 */
export default function SeoQuoteWizardModal({ open, onClose, serviceType = '', sessionKey = 0 }) {
  const resolvedServiceType = resolveServiceLabel(serviceType)
  useEffect(() => {
    if (!open) return
    preloadStripeJs()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const modal = (
    <div
      id="seo-quote"
      className="quote-flow-layout fixed inset-0 z-[220] flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50"
      data-quote-flow
      role="dialog"
      aria-modal="true"
      aria-labelledby="seo-quote-flow-title"
    >
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-3 sm:px-6 sm:py-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[36px] items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-brand-700 sm:min-h-[44px] sm:text-sm"
        >
          <span aria-hidden>←</span> Back to page
        </button>
        <h1
          id="seo-quote-flow-title"
          className="mt-1.5 text-xl font-extrabold tracking-tight text-navy sm:mt-2 sm:text-3xl"
        >
          Get your instant quote
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600 sm:text-base">
          Four quick steps — your price appears when you review and submit.
        </p>
      </div>

      <div className="quote-flow-main quote-flow-scope min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-0">
        <QuoteWizard
          key={sessionKey}
          serviceType={resolvedServiceType}
          allowServiceChange
          servicePreSelected={Boolean(resolvedServiceType)}
        />
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
