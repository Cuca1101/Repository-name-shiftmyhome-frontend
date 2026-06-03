/**
 * Guarantee dist/_redirects exists in the Cloudflare Pages publish root after build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const source = path.join(root, 'public', '_redirects')
const target = path.join(root, 'dist', '_redirects')

if (!fs.existsSync(source)) {
  console.error('public/_redirects not found')
  process.exit(1)
}

if (!fs.existsSync(path.join(root, 'dist'))) {
  console.error('dist/ not found - run vite build first')
  process.exit(1)
}

const content = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n')
fs.writeFileSync(target, content, 'utf8')

const legacyRuleCount = content
  .split('\n')
  .filter((line) => /^\/removals-[a-z0-9-]+\/?\s+\/[a-z0-9-]+-removals\/\s+301\s*$/.test(line.trim()))
  .length

if (legacyRuleCount < 360) {
  console.error(`Expected at least 360 legacy redirect rules, found ${legacyRuleCount}`)
  process.exit(1)
}

console.log(`dist/_redirects verified (${legacyRuleCount} legacy 301 rules)`)
