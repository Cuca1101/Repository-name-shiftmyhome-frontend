import { SEO_SITE_ORIGIN } from '../data/seoPages.js'

export const SITE_BRAND_NAME = 'ShiftMyHome'
export const SITE_BRAND_LOGO_URL = `${SEO_SITE_ORIGIN}/logo.png`

const BRAND_SCRIPT_ID = 'shiftmyhome-organization-brand-jsonld'

/**
 * Simple Organization schema for Google site name / brand recognition.
 * @returns {Record<string, unknown>}
 */
export function buildOrganizationBrandJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_BRAND_NAME,
    url: SEO_SITE_ORIGIN,
    logo: SITE_BRAND_LOGO_URL,
  }
}

/**
 * Ensures sitewide brand meta tags exist (not removed by page SEO updates).
 * @returns {{ metas: { el: Element, prev: string|null, created: boolean }[], script: HTMLScriptElement|null, prevJson: string|null, hadScript: boolean }}
 */
export function applySiteBrandHeadTags() {
  /** @type {{ el: Element, prev: string|null, created: boolean }[]} */
  const metas = []

  const brandTags = [
    ['property', 'og:site_name', SITE_BRAND_NAME],
    ['name', 'application-name', SITE_BRAND_NAME],
    ['name', 'apple-mobile-web-app-title', SITE_BRAND_NAME],
    ['name', 'twitter:site', SITE_BRAND_NAME],
  ]

  for (const [attr, key, content] of brandTags) {
    let el = document.querySelector(`meta[data-seo-brand="1"][${attr}="${key}"]`)
    const created = !el
    if (!el) {
      el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('data-seo-brand', '1')
    }
    const prev = el.getAttribute('content')
    el.setAttribute('content', content)
    metas.push({ el, prev, created })
  }

  let script = document.getElementById(BRAND_SCRIPT_ID)
  const hadScript = Boolean(script)
  if (!script) {
    script = document.createElement('script')
    script.id = BRAND_SCRIPT_ID
    script.type = 'application/ld+json'
    script.setAttribute('data-seo-brand', '1')
    document.head.appendChild(script)
  }
  const prevJson = script.textContent
  script.textContent = JSON.stringify(buildOrganizationBrandJsonLd())

  return { metas, script, prevJson, hadScript }
}

/** @param {ReturnType<typeof applySiteBrandHeadTags>} snapshot */
export function restoreSiteBrandHeadTags(snapshot) {
  snapshot.metas.forEach(({ el, prev, created }) => {
    if (created && el.parentNode) el.parentNode.removeChild(el)
    else if (prev != null) el.setAttribute('content', prev)
  })
  const { script, prevJson, hadScript } = snapshot
  if (!script) return
  if (!hadScript && script.parentNode) script.parentNode.removeChild(script)
  else if (hadScript) script.textContent = prevJson || ''
}

/**
 * HTML snippet for build-time injection (static prerender).
 */
export function buildSiteBrandHeadHtml() {
  const ld = JSON.stringify(buildOrganizationBrandJsonLd())
  return `    <meta property="og:site_name" content="${SITE_BRAND_NAME}" data-seo-brand="1" />
    <meta name="application-name" content="${SITE_BRAND_NAME}" data-seo-brand="1" />
    <meta name="apple-mobile-web-app-title" content="${SITE_BRAND_NAME}" data-seo-brand="1" />
    <meta name="twitter:site" content="${SITE_BRAND_NAME}" data-seo-brand="1" />
    <script id="${BRAND_SCRIPT_ID}" type="application/ld+json" data-seo-brand="1">${ld}</script>`
}
