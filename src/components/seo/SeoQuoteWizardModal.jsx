import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Navbar from '../Navbar'
import QuoteWizard from '../quote-wizard/QuoteWizard'
import WhatsAppButton from '../WhatsAppButton'
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
      className="quote-flow-layout quote-page-shell fixed inset-0 z-[220] flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#e7eef6]"
      data-quote-flow
      role="dialog"
      aria-modal="true"
      aria-labelledby="seo-quote-flow-title"
    >
      <div className="shrink-0">
        <Navbar showSlogan onLogoClick={onClose} />
        <div className="bg-[#e7eef6] px-3 pt-1.5 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <span aria-hidden>←</span> Back to page
          </button>
        </div>
      </div>

      <div className="quote-flow-main quote-page-shell min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-24 pt-1 sm:px-4 sm:pb-8">
        <QuoteWizard
          key={sessionKey}
          serviceType={resolvedServiceType}
          allowServiceChange
          servicePreSelected={Boolean(resolvedServiceType)}
          pageChrome
          showStep1Back={false}
          titleId="seo-quote-flow-title"
        />
      </div>
      <WhatsAppButton variant="quote-flow" />
    </div>
  )

  if (typeof document === 'undefined') return modal
  return createPortal(modal, document.body)
}
