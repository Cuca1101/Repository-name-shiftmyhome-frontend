import { getSeoPageByPath } from '../data/seoPages'
import { getServicePageByPath } from '../constants/servicePages'
import { DEFAULT_HOMEPAGE } from './websiteCmsDefaults'
import { mergeSeoSettingsWithFallback, getSeoDashboardPageDef } from './seoSettingsDefaults'

/**
 * @param {Map<string, import('./seoSettingsDefaults').SeoSettingsRow>|null|undefined} map
 * @param {string} pageSlug
 */
export function getMergedSeoRow(map, pageSlug) {
  const def = getSeoDashboardPageDef(pageSlug)
  if (!def) return null
  const saved = map?.get(pageSlug)
  return mergeSeoSettingsWithFallback(saved, def)
}

const SERVICE_SLUG_BY_PATH = {
  '/house-removals': 'house-removals',
  '/furniture-delivery': 'furniture-delivery',
  '/man-with-van': 'man-with-van',
  '/office-moves': 'office-moves',
  '/emergency-man-with-van-glasgow': 'urgent-removals',
  '/same-day-removals-glasgow': 'same-day-delivery',
}

const CITY_PATHS = {
  '/glasgow-removals': 'glasgow',
  '/edinburgh-removals': 'edinburgh',
  '/aberdeen-removals': 'aberdeen',
  '/dundee-removals': 'dundee',
  '/inverness-removals': 'inverness',
  '/stirling-removals': 'stirling',
  '/perth-removals': 'perth',
}

/**
 * @param {Map<string, import('./seoSettingsDefaults').SeoSettingsRow>|null|undefined} map
 * @param {string} pathname
 */
export function resolvePublicSeoForPath(map, pathname) {
  if (pathname === '/') return getMergedSeoRow(map, 'home')

  const serviceSlug = SERVICE_SLUG_BY_PATH[pathname]
  if (serviceSlug) return getMergedSeoRow(map, serviceSlug)

  const citySlug = CITY_PATHS[pathname]
  if (citySlug) return getMergedSeoRow(map, citySlug)

  return null
}

/**
 * @param {import('../data/seoPages').SeoPageConfig} page
 * @param {import('./seoSettingsDefaults').SeoSettingsRow|null|undefined} override
 */
export function mergeSeoLandingPageConfig(page, override) {
  if (!page) return page
  if (!override) return page
  const faqs =
    Array.isArray(override.faq_json) && override.faq_json.length
      ? override.faq_json.map((f) => ({ q: f.q, a: f.a }))
      : page.faqs

  return {
    ...page,
    title: override.seo_title?.trim() || page.title,
    metaDescription: override.meta_description?.trim() || page.metaDescription,
    h1: override.h1?.trim() || page.h1,
    intro: override.intro_text?.trim() || page.intro,
    faqs,
    ctaText: override.cta_text?.trim() || 'Get an Instant Quote',
  }
}

/**
 * @param {ReturnType<typeof getServicePageByPath>} page
 * @param {import('./seoSettingsDefaults').SeoSettingsRow|null|undefined} override
 */
export function mergeServicePageConfig(page, override) {
  if (!page) return page
  if (!override) return page
  return {
    ...page,
    title: override.h1?.trim() || override.seo_title?.trim() || page.title,
    shortDescription: override.intro_text?.trim() || page.shortDescription,
    seoTitle: override.seo_title?.trim() || `${page.title} | ShiftMyHome`,
    metaDescription: override.meta_description?.trim() || page.shortDescription,
    canonicalUrl: override.canonical_url?.trim() || '',
    ogTitle: override.og_title?.trim() || override.seo_title?.trim() || page.title,
    ogDescription: override.og_description?.trim() || override.meta_description?.trim() || page.shortDescription,
    faqs: Array.isArray(override.faq_json) ? override.faq_json : [],
    ctaText: override.cta_text?.trim() || 'Get an Instant Quote',
  }
}

/**
 * @param {typeof DEFAULT_HOMEPAGE} homepage
 * @param {import('./seoSettingsDefaults').SeoSettingsRow|null|undefined} override
 */
export function mergeHomepageCmsWithSeo(homepage, override) {
  const h = homepage ?? DEFAULT_HOMEPAGE
  if (!override) return h
  const extra = override.extra_json || {}
  return {
    ...h,
    homepageSeoTitle: override.seo_title?.trim() || h.homepageSeoTitle,
    homepageSeoDescription: override.meta_description?.trim() || h.homepageSeoDescription,
    heroSubtitle: String(extra.heroSubheadline || '').trim() || h.heroSubtitle,
    ctaPrimaryText: String(extra.ctaButtonText || '').trim() || h.ctaPrimaryText,
    servicesHeading: String(extra.serviceSectionHeading || '').trim() || h.servicesHeading,
    seoHeroHeadline: String(extra.heroHeadline || '').trim(),
    seoTrustBadgesText: String(extra.trustBadgesText || '').trim(),
    seoOgTitle: override.og_title?.trim() || override.seo_title?.trim() || h.homepageSeoTitle,
    seoOgDescription: override.og_description?.trim() || override.meta_description?.trim() || h.homepageSeoDescription,
    seoCanonicalUrl: override.canonical_url?.trim() || '',
  }
}
