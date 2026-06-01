import { SEO_SITE_ORIGIN } from '../data/seoPages.js'
import { buildLocalBusinessJsonLd } from './schemaOrgBusiness.js'

export { SEO_FAQ_JSON_LD_ID, SEO_JSON_LD_SCRIPT_IDS } from './seoJsonLdHead.js'

/**
 * FAQ items used in visible content and JSON-LD (both q and a required).
 * @param {{ q?: string, a?: string }[]|null|undefined} faqs
 * @returns {{ q: string, a: string }[]}
 */
export function normalizeSeoFaqs(faqs) {
  if (!Array.isArray(faqs)) return []
  return faqs
    .map(({ q, a }) => ({ q: String(q ?? '').trim(), a: String(a ?? '').trim() }))
    .filter(({ q, a }) => q && a)
}

/**
 * @param {{ q: string, a: string }[]} faqs
 * @param {string} path
 */
export function buildFaqPageJsonLd(faqs, path) {
  const items = normalizeSeoFaqs(faqs)
  if (items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  }
}

/**
 * @param {object|null} data
 * @returns {string[]} validation errors (empty = valid)
 */
export function validateFaqPageJsonLd(data) {
  if (!data) return []
  const errors = []
  if (data['@type'] !== 'FAQPage') errors.push('root @type must be FAQPage')
  if (!Array.isArray(data.mainEntity) || data.mainEntity.length === 0) {
    errors.push('mainEntity must be a non-empty array')
    return errors
  }
  data.mainEntity.forEach((item, index) => {
    if (item['@type'] !== 'Question') errors.push(`mainEntity[${index}]: @type must be Question`)
    if (!String(item.name ?? '').trim()) errors.push(`mainEntity[${index}]: missing name`)
    const answer = item.acceptedAnswer
    if (!answer || answer['@type'] !== 'Answer') {
      errors.push(`mainEntity[${index}]: acceptedAnswer must be @type Answer`)
    } else if (!String(answer.text ?? '').trim()) {
      errors.push(`mainEntity[${index}]: missing acceptedAnswer.text`)
    }
  })
  return errors
}

/**
 * @param {{ path: string, h1: string, metaDescription: string }} page
 */
export function buildSeoLocalBusinessJsonLd(page) {
  return buildLocalBusinessJsonLd(SEO_SITE_ORIGIN, {
    path: page.path,
    pageTitle: page.h1,
    description: page.metaDescription,
  })
}
