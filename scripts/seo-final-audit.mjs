/**
 * Post-build final SEO audit: title/description limits, schema, duplicates, city word counts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { ALL_SEO_PAGES } from '../src/data/seoPages.js'
import { SCOTLAND_LOCATION_NAMES } from '../src/lib/seo/locations.js'
import { cityToSlug } from '../src/lib/citySlug.js'

const TITLE_MAX = 60
const DESC_MIN = 120
const DESC_MAX = 160
const PRODUCTION_URL = 'https://www.shiftmyhome.co.uk'

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

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return normalize(decodeHtmlEntities(m ? m[1] : ''))
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function extractMetaDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
  if (!m) return ''
  const content = m[0].match(/content=["']([\s\S]*?)["']/i)
  return normalize(decodeHtmlEntities(content ? content[1] : ''))
}

function extractH1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => normalize(m[1].replace(/<[^>]*>/g, '')))
    .filter(Boolean)
}

function hasSchemaType(html, type) {
  return html.includes(`"@type":"${type}"`) || html.includes(`"@type": "${type}"`)
}

function distIndexPathForRoute(routePath) {
  const clean = routePath === '/' ? '/' : routePath.replace(/\/+$/, '')
  if (clean === '/') return path.join('dist', 'index.html')
  return path.join('dist', clean.replace(/^\//, ''), 'index.html')
}

function countWords(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

/** @param {import('../src/data/seoPages.js').SeoPageConfig} page */
function seoPageWordCount(page) {
  const chunks = [
    page.intro,
    page.introSecondary,
    page.heroTeaser,
    page.keywordSentence,
    ...(page.serviceBullets || []),
    ...(page.bodySections || []).flatMap((s) => [s.heading, ...(s.paragraphs || [])]),
    ...(page.faqs || []).flatMap((f) => [f.q, f.a]),
  ]
  return countWords(chunks.join(' '))
}

let commitHash = 'unknown'
try {
  commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
} catch {
  /* ignore */
}

const routes = readSitemapPaths()
const cityRemovalPaths = new Set(
  SCOTLAND_LOCATION_NAMES.map((c) => `/${cityToSlug(c)}-removals`),
)
const seoByPath = new Map(ALL_SEO_PAGES.map((p) => [p.path, p]))

const pages = []
const seenTitle = new Map()
const seenDesc = new Map()

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
  const h1s = html ? extractH1s(html) : []
  const isCityRemovals = cityRemovalPaths.has(route)
  const config = seoByPath.get(route)

  const schema = {
    breadcrumb: html ? hasSchemaType(html, 'BreadcrumbList') : false,
    faq: html ? hasSchemaType(html, 'FAQPage') : false,
    localBusiness: html ? hasSchemaType(html, 'LocalBusiness') : false,
  }

  const missingSchema = []
  if (config && !schema.breadcrumb) missingSchema.push('BreadcrumbList')
  if (config && !schema.faq) missingSchema.push('FAQPage')
  if (isCityRemovals && !schema.localBusiness) missingSchema.push('LocalBusiness')
  if (!title) missingSchema.push('title')
  if (!description) missingSchema.push('meta description')

  const titleLen = title.length
  const descLen = description.length
  const titleOver60 = titleLen > TITLE_MAX
  const descOver160 = descLen > DESC_MAX
  const descUnder120 = descLen > 0 && descLen < DESC_MIN

  const h1 = h1s[0] || ''
  const cityName = config?.cityName || ''
  const primaryKeywordOk =
    !isCityRemovals ||
    (title.toLowerCase().includes(`${cityName.toLowerCase()} removals`) &&
      h1 === `${cityName} Removals`)

  if (title) seenTitle.set(title, (seenTitle.get(title) || 0) + 1)
  if (description) seenDesc.set(description, (seenDesc.get(description) || 0) + 1)

  pages.push({
    route,
    error: error || undefined,
    title,
    titleLen,
    titleOver60,
    description,
    descLen,
    descOver160,
    descUnder120,
    h1,
    h1Count: h1s.length,
    isCityRemovals,
    primaryKeywordOk,
    missingSchema,
    sourceWordCount: config ? seoPageWordCount(config) : null,
  })
}

const duplicateTitles = [...seenTitle.entries()].filter(([, c]) => c > 1).map(([value, count]) => ({ value, count }))
const duplicateDescriptions = [...seenDesc.entries()]
  .filter(([, c]) => c > 1)
  .map(([value, count]) => ({ value, count }))

const cityWordCounts = pages
  .filter((p) => p.isCityRemovals && p.sourceWordCount != null)
  .map((p) => p.sourceWordCount)

const report = {
  generatedAt: new Date().toISOString(),
  deploymentUrl: PRODUCTION_URL,
  commitHash,
  summary: {
    totalPagesAudited: pages.length,
    sitemapUrlCount: routes.length,
    titlesOver60Chars: pages.filter((p) => p.titleOver60).length,
    descriptionsOver160Chars: pages.filter((p) => p.descOver160).length,
    descriptionsUnder120Chars: pages.filter((p) => p.descUnder120).length,
    duplicateTitleGroups: duplicateTitles.length,
    duplicateDescriptionGroups: duplicateDescriptions.length,
    pagesMissingSchema: pages.filter((p) => p.missingSchema.length > 0).length,
    cityPagesMissingPrimaryKeyword: pages.filter((p) => p.isCityRemovals && !p.primaryKeywordOk).length,
    averageCityPageWordCount: cityWordCounts.length
      ? Math.round(cityWordCounts.reduce((a, b) => a + b, 0) / cityWordCounts.length)
      : 0,
    cityPagesUnder500Words: cityWordCounts.filter((n) => n < 500).length,
    cityPagesUnder800Words: cityWordCounts.filter((n) => n < 800).length,
    lowestCityPageWordCount: cityWordCounts.length ? Math.min(...cityWordCounts) : 0,
    highestCityPageWordCount: cityWordCounts.length ? Math.max(...cityWordCounts) : 0,
    missingPrerenderFiles: pages.filter((p) => p.error).length,
    pagesWithInvalidH1Count: pages.filter((p) => p.h1Count !== 1).length,
  },
  duplicateTitles,
  duplicateDescriptions,
  titleOver60Sample: pages.filter((p) => p.titleOver60).slice(0, 15),
  descOver160Sample: pages.filter((p) => p.descOver160).slice(0, 15),
  descUnder120Sample: pages.filter((p) => p.descUnder120).slice(0, 15),
  missingSchemaSample: pages.filter((p) => p.missingSchema.length > 0).slice(0, 20),
  cityWordCountSample: pages
    .filter((p) => p.isCityRemovals)
    .sort((a, b) => (a.sourceWordCount || 0) - (b.sourceWordCount || 0))
    .slice(0, 10)
    .map((p) => ({ route: p.route, words: p.sourceWordCount })),
}

fs.writeFileSync('seo-final-audit-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))
