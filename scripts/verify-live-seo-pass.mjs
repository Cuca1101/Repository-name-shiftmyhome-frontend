/**
 * Live production SEO verification for post-deploy checks.
 */
const ORIGIN = 'https://www.shiftmyhome.co.uk'

const ROUTES = [
  { path: '/glasgow-removals/', city: true },
  { path: '/edinburgh-removals/', city: true },
  { path: '/aberdeen-removals/', city: true },
  { path: '/inverness-removals/', city: true },
  { path: '/coverage', city: false },
]

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function extract(html, pattern) {
  const m = html.match(pattern)
  return m ? decodeHtmlEntities(m[1].replace(/\s+/g, ' ').trim()) : ''
}

function hasSchema(html, type) {
  return html.includes(`"@type":"${type}"`) || html.includes(`"@type": "${type}"`)
}

function countSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>/g)].length
}

const sitemapRes = await fetch(`${ORIGIN}/sitemap.xml`)
const sitemapXml = await sitemapRes.text()
const sitemapCount = countSitemapUrls(sitemapXml)

const pages = []
let allOk = true

for (const { path, city } of ROUTES) {
  const url = `${ORIGIN}${path}`
  const res = await fetch(url, { redirect: 'follow' })
  const html = await res.text()
  const title = extract(html, /<title>([^<]*)<\/title>/i)
  const description = extract(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
  const canonical = extract(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  const h1 = extract(html, /<h1[^>]*>([^<]*)<\/h1>/i)

  const prerenderTextLen = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length

  const checks = {
    status200: res.status === 200,
    titleUnder60: title.length > 0 && title.length <= 60,
    desc120to160: description.length >= 120 && description.length <= 160,
    canonicalPresent: canonical.length > 0,
    h1Present: h1.length > 0 && !/sr-only/i.test(h1),
    prerenderMain: html.includes('id="seo-prerender-content"'),
    prerenderTextRich: city ? prerenderTextLen >= 2000 : prerenderTextLen >= 400,
    faqSchema: hasSchema(html, 'FAQPage'),
    breadcrumbSchema: hasSchema(html, 'BreadcrumbList'),
    localBusinessSchema: city ? hasSchema(html, 'LocalBusiness') : true,
    not404Title: !/Page Not Found/i.test(title),
    not404H1: !/page not found/i.test(h1),
  }

  const ok = Object.values(checks).every(Boolean)
  if (!ok) allOk = false

  pages.push({
    url: res.url,
    title,
    titleLen: title.length,
    description,
    descLen: description.length,
    canonical,
    h1,
    checks,
    ok,
  })
}

const hydrationCheck = pages.every((p) => p.checks.not404Title && p.checks.not404H1 && p.checks.status200)

const report = {
  ok: allOk && sitemapCount === 306 && hydrationCheck,
  sitemapUrlCount: sitemapCount,
  sitemapOk: sitemapCount === 306,
  hydrationOk: hydrationCheck,
  pages,
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
