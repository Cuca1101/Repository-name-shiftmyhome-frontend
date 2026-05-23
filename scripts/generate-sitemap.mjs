import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildSitemapXml } from '../src/lib/generateSitemapXml.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const { xml, urlCount } = buildSitemapXml()
writeFileSync(join(root, 'public', 'sitemap.xml'), xml, 'utf8')
console.log(`sitemap.xml written with ${urlCount} URLs`)
