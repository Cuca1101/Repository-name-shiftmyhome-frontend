/**
 * Live production redirect verification for legacy /removals-{city} URLs.
 */
import fs from 'node:fs'
import { SCOTLAND_LOCATION_NAMES } from '../src/lib/seo/locations.js'
import { cityToSlug } from '../src/lib/citySlug.js'

const ORIGIN = 'https://www.shiftmyhome.co.uk'

const SAMPLE_PATHS = [
  '/removals-glasgow',
  '/removals-glasgow/',
  '/removals-edinburgh',
  '/removals-edinburgh/',
  '/removals-aberdeen',
  '/removals-aberdeen/',
  '/removals-dundee',
  '/removals-dundee/',
  '/removals-inverness',
  '/removals-inverness/',
]

function expectedDestination(path) {
  const clean = path.replace(/\/+$/, '')
  const match = clean.match(/^\/removals-([a-z0-9-]+)$/)
  if (!match) return null
  return `${ORIGIN}/${match[1]}-removals/`
}

async function checkRedirect(path) {
  const url = `${ORIGIN}${path}`
  const expected = expectedDestination(path)
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location') || ''
    const normalizedLocation = location.startsWith('http')
      ? location
      : location
        ? `${ORIGIN}${location.startsWith('/') ? '' : '/'}${location}`
        : ''
    const ok = res.status === 301 && normalizedLocation === expected
    return {
      from: path,
      status: res.status,
      location: normalizedLocation || null,
      expected,
      ok,
    }
  } catch (error) {
    return { from: path, expected, ok: false, error: String(error) }
  }
}

const sampleResults = []
for (const path of SAMPLE_PATHS) {
  sampleResults.push(await checkRedirect(path))
}

const allLegacyPaths = []
for (const city of SCOTLAND_LOCATION_NAMES) {
  const slug = cityToSlug(city)
  allLegacyPaths.push(`/removals-${slug}`)
  allLegacyPaths.push(`/removals-${slug}/`)
}

let fullPassCount = 0
const fullFailures = []
for (const path of allLegacyPaths) {
  const result = await checkRedirect(path)
  if (result.ok) fullPassCount++
  else fullFailures.push(result)
}

const report = {
  auditedAt: new Date().toISOString(),
  productionOrigin: ORIGIN,
  summary: {
    sampleTested: sampleResults.length,
    samplePassing: sampleResults.filter((r) => r.ok).length,
    sampleFailing: sampleResults.filter((r) => !r.ok).length,
    totalLegacyRulesExpected: allLegacyPaths.length,
    totalLegacyRulesPassing: fullPassCount,
    totalLegacyRulesFailing: fullFailures.length,
    allLegacyRedirectsWorking: fullFailures.length === 0,
  },
  cloudflareChecks: {
    redirectsFileFormat: 'ASCII comments, LF line endings, /source /destination 301',
    redirectsPublishRoot: 'dist/_redirects copied post-build via ensure-dist-redirects.mjs',
    pagesFunctionFallback: 'functions/_middleware.js with public/_routes.json include /removals-*',
  },
  sampleResults,
  failures: fullFailures.slice(0, 25),
}

fs.writeFileSync('redirect-verification-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))

if (!report.summary.allLegacyRedirectsWorking) {
  process.exit(1)
}
