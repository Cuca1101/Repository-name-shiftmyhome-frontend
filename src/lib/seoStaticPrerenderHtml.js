/** Crawlable HTML fragments injected into per-route index.html files at build time. */

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
