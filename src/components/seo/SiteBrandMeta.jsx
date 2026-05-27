import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applySiteBrandHeadTags, restoreSiteBrandHeadTags } from '../../lib/siteBrandMeta'

function isAdminPath(pathname) {
  return pathname.startsWith('/admin')
}

/**
 * Sitewide brand metadata on all public routes (OG site name, app name, Organization JSON-LD).
 * Does not override per-page titles or descriptions.
 */
export default function SiteBrandMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (isAdminPath(pathname)) return undefined
    const snapshot = applySiteBrandHeadTags()
    return () => restoreSiteBrandHeadTags(snapshot)
  }, [pathname])

  return null
}
