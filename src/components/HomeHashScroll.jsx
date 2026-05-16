import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * When the URL is `/` with a hash (e.g. after client navigation from another route),
 * scroll the matching element into view after the main content mounts.
 */
export default function HomeHashScroll() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (location.pathname !== '/') return
    const id = location.hash?.replace(/^#/, '').trim()
    if (!id) return

    const run = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    return () => cancelAnimationFrame(raf)
  }, [location.pathname, location.hash])

  return null
}
