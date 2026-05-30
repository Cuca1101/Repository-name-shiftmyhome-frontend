/** Crawlable HTML fragments injected into per-route index.html files at build time. */

import { cityToSlug } from './citySlug.js'
import {
  FOOTER_PRIMARY_CITIES,
  getScotlandLocationsGroupedByRegion,
} from './seo/locations.js'

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
 * @param {{
 *   h1: string,
 *   relatedLinks?: { href: string, label: string }[],
 *   nearbyLocations?: { href: string, label: string }[],
 * }} page
 */
export function buildSeoStaticBodyHtml(page) {
  const related = linkListSection(page.relatedLinks ?? [], 'Related pages')
  const nearby = linkListSection(page.nearbyLocations ?? [], 'Nearby locations')
  const nav =
    related || nearby
      ? `<nav id="seo-prerender-nav" aria-label="Site navigation links">${related}${nearby}</nav>`
      : ''

  return `<h1 class="sr-only">${escapeHtmlText(page.h1)}</h1>${nav}`
}

/** Priority cities linked from homepage static HTML for generic keyword discovery. */
const HOMEPAGE_CITY_LINKS = [
  ...FOOTER_PRIMARY_CITIES,
  'Perth',
  'Stirling',
  'Falkirk',
  'Motherwell',
  'Hamilton',
  'Paisley',
  'Inverness',
]

export function buildHomepageStaticCityLinksHtml() {
  const unique = [...new Set(HOMEPAGE_CITY_LINKS)]
  const items = unique
    .map((city) => {
      const slug = cityToSlug(city)
      return `<li><a href="/${slug}-removals">${escapeHtmlText(city)} removals</a></li>`
    })
    .join('')
  return `<nav id="home-prerender-nav" aria-label="Scotland removals locations"><ul>${items}</ul><p><a href="/coverage">All Scotland removal locations</a> · <a href="/man-with-van-glasgow">Man with van Glasgow</a> · <a href="/furniture-delivery-glasgow">Furniture delivery Glasgow</a></p></nav>`
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
