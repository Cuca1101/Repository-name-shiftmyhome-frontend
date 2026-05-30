import {
  COMPANY_AREA_SERVED,
  COMPANY_EMAIL,
  COMPANY_PHONE_E164,
  COMPANY_SAME_AS_URLS,
  filterValidSameAsUrls,
} from '../constants/companyContact.js'

const BUSINESS_NAME = 'ShiftMyHome'
const BUSINESS_ALTERNATE_NAMES = ['Shift My Home', 'Shift My Home Removals']

/** @param {string} siteOrigin */
function organizationLogoUrl(siteOrigin) {
  return `${siteOrigin}/logo.png`
}

/**
 * @returns {Record<string, unknown>}
 */
export function buildCustomerServiceContactPoint() {
  return {
    '@type': 'ContactPoint',
    telephone: COMPANY_PHONE_E164,
    email: COMPANY_EMAIL,
    contactType: 'customer service',
    areaServed: ['GB', 'Scotland'],
    availableLanguage: ['English', 'en-GB'],
  }
}

/**
 * MovingCompany + Organization-style entity for the site root.
 * @param {string} siteOrigin
 * @param {{ description?: string }} [options]
 */
export function buildMovingCompanyJsonLd(siteOrigin, options = {}) {
  const description =
    options.description ||
    'ShiftMyHome is a trusted removals platform for house removals, man with van, furniture delivery, office moves, and student moves across Scotland and the UK.'

  const sameAs = filterValidSameAsUrls(COMPANY_SAME_AS_URLS)

  /** @type {Record<string, unknown>} */
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MovingCompany',
    '@id': `${siteOrigin}/#organization`,
    name: BUSINESS_NAME,
    alternateName: BUSINESS_ALTERNATE_NAMES,
    url: siteOrigin,
    logo: organizationLogoUrl(siteOrigin),
    description,
    telephone: COMPANY_PHONE_E164,
    email: COMPANY_EMAIL,
    areaServed: COMPANY_AREA_SERVED,
    contactPoint: buildCustomerServiceContactPoint(),
    knowsAbout: [
      'House removals',
      'Man with van',
      'Furniture delivery',
      'Office moves',
      'Student moves',
      'Removal van',
      'Moving services',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Moving services',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'House removals' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Man with van' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Furniture delivery' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Office moves' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Student moves' } },
      ],
    },
  }

  if (sameAs.length) ld.sameAs = sameAs

  return ld
}

/**
 * LocalBusiness JSON-LD for SEO landing pages (references root organization).
 * @param {string} siteOrigin
 * @param {{ path: string, pageTitle?: string, description?: string }} options
 */
export function buildLocalBusinessJsonLd(siteOrigin, options) {
  const path = options.path || '/'
  const pageUrl = `${siteOrigin}${path}`
  const sameAs = filterValidSameAsUrls(COMPANY_SAME_AS_URLS)

  /** @type {Record<string, unknown>} */
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${pageUrl}#localbusiness`,
    name: BUSINESS_NAME,
    alternateName: BUSINESS_ALTERNATE_NAMES,
    url: pageUrl,
    description:
      options.description ||
      'Professional removals, man with van, and moving services across Scotland and the UK.',
    telephone: COMPANY_PHONE_E164,
    email: COMPANY_EMAIL,
    areaServed: COMPANY_AREA_SERVED,
    contactPoint: buildCustomerServiceContactPoint(),
    parentOrganization: { '@id': `${siteOrigin}/#organization` },
  }

  if (options.pageTitle) ld.serviceType = options.pageTitle
  if (sameAs.length) ld.sameAs = sameAs

  return ld
}

/**
 * @param {string} siteOrigin
 * @param {string} description
 */
export function buildWebSiteJsonLd(siteOrigin, description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteOrigin}/#website`,
    name: BUSINESS_NAME,
    alternateName: 'Shift My Home',
    url: siteOrigin,
    description,
    publisher: { '@id': `${siteOrigin}/#organization` },
    inLanguage: 'en-GB',
  }
}
