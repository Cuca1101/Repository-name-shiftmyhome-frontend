/**
 * Normalize public URL paths for routing and SEO lookups.
 * Hosting may serve /city-removals/ while routes are registered as /city-removals.
 */
export function normalizePublicPath(pathname) {
  const raw = String(pathname || '').trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function withTrailingSlashVariants(paths) {
  const out = new Set()
  for (const path of paths) {
    const normalized = normalizePublicPath(path)
    out.add(normalized)
    if (normalized !== '/') out.add(`${normalized}/`)
  }
  return [...out]
}

/**
 * Absolute public URL matching Cloudflare Pages trailing-slash hosting (200 URL).
 * @param {string} origin e.g. https://www.shiftmyhome.co.uk
 * @param {string} pathname
 */
export function buildPublicPageUrl(origin, pathname) {
  const base = String(origin || '').replace(/\/+$/, '')
  const path = normalizePublicPath(pathname)
  if (path === '/') return `${base}/`
  return `${base}${path}/`
}
