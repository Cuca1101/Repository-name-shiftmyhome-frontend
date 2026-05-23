import { DEFAULT_HOMEPAGE } from './websiteCmsDefaults'
import { SERVICE_PAGES } from '../constants/servicePages'
import { getSeoPageByPath, SEO_SITE_ORIGIN } from '../data/seoPages'

/** @typedef {'homepage'|'service'|'city'|'system'} SeoPageType */

/**
 * @typedef {object} SeoDashboardPageDef
 * @property {string} pageSlug
 * @property {SeoPageType} pageType
 * @property {string} label
 * @property {string} path
 */

export const SEO_SITE_ORIGIN_DEFAULT = SEO_SITE_ORIGIN

export const SEO_DASHBOARD_HOMEPAGE = {
  pageSlug: 'home',
  pageType: 'homepage',
  label: 'Homepage',
  path: '/',
}

/** @type {SeoDashboardPageDef[]} */
export const SEO_DASHBOARD_SERVICES = [
  { pageSlug: 'house-removals', pageType: 'service', label: 'House Removals', path: '/house-removals' },
  { pageSlug: 'furniture-delivery', pageType: 'service', label: 'Furniture Removals', path: '/furniture-delivery' },
  { pageSlug: 'man-with-van', pageType: 'service', label: 'Man With Van', path: '/man-with-van' },
  { pageSlug: 'office-moves', pageType: 'service', label: 'Office Relocations', path: '/office-moves' },
  { pageSlug: 'urgent-removals', pageType: 'service', label: 'Urgent Removals', path: '/emergency-man-with-van-glasgow' },
  { pageSlug: 'same-day-delivery', pageType: 'service', label: 'Same Day Delivery', path: '/same-day-removals-glasgow' },
]

/** @type {SeoDashboardPageDef[]} */
export const SEO_DASHBOARD_CITIES = [
  { pageSlug: 'glasgow', pageType: 'city', label: 'Glasgow', path: '/glasgow-removals' },
  { pageSlug: 'edinburgh', pageType: 'city', label: 'Edinburgh', path: '/edinburgh-removals' },
  { pageSlug: 'aberdeen', pageType: 'city', label: 'Aberdeen', path: '/aberdeen-removals' },
  { pageSlug: 'dundee', pageType: 'city', label: 'Dundee', path: '/dundee-removals' },
  { pageSlug: 'inverness', pageType: 'city', label: 'Inverness', path: '/inverness-removals' },
  { pageSlug: 'stirling', pageType: 'city', label: 'Stirling', path: '/stirling-removals' },
  { pageSlug: 'perth', pageType: 'city', label: 'Perth', path: '/perth-removals' },
]

export const SEO_DASHBOARD_ALL_PAGES = [
  SEO_DASHBOARD_HOMEPAGE,
  ...SEO_DASHBOARD_SERVICES,
  ...SEO_DASHBOARD_CITIES,
]

/** @param {string} pageSlug */
export function getSeoDashboardPageDef(pageSlug) {
  return SEO_DASHBOARD_ALL_PAGES.find((p) => p.pageSlug === pageSlug) ?? null
}

/**
 * @typedef {object} SeoSettingsRow
 * @property {string} [id]
 * @property {string} page_slug
 * @property {string} page_type
 * @property {string} [seo_title]
 * @property {string} [meta_description]
 * @property {string} [og_title]
 * @property {string} [og_description]
 * @property {string} [canonical_url]
 * @property {string} [h1]
 * @property {string} [intro_text]
 * @property {string} [cta_text]
 * @property {{ q: string, a: string }[]} [faq_json]
 * @property {Record<string, unknown>} [extra_json]
 * @property {string} [updated_at]
 */

/** @returns {SeoSettingsRow} */
export function emptySeoSettingsRow(pageSlug, pageType) {
  return {
    page_slug: pageSlug,
    page_type: pageType,
    seo_title: '',
    meta_description: '',
    og_title: '',
    og_description: '',
    canonical_url: '',
    h1: '',
    intro_text: '',
    cta_text: '',
    faq_json: [],
    extra_json: {},
  }
}

