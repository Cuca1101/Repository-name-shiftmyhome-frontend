import { Link, useLocation } from 'react-router-dom'
import HomeSectionLink from './HomeSectionLink'
import { getSeoPageByPath } from '../data/seoPages'
import { getServicePageByPath } from '../constants/servicePages'
import { normalizePublicPath } from '../lib/normalizePublicPath'

/**
 * Navbar / drawer quote CTA — homepage scrolls to services; SEO pages open the quote wizard modal.
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

  if (isSeoLanding) {
    return (
      <Link
        to={{ pathname: routePath, search: location.search, hash: '#seo-quote' }}
        replace
        className={className}
        data-track-click={trackLabel || 'Nav: seo quote'}
        data-track-section="nav"
        onClick={() => onNavigate?.()}
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
        onClick={() => onNavigate?.()}
      >
        {children}
      </a>
    )
  }

  return (
    <HomeSectionLink
      sectionId="services"
      className={className}
      onNavigate={onNavigate}
      trackLabel={trackLabel}
    >
      {children}
    </HomeSectionLink>
  )
}
