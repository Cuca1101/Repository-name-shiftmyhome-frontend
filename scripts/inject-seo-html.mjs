/**
 * Build-time SEO HTML injection for every sitemap URL.
 * Writes dist/<route>/index.html with title, meta, canonical, JSON-LD, and crawlable body links.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildSitemapXml, SITEMAP_EXCLUDED_PATHS } from '../src/lib/generateSitemapXml.js'
import { getSeoPrerenderPayload } from '../src/lib/seoPrerender.js'
import { getRouteSeoMetadata } from '../src/lib/seoRouteMetadata.js'
import { buildSiteBrandHeadHtml } from '../src/lib/siteBrandMeta.js'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function distIndexPathForRoute(routePath) {
  const clean = routePath === '/' ? '/' : routePath.replace(/\/+$/, '')
  if (clean === '/') return path.join('dist', 'index.html')
  if (clean === '/404') return path.join('dist', '404.html')
  return path.join('dist', clean.replace(/^\//, ''), 'index.html')
}

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i')
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`
  if (re.test(html)) return html.replace(re, tag)
  return html.replace(/<\/head>/i, `  ${tag}\n  </head>`)
}

function ensureBrandHead(html) {
  if (html.includes('data-seo-brand="1"')) return html
  return html.replace(/<\/head>/i, `${buildSiteBrandHeadHtml()}\n  </head>`)
}

function injectJsonLdScripts(html, jsonLdList) {
  let out = html
  for (const data of jsonLdList) {
    if (!data) continue
    const json = JSON.stringify(data).replace(/</g, '\\u003c')
    out = out.replace(/<\/head>/i, `  <script type="application/ld+json">${json}</script>\n  </head>`)
  }
  return out
}

function injectSeoIntoHtml(template, payload) {
  const { meta, jsonLd, staticBodyHtml } = payload
  let html = ensureBrandHead(template)

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  html = upsertMeta(html, 'name', 'description', meta.description)
  html = html.replace(
    /<link[^>]+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`,
  )

  html = upsertMeta(html, 'property', 'og:title', meta.ogTitle || meta.title)
  html = upsertMeta(html, 'property', 'og:description', meta.ogDescription || meta.description)
  html = upsertMeta(html, 'property', 'og:url', meta.canonicalUrl)
  html = upsertMeta(html, 'property', 'og:type', 'website')
  html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image')
  html = upsertMeta(html, 'name', 'twitter:title', meta.ogTitle || meta.title)
  html = upsertMeta(html, 'name', 'twitter:description', meta.ogDescription || meta.description)

  if (meta.robots) {
    html = upsertMeta(html, 'name', 'robots', meta.robots)
  }

  html = injectJsonLdScripts(html, jsonLd)

  const body = staticBodyHtml || `<h1 class="sr-only">${escapeHtml(meta.h1)}</h1>`
  if (/<div id="root">[\s\S]*?<\/div>/.test(html)) {
    html = html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${body}</div>`)
  } else {
    html = html.replace(/<div id="root">/, `<div id="root">${body}`)
  }

  return html
}

const templatePath = path.join('dist', 'index.html')
if (!fs.existsSync(templatePath)) {
  console.error('dist/index.html not found — run vite build first')
  process.exit(1)
}

const template = fs.readFileSync(templatePath, 'utf8')

const { paths } = buildSitemapXml()
const injectPaths = [...paths, ...SITEMAP_EXCLUDED_PATHS]
let written = 0

for (const route of injectPaths) {
  const payload = getSeoPrerenderPayload(route)
  const html = injectSeoIntoHtml(template, payload)
  const outPath = distIndexPathForRoute(route)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  written++
}

const notFoundMeta = {
  ...getRouteSeoMetadata('/404'),
  robots: 'noindex, nofollow',
  canonicalUrl: 'https://www.shiftmyhome.co.uk/404',
}
const notFoundHtml = injectSeoIntoHtml(template, {
  meta: notFoundMeta,
  jsonLd: [],
  staticBodyHtml: '<h1 class="sr-only">Page not found</h1>',
})
fs.writeFileSync(path.join('dist', '404.html'), notFoundHtml, 'utf8')
written++

console.log(`SEO HTML injected for ${written} routes (including 404.html)`)
