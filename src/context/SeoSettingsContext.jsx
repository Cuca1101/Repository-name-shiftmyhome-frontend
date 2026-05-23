import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchSeoSettingsPublicMap } from '../lib/data/seoSettingsRepository'
import { getMergedSeoRow, resolvePublicSeoForPath } from '../lib/seoSettingsMerge'

/** @typedef {import('../lib/seoSettingsDefaults').SeoSettingsRow} SeoSettingsRow */

const SeoSettingsContext = createContext({
  loading: true,
  bySlug: /** @type {Map<string, SeoSettingsRow>} */ (new Map()),
  getForSlug: /** @type {(slug: string) => SeoSettingsRow|null} */ (() => null),
  getForPath: /** @type {(path: string) => SeoSettingsRow|null} */ (() => null),
  refresh: async () => {},
})

export function SeoSettingsProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [bySlug, setBySlug] = useState(/** @type {Map<string, SeoSettingsRow>} */ (new Map()))

  const load = useCallback(async () => {
    setLoading(true)
    const map = await fetchSeoSettingsPublicMap()
    setBySlug(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const onUpdate = () => load()
    window.addEventListener('seo-settings-updated', onUpdate)
    return () => window.removeEventListener('seo-settings-updated', onUpdate)
  }, [load])

  const value = useMemo(
    () => ({
      loading,
      bySlug,
      getForSlug: (slug) => getMergedSeoRow(bySlug, slug),
      getForPath: (path) => resolvePublicSeoForPath(bySlug, path),
      refresh: load,
    }),
    [loading, bySlug, load],
  )

  return <SeoSettingsContext.Provider value={value}>{children}</SeoSettingsContext.Provider>
}

export function useSeoSettings() {
  return useContext(SeoSettingsContext)
}
