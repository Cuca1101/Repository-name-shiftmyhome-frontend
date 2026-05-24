import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  hasAnalyticsConsent,
  hasMarketingConsent,
  needsCookieConsentChoice,
} from '../lib/cookieConsent.js'
import {
  isGaConfigured,
  isMetaPixelConfigured,
  subscribeMarketingConsentChanges,
  syncMarketingPixels,
  trackMarketingPageView,
  trackMarketingQuoteClick,
} from '../lib/marketingPixels.js'

function isAdminPath(pathname) {
  return pathname.startsWith('/admin')
}

/**
 * @param {HTMLAnchorElement} anchor
 */
function isQuoteButtonClick(anchor) {
  if (anchor.closest('[data-track-quote]')) return true

  const href = (anchor.getAttribute('href') || '').trim().toLowerCase()
  if (!href) return false
  if (href === '/quote' || href.startsWith('/quote?')) return true
  if (href.includes('#quote') || href.includes('#seo-quote')) return true

  const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
  return /(get|start|request|book)\s+(an?\s+)?(instant\s+)?(free\s+)?quote|free quote|instant quote/.test(text)
}

/**
 * Loads GA4 / Meta Pixel on public routes after cookie consent and tracks SPA page views + quote CTA clicks.
 */
export default function PublicMarketingTracker() {
  const { pathname, search } = useLocation()
  const lastTrackedPathRef = useRef('')

  useEffect(() => {
    if (isAdminPath(pathname)) return undefined

    syncMarketingPixels()
    return subscribeMarketingConsentChanges(() => {
      syncMarketingPixels()
    })
  }, [pathname])

  useEffect(() => {
    if (isAdminPath(pathname)) return
    if (needsCookieConsentChoice()) return
    if (!hasAnalyticsConsent() && !hasMarketingConsent()) return
    if (!isGaConfigured() && !isMetaPixelConfigured()) return

    const fullPath = `${pathname}${search || ''}`
    if (lastTrackedPathRef.current === fullPath) return
    lastTrackedPathRef.current = fullPath
    trackMarketingPageView(pathname, search)
  }, [pathname, search])

  useEffect(() => {
    if (isAdminPath(pathname)) return undefined

    /** @param {MouseEvent} event */
    function onDocumentClick(event) {
      if (isAdminPath(window.location.pathname)) return
      if (needsCookieConsentChoice()) return
      if (!hasAnalyticsConsent() && !hasMarketingConsent()) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href], button')
      if (!anchor) return

      if (anchor instanceof HTMLAnchorElement && isQuoteButtonClick(anchor)) {
        trackMarketingQuoteClick({
          source: anchor.getAttribute('data-track-quote') || 'quote_button',
          href: anchor.getAttribute('href') || undefined,
        })
        return
      }

      if (anchor instanceof HTMLButtonElement) {
        const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
        if (/(get|start|request|book)\s+(an?\s+)?(instant\s+)?(free\s+)?quote|free quote|instant quote/.test(text)) {
          trackMarketingQuoteClick({ source: 'quote_button', href: window.location.pathname })
        }
      }
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [pathname])

  return null
}
