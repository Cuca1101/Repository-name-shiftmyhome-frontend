/** Stable head script ids — one JSON-LD block per schema type on SEO landing pages. */
export const SEO_JSON_LD_SCRIPT_IDS = {
  FAQPage: 'seo-jsonld-faq',
  BreadcrumbList: 'seo-jsonld-breadcrumb',
  LocalBusiness: 'seo-jsonld-localbusiness',
}

/** @deprecated Use SEO_JSON_LD_SCRIPT_IDS.FAQPage */
export const SEO_FAQ_JSON_LD_ID = SEO_JSON_LD_SCRIPT_IDS.FAQPage

/**
 * @param {string} schemaType
 */
export function seoJsonLdScriptId(schemaType) {
  return SEO_JSON_LD_SCRIPT_IDS[schemaType] || ''
}

/**
 * Remove duplicate JSON-LD of a type (unmanaged scripts in head or body).
 * @param {string} schemaType
 */
export function removeDuplicateJsonLdByType(schemaType) {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    const managedId = seoJsonLdScriptId(schemaType)
    if (managedId && el.id === managedId) return
    try {
      if (JSON.parse(el.textContent || '')['@type'] === schemaType) el.remove()
    } catch {
      /* ignore malformed JSON-LD */
    }
  })
}

/**
 * Insert or update a single JSON-LD script in document head.
 * @param {string} schemaType
 * @param {object|null|undefined} data
 */
export function upsertJsonLdInHead(schemaType, data) {
  const id = seoJsonLdScriptId(schemaType)
  if (!id) return

  removeDuplicateJsonLdByType(schemaType)

  if (!data) {
    const existing = document.getElementById(id)
    if (existing?.parentNode) existing.parentNode.removeChild(existing)
    return
  }

  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }

  el.textContent = JSON.stringify(data)
}

const LANDING_PAGE_SCHEMA_TYPES = ['FAQPage', 'BreadcrumbList', 'LocalBusiness']

/**
 * Strip duplicate landing-page JSON-LD from body (legacy React components).
 * Google requires exactly one FAQPage per page.
 */
export function removeSeoLandingBodyJsonLd() {
  document
    .querySelectorAll('article.seo-landing script[type="application/ld+json"]')
    .forEach((el) => el.remove())

  document.querySelectorAll('body script[type="application/ld+json"]').forEach((el) => {
    if (document.head.contains(el)) return
    try {
      const type = JSON.parse(el.textContent || '')['@type']
      if (LANDING_PAGE_SCHEMA_TYPES.includes(type)) el.remove()
    } catch {
      /* ignore */
    }
  })
}

/**
 * Keep only managed head scripts — removes orphan duplicates (incl. prerender without id).
 */
export function dedupeLandingPageJsonLdInHead() {
  for (const type of LANDING_PAGE_SCHEMA_TYPES) {
    removeDuplicateJsonLdByType(type)
  }
}

/**
 * @param {string[]} schemaTypes
 */
export function removeManagedJsonLdFromHead(schemaTypes) {
  for (const type of schemaTypes) {
    const id = seoJsonLdScriptId(type)
    const el = document.getElementById(id)
    if (el?.parentNode) el.parentNode.removeChild(el)
  }
}
