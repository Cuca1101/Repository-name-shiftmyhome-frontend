import { SEO_PAGE_PATHS, SEO_SITE_ORIGIN } from '../data/seoPages.js'

const STATIC_PATHS = [
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
]

/** Transactional routes — excluded from sitemap (noindex at runtime/build). */
export const SITEMAP_EXCLUDED_PATHS = ['/payment-success', '/payment-cancelled']

/**
 * @param {string} [origin]
 * @returns {{ xml: string, urlCount: number, paths: string[] }}
 */
export function buildSitemapXml(origin = SEO_SITE_ORIGIN) {
  const allPaths = [...new Set([...STATIC_PATHS, ...SEO_PAGE_PATHS])].sort()
  const urls = allPaths
    .map(
      (path) => `  <url>
    <loc>${origin}${path === '/' ? '/' : path}</loc>
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
  return { xml, urlCount: allPaths.length, paths: allPaths }
}
