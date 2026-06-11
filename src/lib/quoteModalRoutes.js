import { getSeoPageByPath } from '../data/seoPages'
import { normalizePublicPath } from './normalizePublicPath'

/** Routes that use the full-page quote wizard instead of the modal overlay. */
export function pathUsesDedicatedQuotePage(pathname) {
  const path = normalizePublicPath(pathname)
  return path === '/quote' || path.startsWith('/quote/')
}

/** SEO city/intent pages ship their own SeoQuoteModalProvider with a preset service type. */
export function pathHasOwnQuoteModal(pathname) {
  return Boolean(getSeoPageByPath(normalizePublicPath(pathname)))
}

/**
 * Homepage, coverage, blog, etc. — shared modal quote flow (same as SEO pages).
 * @param {string} pathname
 */
export function pathUsesPublicQuoteModal(pathname) {
  const path = normalizePublicPath(pathname)
  if (pathUsesDedicatedQuotePage(path)) return false
  if (path.startsWith('/payment')) return false
  if (pathHasOwnQuoteModal(path)) return false
  return true
}
