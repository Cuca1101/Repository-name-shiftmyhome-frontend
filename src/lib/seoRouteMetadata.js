/**
 * Central SEO metadata resolver for public routes (build-time + runtime).
 * SEO-only: does not affect pricing, booking, or page UI.
 */
import { getSeoPageByPath } from '../data/seoPages.js'
import { getServicePageByPath } from '../constants/servicePages.js'
import { buildCanonicalUrl, buildOpenGraphMeta } from './seo/seoKeywordHelpers.js'
import { SEO_SITE_ORIGIN } from '../data/seoPages.js'

const HOMEPAGE_SEO_TITLE = 'House Removals Scotland | ShiftMyHome'
const HOMEPAGE_SEO_DESCRIPTION =
  'ShiftMyHome — Glasgow removals, Edinburgh removals, and Scotland-wide house moves, man with van, and furniture delivery. Instant online quotes.'
import { buildSeoMetadataFromSlug } from './seoSlugMetadata.js'

/** @typedef {import('../data/seoPages.js').SeoPageConfig} SeoPageConfig */

/**
 * @typedef {{
 *   path: string,
 *   title: string,
 *   description: string,
 *   h1: string,
 *   ogTitle: string,
 *   ogDescription: string,
 *   canonicalUrl: string,
 *   breadcrumbJsonLd?: object,
 * }} RouteSeoMetadata
 */

