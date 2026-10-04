import { useEffect, useState } from 'react'

/** Keep Get a Quote mobile layout through tablet; desktop from Tailwind `lg` (1024px). */
export const QUOTE_MOBILE_LAYOUT_MAX_PX = 1023
export const QUOTE_MOBILE_LAYOUT_MQ = `(max-width: ${QUOTE_MOBILE_LAYOUT_MAX_PX}px)`

function getInitial() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUOTE_MOBILE_LAYOUT_MQ).matches
}

/** Match quote wizard mobile layout breakpoint (through tablet / below `lg`). */
export default function useMobileQuoteLayout() {
  const [isMobile, setIsMobile] = useState(getInitial)

  useEffect(() => {
    const mq = window.matchMedia(QUOTE_MOBILE_LAYOUT_MQ)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
