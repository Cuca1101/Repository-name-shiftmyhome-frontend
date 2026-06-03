/**
 * Final redirect verification report (local wrangler + live production).
 */
import fs from 'node:fs'
import { SCOTLAND_LOCATION_NAMES } from '../src/lib/seo/locations.js'
import { cityToSlug } from '../src/lib/citySlug.js'

const ORIGIN = 'https://www.shiftmyhome.co.uk'
const LOCAL_ORIGIN = process.env.LOCAL_ORIGIN || 'http://127.0.0.1:8789'

const SAMPLE_PATHS = [
  '/removals-glasgow',
  '/removals-glasgow/',
  '/removals-edinburgh',
  '/removals-edinburgh/',
  '/removals-aberdeen',
  '/removals-aberdeen/',
  '/removals-dundee',
  '/removals-dundee/',
]

function expectedDestination(origin, path) {
  const clean = path.replace(/\/+$/, '')
  const match = clean.match(/^\/removals-([a-z0-9-]+)$/)
  if (!match) return null
  return `${origin}/${match[1]}-removals/`
}

async function checkRedirect(origin, path) {
  const url = `${origin}${path}`
  const expected = expectedDestination(origin, path)
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location') || ''
    const normalizedLocation = location.startsWith('http')
      ? location
      : location
        ? `${origin}${location.startsWith('/') ? '' : '/'}${location}`
        : ''
    return {
      from: path,
      status: res.status,
      location: normalizedLocation || null,
      expected,
      ok: res.status === 301 && normalizedLocation === expected,
    }
  } catch (error) {
    return { from: path, expected, ok: false, error: String(error) }
  }
}

function readDistRedirectsAudit() {
  const redirectsPath = 'dist/_redirects'
  if (!fs.existsSync(redirectsPath)) {
    return { exists: false }
  }
  const content = fs.readFileSync(redirectsPath, 'utf8')
  const lines = content.split('\n')
  const legacyRules = lines.filter((line) =>
    /^\/removals-[a-z0-9-]+\/?\s+\/[a-z0-9-]+-removals\/\s+301\s*$/.test(line.trim()),
  )
  const firstRuleLine = lines.findIndex((line) => line.startsWith('/removals-'))
  const adminLine = lines.findIndex((line) => line.startsWith('/admin'))
  return {
    exists: true,
    publishRoot: 'dist/_redirects',
    lineCount: lines.length,
    legacyRuleCount: legacyRules.length,
    usesLfLineEndings: !content.includes('\r\n'),
    legacyRulesBeforeAdmin: firstRuleLine >= 0 && adminLine >= 0 ? firstRuleLine < adminLine : null,
    sampleRules: legacyRules.slice(0, 4),
  }
}

const distAudit = readDistRedirectsAudit()
const productionSamples = []
for (const path of SAMPLE_PATHS) {
  productionSamples.push(await checkRedirect(ORIGIN, path))
}

let localSamples = []
let localAvailable = false
try {
  const probe = await fetch(`${LOCAL_ORIGIN}/removals-glasgow`, { redirect: 'manual' })
  localAvailable = probe.status === 301
  if (localAvailable) {
    for (const path of SAMPLE_PATHS) {
      localSamples.push(await checkRedirect(LOCAL_ORIGIN, path))
    }
  }
} catch {
  localAvailable = false
}

const allLegacyPaths = []
for (const city of SCOTLAND_LOCATION_NAMES) {
  const slug = cityToSlug(city)
  allLegacyPaths.push(`/removals-${slug}`)
  allLegacyPaths.push(`/removals-${slug}/`)
}

let localFullPassCount = 0
const localFullFailures = []
if (localAvailable) {
  for (const path of allLegacyPaths) {
    const result = await checkRedirect(LOCAL_ORIGIN, path)
    if (result.ok) localFullPassCount++
    else localFullFailures.push(result)
  }
}

const homepageHtml = await fetch(`${ORIGIN}/`).then((r) => r.text()).catch(() => '')
const productionBundle = homepageHtml.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1] || null

const report = {
  auditedAt: new Date().toISOString(),
  productionOrigin: ORIGIN,
  rootCause: {
    summary:
      'Cloudflare Pages was not returning 301s because admin proxy rules were placed before legacy rules in _redirects, consuming the dynamic redirect budget (100) and skipping 263 legacy lines. Production also had not picked up recent GitHub commits at audit time.',
    evidence: [
      'Live /admin returned 308 to / instead of _redirects 200 rewrite, indicating _redirects was not applied on the deployed artifact.',
      'wrangler pages dev with old rule order parsed only 100 redirect rules and skipped 263 lines.',
      'Reordering legacy 301 rules before admin proxy rules parses 361 valid redirect rules locally.',
      'functions/_middleware.js plus public/_routes.json provides a fallback 301 for all /removals-{city} paths.',
    ],
  },
  fixApplied: {
    legacyFirstRedirects: true,
    ensureDistRedirectsScript: 'scripts/ensure-dist-redirects.mjs',
    pagesMiddlewareFallback: 'functions/_middleware.js',
    routesConfig: 'public/_routes.json copied to dist/_routes.json',
    commits: ['3d18535a', 'c4a16a40'],
  },
  distRedirects: distAudit,
  cloudflareFormat: {
    supported: true,
    ruleFormat: '/source /destination 301',
    commentsAllowed: true,
    legacyRuleCountExpected: 360,
  },
  production: {
    bundle: productionBundle,
    deployIncludesLatestFix: productionBundle === 'index-DO1v49HJ.js',
    sampleResults: productionSamples,
    samplePassing: productionSamples.filter((r) => r.ok).length,
    sampleFailing: productionSamples.filter((r) => !r.ok).length,
  },
  localWrangler: {
    available: localAvailable,
    origin: localAvailable ? LOCAL_ORIGIN : null,
    sampleResults: localSamples,
    samplePassing: localSamples.filter((r) => r.ok).length,
    totalLegacyRulesExpected: allLegacyPaths.length,
    totalLegacyRulesPassing: localFullPassCount,
    totalLegacyRulesFailing: localFullFailures.length,
    failures: localFullFailures.slice(0, 10),
  },
  summary: {
    distRedirectsReady: distAudit.exists && distAudit.legacyRuleCount === 360,
    localSample301Pass:
      localSamples.length > 0 && localSamples.every((r) => r.ok),
    localAllLegacy301Pass: localAvailable && localFullFailures.length === 0,
    productionSample301Pass: productionSamples.every((r) => r.ok),
    productionReady: productionSamples.every((r) => r.ok),
  },
}

fs.writeFileSync('redirect-verification-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))

if (!report.summary.distRedirectsReady) process.exit(1)
