/** Crawlable HTML fragments injected into per-route index.html files at build time. */

import { getScotlandLocationsGroupedByRegion } from './seo/locations.js'

/**
 * @param {string} value
 */
export function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @typedef {object} SeoStaticFaqItem
 * @property {string} q
 * @property {string} a
 */

/**
 * @typedef {object} SeoStaticBodySection
 * @property {string} heading
 * @property {string[]} paragraphs
 */

/**
 * @param {{ href: string, label: string }[]} links
 * @param {string} heading
 */
function linkListSection(links, heading) {
  if (!Array.isArray(links) || links.length === 0) return ''
  const items = links
    .map(
      (link) =>
        `<li><a href="${escapeHtmlText(link.href)}">${escapeHtmlText(link.label)}</a></li>`,
    )
    .join('')
  return `<section><h2>${escapeHtmlText(heading)}</h2><ul>${items}</ul></section>`
}

/**
 * Visible intro, body sections, and FAQ for crawlers (first HTML response).
 *
 * @param {{
 *   h1: string,
 *   heroTeaser?: string,
 *   introHeading?: string,
 *   intro?: string,
 *   introSecondary?: string,
 *   bodySections?: SeoStaticBodySection[],
 *   keywordSentence?: string,
 *   faqs?: SeoStaticFaqItem[],
 *   metaDescription?: string,
 * }} content
 */
export function buildSeoStaticMainContentHtml(content) {
  const h1 = escapeHtmlText(content.h1)
  const parts = [`<main id="seo-prerender-content" class="seo-prerender">`]

  parts.push('<header>')
  parts.push(`<h1>${h1}</h1>`)
  const lead = content.heroTeaser || content.metaDescription
  if (lead) {
    parts.push(`<p class="seo-prerender-lead">${escapeHtmlText(lead)}</p>`)
  }
  parts.push('</header>')

  const hasIntro =
    content.intro ||
    content.introSecondary ||
    (content.bodySections?.length ?? 0) > 0 ||
    content.keywordSentence

  if (hasIntro) {
    const introHeading = content.introHeading || 'About this service'
    parts.push(`<section aria-labelledby="seo-prerender-intro-h">`)
    parts.push(`<h2 id="seo-prerender-intro-h">${escapeHtmlText(introHeading)}</h2>`)
    if (content.intro) parts.push(`<p>${escapeHtmlText(content.intro)}</p>`)
    if (content.introSecondary) {
      parts.push(`<p>${escapeHtmlText(content.introSecondary)}</p>`)
    }
    for (const section of content.bodySections ?? []) {
      if (!section?.heading) continue
      parts.push(`<h3>${escapeHtmlText(section.heading)}</h3>`)
      for (const para of section.paragraphs ?? []) {
        if (para) parts.push(`<p>${escapeHtmlText(para)}</p>`)
      }
    }
    if (content.keywordSentence) {
      parts.push(`<p>${escapeHtmlText(content.keywordSentence)}</p>`)
    }
    parts.push('</section>')
  }

  const faqs = Array.isArray(content.faqs) ? content.faqs.filter((f) => f?.q && f?.a) : []
  if (faqs.length > 0) {
    parts.push('<section aria-labelledby="seo-prerender-faq-h">')
    parts.push('<h2 id="seo-prerender-faq-h">Frequently asked questions</h2>')
    for (const faq of faqs) {
      parts.push(`<h3>${escapeHtmlText(faq.q)}</h3>`)
      parts.push(`<p>${escapeHtmlText(faq.a)}</p>`)
    }
    parts.push('</section>')
  }

  parts.push(
    '<p><a href="/quote">Get an instant quote</a> · <a href="/coverage">View coverage areas</a></p>',
  )
  parts.push('</main>')
  return parts.join('')
}

/**
 * @param {{
 *   h1: string,
 *   cityName?: string,
 *   heroTeaser?: string,
 *   introHeading?: string,
 *   intro?: string,
 *   introSecondary?: string,
 *   bodySections?: SeoStaticBodySection[],
 *   keywordSentence?: string,
 *   faqs?: SeoStaticFaqItem[],
 *   metaDescription?: string,
 *   relatedLinks?: { href: string, label: string }[],
 *   nearbyLocations?: { href: string, label: string }[],
 *   areasWeCover?: { href: string, name: string }[],
 * }} page
 */
export function buildSeoStaticBodyHtml(page) {
  const introHeading =
    page.introHeading ||
    (page.cityName === 'Scotland'
      ? 'Professional moves across Scotland'
      : page.cityName
        ? `Local movers in ${page.cityName}`
        : undefined)

  const main = buildSeoStaticMainContentHtml({
    h1: page.h1,
    heroTeaser: page.heroTeaser,
    introHeading,
    intro: page.intro,
    introSecondary: page.introSecondary,
    bodySections: page.bodySections,
    keywordSentence: page.keywordSentence,
    faqs: page.faqs,
    metaDescription: page.metaDescription,
  })

  const areasWeCover = (page.areasWeCover ?? []).map(({ href, name }) => ({
    href,
    label: name,
  }))
  const related = linkListSection(page.relatedLinks ?? [], 'Related pages')
  const nearby = linkListSection(page.nearbyLocations ?? [], 'Nearby locations')
  const areas = linkListSection(areasWeCover, 'Areas We Cover')
  const nav =
    related || nearby || areas
      ? `<nav id="seo-prerender-nav" aria-label="Site navigation links">${areas}${nearby}${related}</nav>`
      : ''

  return `${main}${nav}`
}

export function buildCoverageStaticCityLinksHtml() {
  const groups = getScotlandLocationsGroupedByRegion()
  const sections = groups
    .map((group) => {
      const items = group.locations
        .map(
          (loc) =>
            `<li><a href="${escapeHtmlText(loc.href)}">${escapeHtmlText(loc.name)} removals</a></li>`,
        )
        .join('')
      return `<section><h2>${escapeHtmlText(group.label)}</h2><ul>${items}</ul></section>`
    })
    .join('')
  return `<nav id="coverage-prerender-nav" aria-label="Scotland removals directory">${sections}</nav>`
}
