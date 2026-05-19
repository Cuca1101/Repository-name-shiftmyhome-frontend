import { useEffect, useMemo, useState } from 'react'
import { fetchItemsLibrary } from '../../lib/data/itemsLibraryRepository'
import {
  buildQuoteInventoryCatalogFromLibrary,
  createInventoryCatalogHelpers,
  getFallbackInventoryCatalog,
} from './buildQuoteInventoryCatalog'

/**
 * Items Library (Supabase / offline cache) as primary catalogue; static inventoryCatalog.js as fallback.
 */
export function useQuoteInventoryCatalog() {
  const [catalogState, setCatalogState] = useState(() => getFallbackInventoryCatalog())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCatalog({ silent = false } = {}) {
      if (!silent) setLoading(true)
      try {
        const rows = await fetchItemsLibrary()
        const built = buildQuoteInventoryCatalogFromLibrary(rows)
        const next = built ?? getFallbackInventoryCatalog()
        if (cancelled) return
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug(
            '[quote inventory]',
            next.source === 'library' ? 'Items Library' : 'inventoryCatalog.js fallback',
            next.source === 'library' ? `(${rows?.length ?? 0} rows)` : '',
          )
        }
        setCatalogState(next)
      } catch {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug('[quote inventory] load failed — using inventoryCatalog.js fallback')
          }
          setCatalogState(getFallbackInventoryCatalog())
        }
      } finally {
        if (!cancelled && !silent) setLoading(false)
      }
    }

    loadCatalog()

    function onVisible() {
      if (document.visibilityState === 'visible') loadCatalog({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const helpers = useMemo(() => createInventoryCatalogHelpers(catalogState), [catalogState])

  return {
    ...helpers,
    loading,
    source: catalogState.source,
  }
}
