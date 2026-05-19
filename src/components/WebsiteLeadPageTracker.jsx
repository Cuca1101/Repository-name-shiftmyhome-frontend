import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackWebsiteLeadEvent } from '../lib/websiteLeadTracker'

/**
 * Anonymous page_view tracking for public routes (admin excluded).
 */
export default function WebsiteLeadPageTracker() {
  const { pathname } = useLocation()
  const lastPathRef = useRef('')

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname
    void trackWebsiteLeadEvent('page_view', { returnPath: pathname })
  }, [pathname])

  return null
}
