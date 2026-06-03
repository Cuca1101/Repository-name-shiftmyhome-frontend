/**
 * Verify every sitemap route in dist/ has a self-referencing canonical tag.
 */
import fs from 'node:fs'
import path from 'node:path'
import { SEO_SITE_ORIGIN } from '../src/data/seoPages.js'
import { buildPublicPageUrl } from '../src/lib/normalizePublicPath.js'

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

function extractCanonical(html) {
  const m =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i)
  return m ? m[1] : ''
}

const routes = readSitemapPaths()
const bad = []

for (const route of routes) {
  const file = distIndexPathForRoute(route)
  let html
  try {
    html = fs.readFileSync(file, 'utf8')
  } catch {
    bad.push({ route, issue: `missing file ${file}` })
    continue
  }
  const canon = extractCanonical(html)
  const expected = buildPublicPageUrl(SEO_SITE_ORIGIN, route)
  if (canon !== expected) {
    bad.push({ route, canon, expected })
  }
}

console.log(`Checked ${routes.length} sitemap routes`)
if (bad.length) {
  console.error(`Canonical mismatches: ${bad.length}`)
  console.error(JSON.stringify(bad.slice(0, 25), null, 2))
  process.exit(1)
}
console.log('All canonical tags self-reference correctly.')
