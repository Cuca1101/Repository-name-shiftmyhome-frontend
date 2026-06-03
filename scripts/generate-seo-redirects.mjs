/**
 * Append 301 redirects for legacy inverted city URLs (e.g. /removals-glasgow → /glasgow-removals/).
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

const legacyLines = []
for (const city of SCOTLAND_LOCATION_NAMES) {
  const slug = cityToSlug(city)
  const canonical = `/${slug}-removals`
  const legacy = `/removals-${slug}`
  legacyLines.push(`${legacy} ${canonical}/ 301`)
  legacyLines.push(`${legacy}/ ${canonical}/ 301`)
}

const generatedBlock = [MARKER_START, ...legacyLines, MARKER_END].join('\n')

let content = fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : ''
const blockRe = new RegExp(
  `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
  'm',
)

if (blockRe.test(content)) {
  content = content.replace(blockRe, `${generatedBlock}\n`)
} else {
  content = `${content.trimEnd()}\n\n${generatedBlock}\n`
}

const normalized = content.replace(/\r\n/g, '\n')
fs.writeFileSync(redirectsPath, normalized, 'utf8')
console.log(`Legacy city redirects written (${legacyLines.length} rules)`)
