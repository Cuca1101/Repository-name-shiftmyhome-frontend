/**
 * Append 301 redirects for legacy / alternate SEO URLs so Google stops seeing hard 404s.
 * Rules are written before admin SPA proxy so Cloudflare applies them as static redirects.
 *
 * Patterns:
 * - /removals-{city}        → /{city}-removals/
 * - /house-removals-{city}  → /{city}-removals/
 * - /removal-{city}         → /{city}-removals/
 * - /man-and-van-{city}     → /man-with-van-{city}/  (priority cities)
 * - /{city}-man-and-van     → /man-with-van-{city}/
 * - /{city}-man-with-van    → /man-with-van-{city}/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCOTLAND_LOCATION_NAMES, MAN_WITH_VAN_SEO_CITIES } from '../src/lib/seo/locations.js'
import { cityToSlug } from '../src/lib/citySlug.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const redirectsPath = path.join(root, 'public', '_redirects')

const MARKER_START = '# BEGIN legacy city canonical redirects (auto-generated)'
const MARKER_END = '# END legacy city canonical redirects (auto-generated)'

const ADMIN_BLOCK = `# Admin SPA - must stay on index.html
/admin    /index.html    200
/admin/*  /index.html    200
`

/** Dynamic customer SPA routes (email deep links) — serve React shell, not 404.html */
const CUSTOMER_SPA_BLOCK = `# Customer SPA routes (resume / pay / track / payment result)
/quote/resume/:token  /index.html  200
/quote/pay/:token     /index.html  200
/track/:token         /index.html  200
/track/:token/feedback /index.html  200
/track/:token/tip     /index.html  200
/payment-success      /index.html  200
/payment-success/     /index.html  200
/payment-cancelled    /index.html  200
/payment-cancelled/   /index.html  200
`

/** @param {string} from @param {string} to */
function addPair(lines, from, to) {
  lines.push(`${from} ${to} 301`)
  lines.push(`${from}/ ${to} 301`)
}

const legacyLines = []

for (const city of SCOTLAND_LOCATION_NAMES) {
  const slug = cityToSlug(city)
  const canonicalRemovals = `/${slug}-removals/`
  addPair(legacyLines, `/removals-${slug}`, canonicalRemovals)
  addPair(legacyLines, `/house-removals-${slug}`, canonicalRemovals)
  addPair(legacyLines, `/removal-${slug}`, canonicalRemovals)
}

for (const city of MAN_WITH_VAN_SEO_CITIES) {
  const slug = cityToSlug(city)
  const canonicalMwv = `/man-with-van-${slug}/`
  addPair(legacyLines, `/man-and-van-${slug}`, canonicalMwv)
  addPair(legacyLines, `/${slug}-man-and-van`, canonicalMwv)
  addPair(legacyLines, `/${slug}-man-with-van`, canonicalMwv)
}

const generatedBlock = [MARKER_START, ...legacyLines, MARKER_END].join('\n')

const header = `# Prerendered HTML lives at /<route>/index.html (Cloudflare adds trailing slashes).
# Do NOT use "/* /404.html 404" - it can override asset serving on some hosts.
# Missing paths are handled by dist/404.html via the platform not_found behaviour.
`

let content = `${header.trim()}\n\n${generatedBlock}\n\n${CUSTOMER_SPA_BLOCK.trim()}\n\n${ADMIN_BLOCK.trim()}\n`
content = content.replace(/\r\n/g, '\n')

fs.writeFileSync(redirectsPath, content, 'utf8')
console.log(
  `Legacy SEO redirects written (${legacyLines.length} rules: removals aliases + man-and-van aliases)`,
)
