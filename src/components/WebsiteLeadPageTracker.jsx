import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView, trackWebsiteClick } from '../lib/websiteLeadTracker'

function isAdminPath(pathname) {
  return pathname.startsWith('/admin')
}

/**
 * @param {string} href
 */
function inferClickFromHref(href) {
  const h = (href || '').trim()
  if (!h) return null
  if (h.startsWith('tel:')) return { label: 'Phone', section: 'contact' }
  if (h.includes('wa.me') || h.includes('whatsapp')) return { label: 'WhatsApp', section: 'contact' }
  if (h.startsWith('mailto:')) return { label: 'Email', section: 'contact' }
  return null
}

/**
 * Global public-site tracking: page views on route change + delegated link clicks.
 */
export default function WebsiteLeadPageTracker() {
  const { pathname } = useLocation()
  const lastPathRef = useRef('')

  useEffect(() => {
    if (!pathname || isAdminPath(pathname)) return
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname
    void trackPageView(pathname)
  }, [pathname])

  useEffect(() => {
    if (isAdminPath(pathname)) return undefined

    /** @param {MouseEvent} e */
    function onDocumentClick(e) {
      if (isAdminPath(window.location.pathname)) return
      const target = e.target
      if (!(target instanceof Element)) return

      const tracked = target.closest('[data-track-click]')
      if (tracked instanceof HTMLElement) {
        const label = tracked.getAttribute('data-track-click') || 'Click'
        const section = tracked.getAttribute('data-track-section') || undefined
        const href =
          tracked instanceof HTMLAnchorElement
            ? tracked.getAttribute('href')
            : tracked.querySelector('a')?.getAttribute('href')
        void trackWebsiteClick(label, { href: href || undefined, section })
        return
      }

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return

      const href = anchor.getAttribute('href') || ''
      const inferred = inferClickFromHref(href)
      if (inferred) {
        void trackWebsiteClick(inferred.label, { href, section: inferred.section })
        return
      }

      const footer = anchor.closest('footer')
      if (footer) {
        const text = (anchor.textContent || '').trim().slice(0, 80)
        if (text) {
          void trackWebsiteClick(`Footer: ${text}`, { href, section: 'footer' })
        }
        return
      }

      const nav = anchor.closest('header, nav')
      if (nav) {
        const text = (anchor.textContent || '').trim().slice(0, 80)
        if (text) {
          void trackWebsiteClick(`Nav: ${text}`, { href, section: 'nav' })
        }
      }
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [pathname])

  return null
}
