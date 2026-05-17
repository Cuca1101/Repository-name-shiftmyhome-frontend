import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchWebsiteCmsPublic } from '../lib/data/websiteCmsRepository'
import {
  DEFAULT_HOMEPAGE,
  DEFAULT_ABOUT,
  DEFAULT_COVERAGE,
  DEFAULT_NAVBAR,
  DEFAULT_FOOTER,
  DEFAULT_ANNOUNCEMENT,
  getDefaultServiceCards,
  DEFAULT_REVIEWS,
} from '../lib/websiteCmsDefaults'

const WebsiteCmsContext = createContext({
  loading: true,
  cms: null,
  homepage: DEFAULT_HOMEPAGE,
  about: DEFAULT_ABOUT,
  coverage: DEFAULT_COVERAGE,
  navbar: DEFAULT_NAVBAR,
  footer: DEFAULT_FOOTER,
  announcement: DEFAULT_ANNOUNCEMENT,
  serviceCards: getDefaultServiceCards(),
  reviews: DEFAULT_REVIEWS,
})

export function WebsiteCmsProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [cms, setCms] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchWebsiteCmsPublic()
        if (!cancelled) setCms(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => {
    const homepage = cms?.homepage ?? DEFAULT_HOMEPAGE
    const about = cms?.about ?? DEFAULT_ABOUT
    const coverage = cms?.coverage ?? DEFAULT_COVERAGE
    const navbar = cms?.navbar ?? DEFAULT_NAVBAR
    const footer = cms?.footer ?? DEFAULT_FOOTER
    const announcement = cms?.announcement ?? DEFAULT_ANNOUNCEMENT
    const serviceCards = cms?.serviceCards?.length ? cms.serviceCards : getDefaultServiceCards()
    const reviews = cms?.reviews?.length ? cms.reviews : DEFAULT_REVIEWS

    return {
      loading,
      cms,
      hasCmsData: cms !== null,
      hasCmsServiceCards: Boolean(cms?.serviceCards?.length),
      hasCmsReviews: Boolean(cms?.reviews?.length),
      homepage,
      about,
      coverage,
      navbar,
      footer,
      announcement,
      serviceCards,
      reviews,
    }
  }, [cms, loading])

  return <WebsiteCmsContext.Provider value={value}>{children}</WebsiteCmsContext.Provider>
}

export function useWebsiteCms() {
  return useContext(WebsiteCmsContext)
}
