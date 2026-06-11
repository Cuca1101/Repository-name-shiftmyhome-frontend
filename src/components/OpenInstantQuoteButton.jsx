import { Link, useLocation } from 'react-router-dom'
import { useSeoQuoteModal } from '../context/SeoQuoteModalContext'
import { markNewQuoteFromServiceCard } from '../lib/quoteSessionMode'
import { trackWebsiteClick, trackWebsiteLeadEvent } from '../lib/websiteLeadTracker'

/**
 * Opens the SEO-style quote modal when available; otherwise links to /quote.
 *
 * @param {{
 *   className?: string,
 *   children: import('react').ReactNode,
 *   serviceType?: string,
 *   trackLabel?: string,
 *   trackSection?: string,
 *   onNavigate?: () => void,
 * }} props
 */
export default function OpenInstantQuoteButton({
  className,
  children,
  serviceType = '',
  trackLabel = 'Get instant quote',
  trackSection = 'cta',
  onNavigate,
}) {
  const { pathname } = useLocation()
  const { openQuote, hasModal } = useSeoQuoteModal()

  if (hasModal) {
    return (
      <button
        type="button"
        className={className}
        data-track-click={trackLabel}
        data-track-section={trackSection}
        onClick={() => {
          onNavigate?.()
          const resolvedService = String(serviceType || '').trim()
          if (resolvedService) {
            markNewQuoteFromServiceCard(resolvedService, pathname || '/')
            trackWebsiteLeadEvent('new_quote_from_service', {
              serviceType: resolvedService,
              returnPath: pathname || '/',
            })
          }
          void trackWebsiteClick(trackLabel, {
            href: '#seo-quote',
            section: trackSection,
            serviceType: resolvedService || undefined,
          })
          openQuote(resolvedService || undefined)
        }}
      >
        {children}
      </button>
    )
  }

  const href = serviceType
    ? `/quote?service=${encodeURIComponent(serviceType)}`
    : '/quote'

  return (
    <Link
      to={href}
      className={className}
      data-track-click={trackLabel}
      data-track-section={trackSection}
      onClick={() => {
        onNavigate?.()
        if (serviceType) {
          markNewQuoteFromServiceCard(serviceType, pathname || '/')
        }
      }}
    >
      {children}
    </Link>
  )
}
