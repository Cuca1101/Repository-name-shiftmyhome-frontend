import { Link, useLocation } from 'react-router-dom'
import HomeSectionLink from './HomeSectionLink'
import { useSeoQuoteModal } from '../context/SeoQuoteModalContext'
import { getSeoPageByPath } from '../data/seoPages'
import { getServicePageByPath } from '../constants/servicePages'
import { normalizePublicPath } from '../lib/normalizePublicPath'
import { pathUsesDedicatedQuotePage } from '../lib/quoteModalRoutes'
import { startFreshPublicQuote } from '../lib/quoteSessionMode'

/**
 * Navbar / drawer quote CTA — opens quote modal on homepage & general pages;
 * SEO pages use hash link; service pages scroll to embedded wizard.
 *
 * @param {{
 *   className?: string,
 *   children: import('react').ReactNode,
 *   onNavigate?: () => void,
 *   trackLabel?: string,
 * }} props
 */
export default function QuoteNavCta({ className, children, onNavigate, trackLabel }) {
  const location = useLocation()
  const routePath = normalizePublicPath(location.pathname)
  const isSeoLanding = Boolean(getSeoPageByPath(routePath))
  const isServiceQuote = Boolean(getServicePageByPath(routePath))
  const { openQuote, hasModal } = useSeoQuoteModal()

  if (pathUsesDedicatedQuotePage(routePath)) {
    return (
      <button
        type="button"
        className={className}
        data-track-click={trackLabel || 'Nav: Get a Quote'}
        data-track-section="nav"
        onClick={() => {
          onNavigate?.()
          startFreshPublicQuote('', routePath)
          document.querySelector('[data-quote-flow]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      >
        {children}
      </button>
    )
  }

  if (isSeoLanding) {
    return (
      <Link
        to={{ pathname: routePath, search: location.search, hash: '#seo-quote' }}
        replace
        className={className}
        data-track-click={trackLabel || 'Nav: seo quote'}
        data-track-section="nav"
        onClick={() => {
          startFreshPublicQuote('', routePath)
          onNavigate?.()
        }}
      >
        {children}
      </Link>
    )
  }

  if (isServiceQuote) {
    return (
      <a
        href="#service-quote"
        className={className}
        data-track-click={trackLabel || 'Nav: service quote'}
        data-track-section="nav"
        onClick={() => {
          startFreshPublicQuote('', routePath)
          onNavigate?.()
        }}
      >
        {children}
      </a>
    )
  }

  if (hasModal) {
    return (
      <button
        type="button"
        className={className}
        data-track-click={trackLabel || 'Nav: instant quote modal'}
        data-track-section="nav"
        onClick={() => {
          onNavigate?.()
          startFreshPublicQuote('', routePath)
          openQuote()
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <HomeSectionLink
      sectionId="services"
      className={className}
      onNavigate={() => {
        startFreshPublicQuote('', routePath)
        onNavigate?.()
      }}
      trackLabel={trackLabel}
    >
      {children}
    </HomeSectionLink>
  )
}