/** @param {{ name: string, path: string }[]} items */
export function buildBreadcrumbJsonLd(items) {
  if (!Array.isArray(items) || items.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SEO_SITE_ORIGIN}${item.path}`,
    })),
  }
}

/** @type {Record<string, Omit<RouteSeoMetadata, 'path' | 'canonicalUrl'>>} */
const STATIC_ROUTE_META = {
  '/': {
    title: HOMEPAGE_SEO_TITLE,
    description: HOMEPAGE_SEO_DESCRIPTION,
    h1: 'House Removals Scotland',
    ogTitle: HOMEPAGE_SEO_TITLE,
    ogDescription: HOMEPAGE_SEO_DESCRIPTION,
  },
  '/quote': {
    title: 'Instant Removal Quote | ShiftMyHome',
    description:
      'Get an instant removals quote with ShiftMyHome for house removals, furniture delivery, man with van and moving services across Scotland.',
    h1: 'Get your instant quote',
    ogTitle: 'Instant Removal Quote | ShiftMyHome',
    ogDescription:
      'Get an instant removals quote with ShiftMyHome for house removals, furniture delivery, man with van and moving services across Scotland.',
  },
  '/coverage': {
    title: 'Scotland Removals Coverage Areas | ShiftMyHome',
    description:
      'House removals, man with van and furniture delivery across Scottish towns and cities — Glasgow, Edinburgh, Aberdeen, Dundee, Inverness, Paisley and nationwide routes.',
    h1: 'Scotland removals coverage',
    ogTitle: 'Scotland Removals Coverage Areas | ShiftMyHome',
    ogDescription:
      'House removals, man with van and furniture delivery across Scottish towns and cities — Glasgow, Edinburgh, Aberdeen, Dundee, Inverness, Paisley and nationwide routes.',
  },
  '/terms': {
    title: 'Terms & Conditions | ShiftMyHome',
    description:
      'Read the ShiftMyHome terms and conditions for bookings, payments, cancellations, liability and use of our removals quote and booking platform.',
    h1: 'Terms & Conditions',
    ogTitle: 'Terms & Conditions | ShiftMyHome',
    ogDescription:
      'Read the ShiftMyHome terms and conditions for bookings, payments, cancellations, liability and use of our removals quote and booking platform.',
  },
  '/privacy': {
    title: 'Privacy Policy | ShiftMyHome',
    description:
      'How ShiftMyHome collects, uses and protects your personal data when you request quotes, book moves or contact our removals team.',
    h1: 'Privacy Policy',
    ogTitle: 'Privacy Policy | ShiftMyHome',
    ogDescription:
      'How ShiftMyHome collects, uses and protects your personal data when you request quotes, book moves or contact our removals team.',
  },
  '/cookies': {
    title: 'Cookie Preferences | ShiftMyHome',
    description:
      'Manage analytics and marketing cookies on ShiftMyHome. Choose essential-only cookies or accept all to improve your browsing experience.',
    h1: 'Cookie preferences',
    ogTitle: 'Cookie Preferences | ShiftMyHome',
    ogDescription:
      'Manage analytics and marketing cookies on ShiftMyHome. Choose essential-only cookies or accept all to improve your browsing experience.',
  },
  '/payment-success': {
    title: 'Payment Successful | ShiftMyHome',
    description:
      'Your ShiftMyHome payment was successful. Your booking reference is shown on this page — keep it for move day and customer support.',
    h1: 'Payment successful',
    ogTitle: 'Payment Successful | ShiftMyHome',
    ogDescription:
      'Your ShiftMyHome payment was successful. Your booking reference is shown on this page — keep it for move day and customer support.',
  },
  '/payment-cancelled': {
    title: 'Payment Cancelled | ShiftMyHome',
    description:
      'Your ShiftMyHome payment was cancelled. You can return to your quote to try again or contact our team if you need help completing your booking.',
    h1: 'Payment cancelled',
    ogTitle: 'Payment Cancelled | ShiftMyHome',
    ogDescription:
      'Your ShiftMyHome payment was cancelled. You can return to your quote to try again or contact our team if you need help completing your booking.',
  },
}

/**
 * @param {string} pathname
 * @returns {RouteSeoMetadata}
 */
export function getRouteSeoMetadata(pathname) {
  const path = normalizePath(pathname)

  const seoPage = getSeoPageByPath(path)
  if (seoPage) return fromSeoPage(seoPage)

  const servicePage = getServicePageByPath(path)
  if (servicePage) return fromServicePage(path, servicePage)

  const staticMeta = STATIC_ROUTE_META[path]
  if (staticMeta) return withCanonical(path, staticMeta)

  return buildSeoMetadataFromSlug(path)
}

/** @param {string} pathname */
function normalizePath(pathname) {
  const raw = String(pathname || '').trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/** @param {SeoPageConfig} page */
function fromSeoPage(page) {
  const og = buildOpenGraphMeta(page.path, page.title, page.metaDescription)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: page.h1, path: page.path },
  ])
  return {
    path: page.path,
    title: page.title,
    description: page.metaDescription,
    h1: page.h1,
    ogTitle: page.ogTitle ?? og.ogTitle,
    ogDescription: page.ogDescription ?? og.ogDescription,
    canonicalUrl: buildCanonicalUrl(page.path),
    breadcrumbJsonLd: breadcrumbJsonLd ?? undefined,
  }
}

/** @param {string} path @param {{ title: string, shortDescription: string, seoTitle?: string, metaDescription?: string, ogTitle?: string, ogDescription?: string }} page */
function fromServicePage(path, page) {
  const title = page.seoTitle || `${page.title} | ShiftMyHome`
  const description = page.metaDescription || page.shortDescription
  const og = buildOpenGraphMeta(path, title, description)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: page.title, path },
  ])
  return {
    path,
    title,
    description,
    h1: page.title,
    ogTitle: page.ogTitle || og.ogTitle,
    ogDescription: page.ogDescription || description,
    canonicalUrl: buildCanonicalUrl(path),
    breadcrumbJsonLd: breadcrumbJsonLd ?? undefined,
  }
}

/** @param {string} path @param {Omit<RouteSeoMetadata, 'path' | 'canonicalUrl'>} meta */
function withCanonical(path, meta) {
  return { path, ...meta, canonicalUrl: buildCanonicalUrl(path) }
}