/** @param {SeoDashboardPageDef} def */
export function buildSeoSettingsFallback(def) {
  const row = emptySeoSettingsRow(def.pageSlug, def.pageType)

  if (def.pageType === 'homepage') {
    row.seo_title = DEFAULT_HOMEPAGE.homepageSeoTitle
    row.meta_description = DEFAULT_HOMEPAGE.homepageSeoDescription
    row.og_title = DEFAULT_HOMEPAGE.homepageSeoTitle
    row.og_description = DEFAULT_HOMEPAGE.homepageSeoDescription
    row.canonical_url = `${SEO_SITE_ORIGIN}/`
    row.extra_json = {
      heroHeadline: '',
      heroSubheadline: DEFAULT_HOMEPAGE.heroSubtitle,
      trustBadgesText: 'Fully insured moves\nProfessional movers\nTransparent pricing',
      ctaButtonText: DEFAULT_HOMEPAGE.ctaPrimaryText,
      serviceSectionHeading: DEFAULT_HOMEPAGE.servicesHeading,
    }
    return row
  }

  const servicePage = SERVICE_PAGES.find((p) => p.path === def.path)
  const seoPage = getSeoPageByPath(def.path)

  if (servicePage) {
    row.seo_title = `${servicePage.title} | ShiftMyHome`
    row.meta_description = servicePage.shortDescription
    row.og_title = row.seo_title
    row.og_description = servicePage.shortDescription
    row.canonical_url = `${SEO_SITE_ORIGIN}${servicePage.path}`
    row.h1 = servicePage.title
    row.intro_text = servicePage.shortDescription
    row.cta_text = 'Get an Instant Quote'
    row.faq_json = []
    return row
  }

  if (seoPage) {
    row.seo_title = seoPage.title
    row.meta_description = seoPage.metaDescription
    row.og_title = seoPage.title
    row.og_description = seoPage.metaDescription
    row.canonical_url = `${SEO_SITE_ORIGIN}${seoPage.path}`
    row.h1 = seoPage.h1
    row.intro_text = seoPage.intro
    row.cta_text = 'Get an Instant Quote'
    row.faq_json = Array.isArray(seoPage.faqs) ? seoPage.faqs.map((f) => ({ q: f.q, a: f.a })) : []
    if (def.pageType === 'city') {
      row.extra_json = {
        nearbyAreas: (seoPage.nearbyLocations || [])
          .map((l) => l.label)
          .filter(Boolean)
          .join(', '),
      }
    }
    return row
  }

  row.canonical_url = `${SEO_SITE_ORIGIN}${def.path}`
  return row
}

/** @param {SeoSettingsRow|null|undefined} saved @param {SeoDashboardPageDef} def */
export function mergeSeoSettingsWithFallback(saved, def) {
  const fallback = buildSeoSettingsFallback(def)
  if (!saved) return fallback
  const faq =
    Array.isArray(saved.faq_json) && saved.faq_json.length
      ? saved.faq_json
      : fallback.faq_json
  return {
    ...fallback,
    ...saved,
    faq_json: faq,
    extra_json: { ...(fallback.extra_json || {}), ...(saved.extra_json || {}) },
  }
}

/** @param {SeoSettingsRow} row */
export function seoRowToFormState(row) {
  const extra = row.extra_json || {}
  return {
    seoTitle: row.seo_title || '',
    metaDescription: row.meta_description || '',
    ogTitle: row.og_title || '',
    ogDescription: row.og_description || '',
    canonicalUrl: row.canonical_url || '',
    h1: row.h1 || '',
    introText: row.intro_text || '',
    ctaText: row.cta_text || '',
    faqJson: Array.isArray(row.faq_json) ? row.faq_json : [],
    heroHeadline: String(extra.heroHeadline || ''),
    heroSubheadline: String(extra.heroSubheadline || ''),
    trustBadgesText: String(extra.trustBadgesText || ''),
    ctaButtonText: String(extra.ctaButtonText || ''),
    serviceSectionHeading: String(extra.serviceSectionHeading || ''),
    nearbyAreas: String(extra.nearbyAreas || ''),
  }
}

/** @param {ReturnType<typeof seoRowToFormState>} form @param {SeoDashboardPageDef} def */
export function formStateToSeoRow(form, def) {
  /** @type {Record<string, unknown>} */
  const extra = {}
  if (def.pageType === 'homepage') {
    extra.heroHeadline = form.heroHeadline.trim()
    extra.heroSubheadline = form.heroSubheadline.trim()
    extra.trustBadgesText = form.trustBadgesText.trim()
    extra.ctaButtonText = form.ctaButtonText.trim()
    extra.serviceSectionHeading = form.serviceSectionHeading.trim()
  }
  if (def.pageType === 'city') {
    extra.nearbyAreas = form.nearbyAreas.trim()
  }

  return {
    page_slug: def.pageSlug,
    page_type: def.pageType,
    seo_title: form.seoTitle.trim(),
    meta_description: form.metaDescription.trim(),
    og_title: form.ogTitle.trim(),
    og_description: form.ogDescription.trim(),
    canonical_url: form.canonicalUrl.trim(),
    h1: form.h1.trim(),
    intro_text: form.introText.trim(),
    cta_text: form.ctaText.trim(),
    faq_json: form.faqJson.filter((f) => f.q?.trim() || f.a?.trim()),
    extra_json: extra,
  }
}

/** @param {ReturnType<typeof seoRowToFormState>} form */
export function validateSeoForm(form) {
  /** @type {{ field: string, message: string, level: 'error'|'warn' }[]} */
  const issues = []
  if (!form.seoTitle.trim()) issues.push({ field: 'seoTitle', message: 'SEO title is required.', level: 'error' })
  if (!form.metaDescription.trim()) {
    issues.push({ field: 'metaDescription', message: 'Meta description is required.', level: 'error' })
  }
  if (form.seoTitle.length > 60) {
    issues.push({
      field: 'seoTitle',
      message: `SEO title is ${form.seoTitle.length} characters (recommended max 60).`,
      level: 'warn',
    })
  }
  if (form.metaDescription.length > 160) {
    issues.push({
      field: 'metaDescription',
      message: `Meta description is ${form.metaDescription.length} characters (recommended max 160).`,
      level: 'warn',
    })
  }
  return issues
}
