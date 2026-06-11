import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SeoQuoteWizardModal from '../components/seo/SeoQuoteWizardModal'

/** @type {import('react').Context<{ openQuote: () => void } | null>} */
const SeoQuoteModalContext = createContext(null)

const SEO_QUOTE_HASH = '#seo-quote'

/**
 * Quote wizard modal for SEO landing pages — opens step-by-step flow on CTA click.
 *
 * @param {{ children: import('react').ReactNode, defaultServiceType?: string }} props
 */
export function SeoQuoteModalProvider({ children, defaultServiceType = '' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [activeServiceType, setActiveServiceType] = useState(defaultServiceType)

  const syncHash = useCallback(
    (hash) => {
      navigate(
        { pathname: location.pathname, search: location.search, hash: hash || undefined },
        { replace: true },
      )
    },
    [location.pathname, location.search, navigate],
  )

  const openQuote = useCallback(
    (serviceTypeOverride) => {
      const nextService =
        serviceTypeOverride !== undefined && serviceTypeOverride !== null
          ? String(serviceTypeOverride).trim()
          : defaultServiceType
      setActiveServiceType(nextService)

      if (location.hash === SEO_QUOTE_HASH) {
        setSessionKey((k) => k + 1)
        setOpen(true)
        return
      }
      syncHash(SEO_QUOTE_HASH)
    },
    [defaultServiceType, location.hash, syncHash],
  )

  const closeQuote = useCallback(() => {
    setOpen(false)
    if (location.hash === SEO_QUOTE_HASH) {
      syncHash('')
    }
  }, [location.hash, syncHash])

  useEffect(() => {
    setActiveServiceType(defaultServiceType)
  }, [defaultServiceType, location.pathname])

  useEffect(() => {
    if (location.hash === SEO_QUOTE_HASH) {
      setSessionKey((k) => k + 1)
      setOpen(true)
      return
    }
    setOpen(false)
  }, [location.pathname, location.hash])

  const value = useMemo(() => ({ openQuote }), [openQuote])

  return (
    <SeoQuoteModalContext.Provider value={value}>
      {children}
      <SeoQuoteWizardModal
        open={open}
        onClose={closeQuote}
        serviceType={activeServiceType}
        sessionKey={sessionKey}
      />
    </SeoQuoteModalContext.Provider>
  )
}

export function useSeoQuoteModal() {
  const ctx = useContext(SeoQuoteModalContext)
  if (!ctx) {
    return { openQuote: () => {}, hasModal: false }
  }
  return { ...ctx, hasModal: true }
}
