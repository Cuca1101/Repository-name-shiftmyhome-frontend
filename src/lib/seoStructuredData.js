import { SEO_SITE_ORIGIN } from '../data/seoPages.js'
import { buildLocalBusinessJsonLd } from './schemaOrgBusiness.js'

/**
 * @param {{ q: string, a: string }[]} faqs
 * @param {string} path
 */
export function buildFaqPageJsonLd(faqs, path) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
    url: `${SEO_SITE_ORIGIN}${path}`,
  }
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
