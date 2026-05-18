import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const origin = 'https://www.shiftmyhome.co.uk'

const { SEO_PAGE_PATHS } = await import('../src/data/seoPages.js')

const staticPaths = [
  '/',
  '/quote',
  '/coverage',
  '/terms',
  '/privacy',
  '/cookies',
  '/house-removals',
  '/man-with-van',
  '/furniture-delivery',
  '/office-moves',
  '/student-moves',
  '/clearance',
  '/payment-success',
  '/payment-cancelled',
]

const allPaths = [...new Set([...staticPaths, ...SEO_PAGE_PATHS])].sort()

const urls = allPaths
  .map(
    (path) => `  <url>
    <loc>${origin}${path === '/' ? '' : path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : path.endsWith('-removals') || path.startsWith('/man-with-van-') ? '0.8' : '0.7'}</priority>
  </url>`,
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(join(root, 'public', 'sitemap.xml'), xml, 'utf8')
console.log(`sitemap.xml written with ${allPaths.length} URLs`)
