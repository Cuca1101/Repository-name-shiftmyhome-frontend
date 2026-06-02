/**
 * Build-time SEO payload for static HTML injection.
 */
import { getSeoPageByPath } from '../data/seoPages.js'
import { getServicePageByPath } from '../constants/servicePages.js'
import { getRouteSeoMetadata } from './seoRouteMetadata.js'
import { buildFaqPageJsonLd, buildSeoLocalBusinessJsonLd } from './seoStructuredData.js'
import {
  buildSeoStaticBodyHtml,
  buildSeoStaticMainContentHtml,
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
    // Screen-reader / crawler only — React hero replaces #root; avoids visible flash on refresh.
    staticBodyHtml = `<h1 class="sr-only">${escapeHtmlText(meta.h1)}</h1>`
  } else if (pathname === '/coverage') {
    staticBodyHtml =
      buildSeoStaticMainContentHtml({
        h1: meta.h1,
        metaDescription: meta.description,
        introHeading: 'Areas we cover',
        intro: meta.description,
        introSecondary:
          'Select your town or city below for local removals quotes, or use our instant quote form for any Scotland address.',
      }) + buildCoverageStaticCityLinksHtml()
  } else if (page) {
    staticBodyHtml = buildSeoStaticBodyHtml({
      h1: page.h1,
      cityName: page.cityName,
      heroTeaser: page.heroTeaser,
      intro: page.intro,
      introSecondary: page.introSecondary,
      bodySections: page.bodySections,
      keywordSentence: page.keywordSentence,
      faqs: page.faqs,
      metaDescription: page.metaDescription,
      relatedLinks: page.relatedLinks,
      nearbyLocations: page.nearbyLocations,
    })
  } else {
    const service = getServicePageByPath(pathname)
    if (service) {
      staticBodyHtml = buildSeoStaticBodyHtml({
        h1: service.title,
        heroTeaser: service.heroTeaser,
        intro: service.shortDescription,
        introHeading: `About ${service.title}`,
        metaDescription: meta.description,
      })
    } else if (meta.description) {
      staticBodyHtml = buildSeoStaticMainContentHtml({
        h1: meta.h1,
        metaDescription: meta.description,
        intro: meta.description,
      })
    } else {
      staticBodyHtml = buildSeoStaticMainContentHtml({ h1: meta.h1 })
    }
  }

  return { meta, jsonLd, staticBodyHtml }
}
