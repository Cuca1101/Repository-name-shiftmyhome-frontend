/**
 * Live production route verification (HTTP status + page title).
 */
const ROUTES = [
  '/glasgow-removals',
  '/glasgow-removals/',
  '/edinburgh-removals',
  '/edinburgh-removals/',
  '/aberdeen-removals',
  '/aberdeen-removals/',
  '/dundee-removals',
  '/dundee-removals/',
  '/inverness-removals',
  '/inverness-removals/',
]

const ORIGIN = 'https://www.shiftmyhome.co.uk'

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

const results = []
for (const path of ROUTES) {
  const url = `${ORIGIN}${path}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const html = await res.text()
    const title = extractTitle(html)
    const is404 = /Page Not Found/i.test(title) || /Page not found/i.test(html)
    results.push({
      url,
      status: res.status,
      finalUrl: res.url,
      title,
      is404Page: is404,
      hasRemovalsContent: /Removals/i.test(title) && !is404,
    })
  } catch (error) {
    results.push({ url, error: String(error) })
  }
}

const bad = results.filter((r) => r.is404Page || r.status !== 200 || !r.hasRemovalsContent)
console.log(JSON.stringify({ ok: bad.length === 0, results, failed: bad }, null, 2))
process.exit(bad.length === 0 ? 0 : 1)
