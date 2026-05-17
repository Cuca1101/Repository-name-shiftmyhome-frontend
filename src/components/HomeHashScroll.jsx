import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * When the URL is `/` with a hash (e.g. after client navigation from another route),
 * scroll the matching element into view after the main content mounts.
 */
export default function HomeHashScroll() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (location.pathname !== '/') return undefined
    const id = location.hash?.replace(/^#/, '').trim()
    if (!id) return undefined

    let cancelled = false
    let timeoutId

    const scrollToId = () => {
      const el = document.getElementById(id)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }

    const tryScroll = (attempt = 0) => {
      if (cancelled) return
      if (scrollToId()) return
      if (attempt < 12) {
        timeoutId = window.setTimeout(() => tryScroll(attempt + 1), 50)
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => tryScroll(0))
    })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [location.pathname, location.hash])

  return null
}
