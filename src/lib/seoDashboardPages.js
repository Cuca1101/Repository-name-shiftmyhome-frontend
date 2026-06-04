import { ALL_SEO_PAGES } from '../data/seoPages'
import { SERVICE_PAGES } from '../constants/servicePages'

/** @typedef {import('./seoSettingsDefaults').SeoDashboardPageDef} SeoDashboardPageDef */

export const SEO_DASHBOARD_HOMEPAGE = {
  pageSlug: 'home',
  pageType: 'homepage',
  label: 'Homepage',
  path: '/',
  category: 'Homepage',
}

/** Short slugs saved before full URL-based registry (admin DB). */
export const LEGACY_CITY_SLUG_BY_PATH = {
  '/glasgow-removals': 'glasgow',
  '/edinburgh-removals': 'edinburgh',
  '/aberdeen-removals': 'aberdeen',
  '/dundee-removals': 'dundee',
  '/inverness-removals': 'inverness',
  '/stirling-removals': 'stirling',
  '/perth-removals': 'perth',
}

const KIND_CATEGORY = {
  removals: 'City removals',
  'man-with-van': 'Man with van',
  'office-removals': 'Office removals',
  'student-moves': 'Student moves',
  'furniture-delivery': 'Furniture delivery',
  intent: 'Search intent pages',
}

/** @type {SeoDashboardPageDef[]} */
let cachedAllPages = null

/** @returns {SeoDashboardPageDef[]} */
export function buildSeoDashboardAllPages() {
  if (cachedAllPages) return cachedAllPages

  /** @type {Map<string, SeoDashboardPageDef>} */
  const bySlug = new Map()
  bySlug.set('home', SEO_DASHBOARD_HOMEPAGE)

  for (const sp of SERVICE_PAGES) {
    bySlug.set(sp.slug, {
      pageSlug: sp.slug,
      pageType: 'service',
      label: sp.title,
      path: sp.path,
      category: 'Main services',
    })
  }

  for (const page of ALL_SEO_PAGES) {
    if (bySlug.has(page.slug)) continue
    bySlug.set(page.slug, {
      pageSlug: page.slug,
      pageType: page.kind === 'removals' ? 'city' : 'seo',
      label: page.h1 || page.title,
      path: page.path,
      category: KIND_CATEGORY[page.kind] || 'SEO pages',
      kind: page.kind,
    })
  }

  const pages = Array.from(bySlug.values())
  pages.sort((a, b) => {
    if (a.pageSlug === 'home') return -1
    if (b.pageSlug === 'home') return 1
    const cat = (a.category || '').localeCompare(b.category || '')
    if (cat !== 0) return cat
    return (a.label || '').localeCompare(b.label || '')
  })

  cachedAllPages = pages
  return pages
}

export const SEO_DASHBOARD_ALL_PAGES = buildSeoDashboardAllPages()

export const SEO_DASHBOARD_CATEGORIES = [
  ...new Set(SEO_DASHBOARD_ALL_PAGES.map((p) => p.category).filter(Boolean)),
]

/** Backward-compatible subsets used in older admin UI. */
export const SEO_DASHBOARD_SERVICES = SEO_DASHBOARD_ALL_PAGES.filter((p) => p.category === 'Main services')
export const SEO_DASHBOARD_CITIES = SEO_DASHBOARD_ALL_PAGES.filter((p) => p.category === 'City removals')

/** @param {string} pageSlug */
export function getSeoDashboardPageDef(pageSlug) {
  const direct = SEO_DASHBOARD_ALL_PAGES.find((p) => p.pageSlug === pageSlug)
  if (direct) return direct
  return SEO_DASHBOARD_ALL_PAGES.find((p) => LEGACY_CITY_SLUG_BY_PATH[p.path] === pageSlug) ?? null
}

/** @param {string} path */
export function getSeoDashboardPageDefByPath(path) {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '')
  return SEO_DASHBOARD_ALL_PAGES.find((p) => p.path === normalized) ?? null
}

/**
 * @param {Map<string, import('./seoSettingsDefaults').SeoSettingsRow>|null|undefined} map
 * @param {SeoDashboardPageDef} def
 */
export function getSavedSeoRowForDef(map, def) {
  if (!map) return null
  const primary = map.get(def.pageSlug)
  if (primary) return primary
  const legacySlug = LEGACY_CITY_SLUG_BY_PATH[def.path]
  if (legacySlug) return map.get(legacySlug) ?? null
  return null
}
