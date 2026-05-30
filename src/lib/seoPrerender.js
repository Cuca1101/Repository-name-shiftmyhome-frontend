/**
 * Build-time SEO payload for static HTML injection.
 */
import { getSeoPageByPath } from '../data/seoPages.js'
import { getRouteSeoMetadata } from './seoRouteMetadata.js'
import { buildFaqPageJsonLd, buildSeoLocalBusinessJsonLd } from './seoStructuredData.js'
import {
  buildSeoStaticBodyHtml,
  buildHomepageStaticCityLinksHtml,
  buildCoverageStaticCityLinksHtml,
  escapeHtmlText,
} from './seoStaticPrerenderHtml.js'

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

  let staticBodyHtml
  if (pathname === '/') {
    staticBodyHtml = `<h1 class="sr-only">${escapeHtmlText(meta.h1)}</h1>${buildHomepageStaticCityLinksHtml()}`
  } else if (pathname === '/coverage') {
    staticBodyHtml = `<h1 class="sr-only">${escapeHtmlText(meta.h1)}</h1>${buildCoverageStaticCityLinksHtml()}`
  } else if (page) {
    staticBodyHtml = buildSeoStaticBodyHtml({
      h1: page.h1,
      relatedLinks: page.relatedLinks,
      nearbyLocations: page.nearbyLocations,
    })
  } else {
    staticBodyHtml = `<h1 class="sr-only">${escapeHtmlText(meta.h1)}</h1>`
  }

  return { meta, jsonLd, staticBodyHtml }
}
