import { DEFAULT_HOMEPAGE } from './websiteCmsDefaults'
import { getSeoPageByPath, SEO_SITE_ORIGIN } from '../data/seoPages'
import { getServicePageSeoContent } from './seo/servicePageContent.js'
import { SERVICE_PAGES } from '../constants/servicePages'
import {
  SEO_DASHBOARD_HOMEPAGE,
  SEO_DASHBOARD_ALL_PAGES,
  SEO_DASHBOARD_SERVICES,
  SEO_DASHBOARD_CITIES,
  SEO_DASHBOARD_CATEGORIES,
  getSeoDashboardPageDef,
  getSavedSeoRowForDef,
} from './seoDashboardPages.js'

export {
  SEO_DASHBOARD_HOMEPAGE,
  SEO_DASHBOARD_ALL_PAGES,
  SEO_DASHBOARD_SERVICES,
  SEO_DASHBOARD_CITIES,
  SEO_DASHBOARD_CATEGORIES,
  getSeoDashboardPageDef,
}

/** @typedef {'homepage'|'service'|'city'|'seo'|'system'} SeoPageType */

/**
 * @typedef {object} SeoDashboardPageDef
 * @property {string} pageSlug
 * @property {SeoPageType} pageType
 * @property {string} label
 * @property {string} path
 * @property {string} [category]
 * @property {string} [kind]
 */

export const SEO_SITE_ORIGIN_DEFAULT = SEO_SITE_ORIGIN

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
    const seoContent = getServicePageSeoContent(servicePage.slug)
    row.seo_title = seoContent?.seoTitle || `${servicePage.title} | ShiftMyHome`
    row.meta_description = seoContent?.metaDescription || servicePage.shortDescription
    row.og_title = row.seo_title
    row.og_description = row.meta_description
    row.canonical_url = `${SEO_SITE_ORIGIN}${servicePage.path}`
    row.h1 = servicePage.title
    row.intro_text = seoContent?.intro || servicePage.shortDescription
    row.cta_text = 'Get an Instant Quote'
    row.faq_json = seoContent?.faqs?.map((f) => ({ q: f.q, a: f.a })) ?? []
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

/** @param {string|undefined|null} saved @param {string|undefined|null} fallback */
function pickSavedText(saved, fallback) {
  const value = String(saved ?? '').trim()
  return value || String(fallback ?? '').trim()
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
    seo_title: pickSavedText(saved.seo_title, fallback.seo_title),
    meta_description: pickSavedText(saved.meta_description, fallback.meta_description),
    og_title: pickSavedText(saved.og_title, fallback.og_title),
    og_description: pickSavedText(saved.og_description, fallback.og_description),
    canonical_url: pickSavedText(saved.canonical_url, fallback.canonical_url),
    h1: pickSavedText(saved.h1, fallback.h1),
    intro_text: pickSavedText(saved.intro_text, fallback.intro_text),
    cta_text: pickSavedText(saved.cta_text, fallback.cta_text),
    faq_json: faq,
    extra_json: { ...(fallback.extra_json || {}), ...(saved.extra_json || {}) },
  }
}

/** @param {Map<string, SeoSettingsRow>|null|undefined} map @param {SeoDashboardPageDef} def */
export function mergeSeoSettingsForDef(map, def) {
  return mergeSeoSettingsWithFallback(getSavedSeoRowForDef(map, def), def)
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
