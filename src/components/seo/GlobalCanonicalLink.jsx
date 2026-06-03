import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { normalizePublicPath } from '../../lib/normalizePublicPath'
import { getRouteSeoMetadata } from '../../lib/seoRouteMetadata'
import { setLink } from '../../lib/seoHeadTags'

/**
 * Sitewide self-referencing canonical on every public route (before paint).
 * Homepage CMS overrides are applied by HomePageSeo after this runs.
 */
export default function GlobalCanonicalLink() {
  const { pathname } = useLocation()
  const routePath = normalizePublicPath(pathname)

  useLayoutEffect(() => {
    if (routePath.startsWith('/admin')) return undefined

    const { canonicalUrl } = getRouteSeoMetadata(routePath)
    if (!canonicalUrl) return undefined

    const { el, prev } = setLink('canonical', canonicalUrl)
    return () => {
      if (prev != null) el.setAttribute('href', prev)
    }
  }, [routePath])

  return null
}
