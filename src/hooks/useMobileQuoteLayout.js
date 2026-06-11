import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

function getInitial() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches
}

/** Match quote wizard mobile layout breakpoint (Tailwind md). */
export default function useMobileQuoteLayout() {
  const [isMobile, setIsMobile] = useState(getInitial)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
