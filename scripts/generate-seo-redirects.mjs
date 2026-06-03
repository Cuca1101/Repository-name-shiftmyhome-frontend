/**
 * Append 301 redirects for legacy inverted city URLs (e.g. /removals-glasgow -> /glasgow-removals/).
 * Legacy rules are written before admin SPA proxy rules so Cloudflare treats them as static redirects.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCOTLAND_LOCATION_NAMES } from '../src/lib/seo/locations.js'
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

const legacyLines = []
for (const city of SCOTLAND_LOCATION_NAMES) {
  const slug = cityToSlug(city)
  const canonical = `/${slug}-removals`
  const legacy = `/removals-${slug}`
  legacyLines.push(`${legacy} ${canonical}/ 301`)
  legacyLines.push(`${legacy}/ ${canonical}/ 301`)
}

const generatedBlock = [MARKER_START, ...legacyLines, MARKER_END].join('\n')

const header = `# Prerendered HTML lives at /<route>/index.html (Cloudflare adds trailing slashes).
# Do NOT use "/* /404.html 404" - it can override asset serving on some hosts.
# Missing paths are handled by dist/404.html via the platform not_found behaviour.
`

let content = fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : ''
const blockRe = new RegExp(
  `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'm',
)

if (blockRe.test(content)) {
  content = content.replace(blockRe, generatedBlock)
} else {
  content = `${header.trim()}\n\n${generatedBlock}\n\n${ADMIN_BLOCK.trim()}\n`
}

if (!content.includes(MARKER_START)) {
  content = `${header.trim()}\n\n${generatedBlock}\n\n${ADMIN_BLOCK.trim()}\n`
}

content = content
  .replace(/# Admin SPA[\s\S]*?\/admin\/\*[^\n]*\n/g, '')
  .replace(new RegExp(`${header.trim()}\\n?`, 'm'), '')
  .trim()

content = `${header.trim()}\n\n${generatedBlock}\n\n${ADMIN_BLOCK.trim()}\n`
content = content.replace(/\r\n/g, '\n')

fs.writeFileSync(redirectsPath, content, 'utf8')
console.log(`Legacy city redirects written (${legacyLines.length} rules, admin block after legacy)`)
