import fs from 'fs'

const xml = fs.readFileSync('public/sitemap.xml', 'utf8')
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter(Boolean)

const badTitles = new Set(['ShiftMyHome', 'Professional Removals', 'Removals Scotland'])
const seenTitle = new Map()
const seenDesc = new Map()
const pages = []

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

function hasServiceAndLocation(title) {
  return /(\b(removals?|man and van|furniture delivery|student moves?|same day removals?)\b).*(\b(glasgow|edinburgh|aberdeen|dundee|paisley|perth|stirling|scotland)\b)|(\b(glasgow|edinburgh|aberdeen|dundee|paisley|perth|stirling|scotland)\b).*(\b(removals?|man and van|furniture delivery|student moves?|same day removals?)\b)/i.test(
    title,
  )
}

for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const html = await res.text()
    const title = extractTitle(html)
    const description = extractMetaDescription(html)
    const h1s = extractH1s(html)

    const titleWeak =
      !title || badTitles.has(title) || !title.includes('ShiftMyHome') || title.length < 20
    const titleGood = !titleWeak && hasServiceAndLocation(title)
    const descWeak = !description || description.length < 70 || description.length > 180
    const oneH1 = h1s.length === 1

    pages.push({
      url,
      status: res.status,
      title,
      description,
      h1Count: h1s.length,
      h1: h1s[0] || '',
      titleGood,
      titleWeak,
      descWeak,
      oneH1,
    })

    if (title) seenTitle.set(title, (seenTitle.get(title) || 0) + 1)
    if (description) seenDesc.set(description, (seenDesc.get(description) || 0) + 1)
  } catch (error) {
    pages.push({
      url,
      error: String(error),
      title: '',
      description: '',
      h1Count: 0,
      h1: '',
      titleGood: false,
      titleWeak: true,
      descWeak: true,
      oneH1: false,
    })
  }
}

const duplicateTitles = [...seenTitle.entries()]
  .filter(([, count]) => count > 1)
  .map(([value, count]) => ({ value, count }))
const duplicateDescriptions = [...seenDesc.entries()]
  .filter(([, count]) => count > 1)
  .map(([value, count]) => ({ value, count }))

const duplicateTitleSet = new Set(duplicateTitles.map((d) => d.value))
const duplicateDescSet = new Set(duplicateDescriptions.map((d) => d.value))

const pagesNeedFix = pages.filter(
  (p) =>
    p.error ||
    !p.titleGood ||
    p.descWeak ||
    !p.oneH1 ||
    duplicateTitleSet.has(p.title) ||
    duplicateDescSet.has(p.description),
)

const summary = {
  totalSitemapUrls: urls.length,
  pagesWithGoodSeoTitles: pages.filter((p) => p.titleGood).length,
  pagesWithMissingOrWeakTitles: pages.filter((p) => p.titleWeak).length,
  duplicateTitleGroups: duplicateTitles.length,
  duplicateMetaDescriptionGroups: duplicateDescriptions.length,
  pagesThatNeedFixing: pagesNeedFix.length,
}

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  duplicateTitles,
  duplicateDescriptions,
  pagesNeedFix,
  pages,
}

fs.writeFileSync('seo-audit-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(summary, null, 2))
