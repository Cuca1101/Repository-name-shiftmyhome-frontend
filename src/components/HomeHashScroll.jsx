import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * When the URL includes a hash on supported routes (e.g. `/#services` or `/coverage#scotland-coverage`),
 * scroll the matching element into view after the main content mounts.
 */
export default function HomeHashScroll() {
  const location = useLocation()

  useLayoutEffect(() => {
    const supportsHashScroll = location.pathname === '/' || location.pathname === '/coverage'
    if (!supportsHashScroll) return undefined
    const id = location.hash?.replace(/^#/, '').trim()
    if (!id) return undefined

    let cancelled = false
    let timeoutId

    const scrollToId = () => {
      const matches = document.querySelectorAll(`#${CSS.escape(id)}`)
      if (!matches.length) return false
      const el =
        Array.from(matches).find((node) => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }) ?? matches[0]
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
