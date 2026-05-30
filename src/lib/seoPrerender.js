/**
 * Build-time SEO payload for static HTML injection.
 */
import { getSeoPageByPath } from '../data/seoPages.js'
import { getRouteSeoMetadata } from './seoRouteMetadata.js'
import { buildFaqPageJsonLd, buildSeoLocalBusinessJsonLd } from './seoStructuredData.js'
import { buildSeoStaticBodyHtml, escapeHtmlText } from './seoStaticPrerenderHtml.js'

/**
 * @param {string} pathname
 */
export function getSeoPrerenderPayload(pathname) {
  const meta = getRouteSeoMetadata(pathname)
  const page = getSeoPageByPath(pathname)

  /** @type {object[]} */
  const jsonLd = []
  if (meta.breadcrumbJsonLd) jsonLd.push(meta.breadcrumbJsonLd)
  if (page) {
    const faq = buildFaqPageJsonLd(page.faqs, page.path)
    if (faq) jsonLd.push(faq)
    jsonLd.push(buildSeoLocalBusinessJsonLd(page))
  }

  const staticBodyHtml = page
    ? buildSeoStaticBodyHtml({
        h1: page.h1,
        relatedLinks: page.relatedLinks,
        nearbyLocations: page.nearbyLocations,
      })
    : `<h1 class="sr-only">${escapeHtmlText(meta.h1)}</h1>`

  return { meta, jsonLd, staticBodyHtml }
}
