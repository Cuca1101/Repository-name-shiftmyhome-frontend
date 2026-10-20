import { useEffect, useState } from 'react'

/** Keep Get a Quote mobile layout through tablet; desktop from Tailwind `lg` (1024px). */
export const QUOTE_MOBILE_LAYOUT_MAX_PX = 1023
export const QUOTE_MOBILE_LAYOUT_MQ = `(max-width: ${QUOTE_MOBILE_LAYOUT_MAX_PX}px)`
/** Tablet only: two columns, still below the desktop quote layout. */
export const QUOTE_TABLET_LAYOUT_MQ = '(min-width: 768px) and (max-width: 1023px)'
/** Step 2 column layout starts here and stays through laptop and desktop. */
export const QUOTE_FROM_TABLET_MQ = '(min-width: 768px)'

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

function tabletInitial() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUOTE_TABLET_LAYOUT_MQ).matches
}

/** True only from 768px through 1023px. */
export function useTabletQuoteLayout() {
  const [isTablet, setIsTablet] = useState(tabletInitial)

  useEffect(() => {
    const mq = window.matchMedia(QUOTE_TABLET_LAYOUT_MQ)
    const onChange = () => setIsTablet(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isTablet
}

function fromTabletInitial() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUOTE_FROM_TABLET_MQ).matches
}

/** True from 768px upward, including laptop and desktop. */
export function useFromTabletQuoteLayout() {
  const [fromTablet, setFromTablet] = useState(fromTabletInitial)

  useEffect(() => {
    const mq = window.matchMedia(QUOTE_FROM_TABLET_MQ)
    const onChange = () => setFromTablet(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return fromTablet
}
