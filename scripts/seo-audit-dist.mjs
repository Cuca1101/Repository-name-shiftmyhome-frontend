import fs from 'node:fs'
import path from 'node:path'

function readSitemapPaths() {
  const xml = fs.readFileSync('public/sitemap.xml', 'utf8')
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter(Boolean)
  return urls
    .map((u) => {
      try {
        return new URL(u).pathname || '/'
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const stripTags = (s) => normalize(String(s || '').replace(/<[^>]*>/g, ' '))

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

function extractH1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
}

function distIndexPathForRoute(routePath) {
  const clean = routePath === '/' ? '/' : routePath.replace(/\/+$/, '')
  if (clean === '/') return path.join('dist', 'index.html')
  return path.join('dist', clean.replace(/^\//, ''), 'index.html')
}

const routes = readSitemapPaths()
const pages = []
const seenTitle = new Map()
const seenDesc = new Map()

for (const route of routes) {
  const file = distIndexPathForRoute(route)
  let html = ''
  let error = ''
  try {
    html = fs.readFileSync(file, 'utf8')
  } catch (e) {
    error = `Missing prerendered file: ${file}`
  }

  const title = html ? extractTitle(html) : ''
  const description = html ? extractMetaDescription(html) : ''
  const h1s = html ? extractH1s(html) : []

  if (title) seenTitle.set(title, (seenTitle.get(title) || 0) + 1)
  if (description) seenDesc.set(description, (seenDesc.get(description) || 0) + 1)

  pages.push({
    route,
    file,
    error: error || undefined,
    title,
    description,
    h1Count: h1s.length,
    h1: h1s[0] || '',
  })
}

const duplicateTitles = [...seenTitle.entries()]
  .filter(([, count]) => count > 1)
  .map(([value, count]) => ({ value, count }))
const duplicateDescriptions = [...seenDesc.entries()]
  .filter(([, count]) => count > 1)
  .map(([value, count]) => ({ value, count }))

const missingTitle = pages.filter((p) => !p.title).length
const missingDescription = pages.filter((p) => !p.description).length
const missingOrMultiH1 = pages.filter((p) => p.h1Count !== 1).length
const missingFiles = pages.filter((p) => p.error).length

const goodSeoTitles = pages.filter(
  (p) =>
    p.title &&
    p.title.includes('ShiftMyHome') &&
    p.title.length >= 20 &&
    !duplicateTitles.some((d) => d.value === p.title && d.count > 1),
).length

const summary = {
  totalSitemapUrls: routes.length,
  pagesWithGoodSeoTitles: goodSeoTitles,
  pagesWithMissingOrWeakTitles: pages.filter((p) => !p.title || !p.title.includes('ShiftMyHome')).length,
  missingFiles,
  missingTitle,
  missingDescription,
  pagesWithExactlyOneH1: pages.filter((p) => p.h1Count === 1).length,
  pagesWithInvalidH1Count: missingOrMultiH1,
  duplicateTitleGroups: duplicateTitles.length,
  duplicateMetaDescriptionGroups: duplicateDescriptions.length,
  pagesThatNeedFixing: pages.filter(
    (p) =>
      p.error ||
      !p.title ||
      !p.description ||
      p.h1Count !== 1 ||
      duplicateTitles.some((d) => d.value === p.title),
      duplicateDescriptions.some((d) => d.value === p.description),
  ).length,
}

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  duplicateTitles,
  duplicateDescriptions,
  pages: pages.slice(0, 2000), // keep file reasonable; full detail can be re-run if needed
}

fs.writeFileSync('seo-audit-dist-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(summary, null, 2))
