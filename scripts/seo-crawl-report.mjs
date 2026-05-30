/**
 * Post-build SEO crawl report: schema, duplicates, orphans, city coverage.
 */
import fs from 'node:fs'
import path from 'node:path'
import { SCOTLAND_LOCATION_NAMES } from '../src/lib/seo/locations.js'
import { cityToSlug } from '../src/lib/citySlug.js'
import { SEO_PAGE_PATHS } from '../src/data/seoPages.js'

function readSitemapPaths() {
  const xml = fs.readFileSync('public/sitemap.xml', 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => {
      try {
        return new URL(m[1]).pathname.replace(/\/+$/, '') || '/'
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function distIndexPathForRoute(routePath) {
  const clean = routePath === '/' ? '/' : routePath.replace(/\/+$/, '')
  if (clean === '/') return path.join('dist', 'index.html')
  return path.join('dist', clean.replace(/^\//, ''), 'index.html')
}

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return normalize(m ? m[1] : '')
}

function extractMetaDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
  if (!m) return ''
  const content = m[0].match(/content=["']([\s\S]*?)["']/i)
  return normalize(content ? content[1] : '')
}

function hasSchemaType(html, type) {
  return html.includes(`"@type":"${type}"`) || html.includes(`"@type": "${type}"`)
}

function extractInternalHrefs(html) {
  return [
    ...html.matchAll(/<a\s+[^>]*href=["'](\/[^"'#?]*)["']/gi),
  ].map((m) => m[1].replace(/\/+$/, '') || '/')
}

const routes = readSitemapPaths()
const cityRemovalPaths = SCOTLAND_LOCATION_NAMES.map((c) => `/${cityToSlug(c)}-removals`)
const seoPathSet = new Set(SEO_PAGE_PATHS)

const pages = []
const seenTitle = new Map()
const seenDesc = new Map()
const allOutbound = new Set()

for (const route of routes) {
  const file = distIndexPathForRoute(route)
  let html = ''
  let error = ''
  try {
    html = fs.readFileSync(file, 'utf8')
  } catch {
    error = `Missing file: ${file}`
  }

  const title = html ? extractTitle(html) : ''
  const description = html ? extractMetaDescription(html) : ''
  const isCityRemovals = cityRemovalPaths.includes(route)
  const isSeoLanding = seoPathSet.has(route)

  const schema = {
    breadcrumb: html ? hasSchemaType(html, 'BreadcrumbList') : false,
    faq: html ? hasSchemaType(html, 'FAQPage') : false,
    localBusiness: html ? hasSchemaType(html, 'LocalBusiness') : false,
  }

  const hasCanonical = html.includes('rel="canonical"')
  const hasPrerenderNav = html.includes('id="seo-prerender-nav"')
  const internalLinks = html ? extractInternalHrefs(html) : []
  internalLinks.forEach((href) => allOutbound.add(href))

  if (title) seenTitle.set(title, (seenTitle.get(title) || 0) + 1)
  if (description) seenDesc.set(description, (seenDesc.get(description) || 0) + 1)

  const missingSchema = []
  if (isSeoLanding && !schema.breadcrumb) missingSchema.push('BreadcrumbList')
  if (isSeoLanding && !schema.faq) missingSchema.push('FAQPage')
  if (isCityRemovals && !schema.localBusiness) missingSchema.push('LocalBusiness')
  if (!title) missingSchema.push('title')
  if (!description) missingSchema.push('meta description')
  if (!hasCanonical) missingSchema.push('canonical')

  pages.push({
    route,
    isCityRemovals,
    isSeoLanding,
    error: error || undefined,
    title,
    description,
    schema,
    hasPrerenderNav,
    internalLinkCount: internalLinks.length,
    missingSchema,
  })
}

const duplicateTitles = [...seenTitle.entries()].filter(([, c]) => c > 1).map(([value, count]) => ({ value, count }))
const duplicateDescriptions = [...seenDesc.entries()].filter(([, c]) => c > 1).map(([value, count]) => ({ value, count }))

const sitemapPathSet = new Set(routes)
const inbound = new Map(routes.map((r) => [r, 0]))
for (const href of allOutbound) {
  const normalized = href.replace(/\/+$/, '') || '/'
  if (inbound.has(normalized)) inbound.set(normalized, (inbound.get(normalized) || 0) + 1)
}

const orphanPages = routes.filter((r) => r !== '/' && (inbound.get(r) || 0) === 0)

const cityPages = pages.filter((p) => p.isCityRemovals)
const cityMissingSchema = cityPages.filter((p) => p.missingSchema.length > 0)

const cityTitleCounts = new Map()
const cityDescCounts = new Map()
for (const p of cityPages) {
  if (p.title) cityTitleCounts.set(p.title, (cityTitleCounts.get(p.title) || 0) + 1)
  if (p.description) cityDescCounts.set(p.description, (cityDescCounts.get(p.description) || 0) + 1)
}
const cityDuplicateTitles = [...cityTitleCounts.entries()].filter(([, c]) => c > 1)
const cityDuplicateDescriptions = [...cityDescCounts.entries()].filter(([, c]) => c > 1)
const cityInternalLinks = cityPages.map((p) => p.internalLinkCount)
const avgCityInternalLinks =
  cityInternalLinks.length > 0
    ? Math.round(cityInternalLinks.reduce((a, b) => a + b, 0) / cityInternalLinks.length)
    : 0

const beforePath = 'seo-crawl-report-before.json'
const before = fs.existsSync(beforePath) ? JSON.parse(fs.readFileSync(beforePath, 'utf8')) : null

const report = {
  generatedAt: new Date().toISOString(),
  productionUrl: 'https://www.shiftmyhome.co.uk',
  summary: {
    sitemapUrlCount: routes.length,
    cityPagesOptimised: cityPages.filter((p) => !p.error && p.missingSchema.length === 0).length,
    indexedCityRemovalPages: cityPages.length,
    expectedCityPages: SCOTLAND_LOCATION_NAMES.length,
    pagesWithMissingSchema: pages.filter((p) => p.missingSchema.length > 0).length,
    cityPagesWithMissingSchema: cityMissingSchema.length,
    duplicateTitleGroups: duplicateTitles.length,
    duplicateMetaDescriptionGroups: duplicateDescriptions.length,
    cityPagesWithDuplicateTitles: cityDuplicateTitles.length,
    cityPagesWithDuplicateDescriptions: cityDuplicateDescriptions.length,
    averageInternalLinksPerCityPage: avgCityInternalLinks,
    minInternalLinksPerCityPage: cityInternalLinks.length ? Math.min(...cityInternalLinks) : 0,
    maxInternalLinksPerCityPage: cityInternalLinks.length ? Math.max(...cityInternalLinks) : 0,
    orphanPages: orphanPages.length,
    seoLandingWithPrerenderNav: pages.filter((p) => p.isSeoLanding && p.hasPrerenderNav).length,
    homepageHasCityPrerenderNav: pages.find((p) => p.route === '/')?.internalLinkCount > 10,
    coverageHasCityPrerenderNav: pages.find((p) => p.route === '/coverage')?.internalLinkCount > 100,
  },
  duplicateTitles,
  duplicateDescriptions,
  cityDuplicateTitles: cityDuplicateTitles.map(([value, count]) => ({ value, count })),
  cityDuplicateDescriptions: cityDuplicateDescriptions.map(([value, count]) => ({ value, count })),
  orphanPages: orphanPages.slice(0, 50),
  cityMissingSchemaSample: cityMissingSchema.slice(0, 20).map((p) => ({
    route: p.route,
    missingSchema: p.missingSchema,
  })),
  beforeComparison: before
    ? {
        previousGeneratedAt: before.generatedAt,
        previousSitemapUrlCount: before.summary?.sitemapUrlCount,
        previousMissingSchema: before.summary?.pagesWithMissingSchema,
        previousOrphans: before.summary?.orphanPages,
      }
    : null,
}

fs.writeFileSync('seo-crawl-report.json', JSON.stringify(report, null, 2))
if (!fs.existsSync(beforePath)) {
  fs.writeFileSync(beforePath, JSON.stringify({ ...report, note: 'Baseline captured before prerender schema deploy' }, null, 2))
}

console.log(JSON.stringify(report.summary, null, 2))
