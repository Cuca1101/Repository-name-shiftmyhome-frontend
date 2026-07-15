/**
 * Cloudflare Pages fallback redirects when static _redirects miss a path.
 * Handles common SEO URL variants Google/crawl still requests as 404.
 */

/** @param {string} origin @param {string} path */
function redirect(origin, path) {
  return Response.redirect(`${origin}${path}`, 301)
}

/**
 * @param {EventContext} context
 */
export function onRequest(context) {
  const url = new URL(context.request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const origin = url.origin

  // /removals-{city} → /{city}-removals/
  let m = path.match(/^\/removals-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  // /house-removals-{city} → /{city}-removals/
  m = path.match(/^\/house-removals-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  // /removal-{city} (singular) → /{city}-removals/
  m = path.match(/^\/removal-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  // /man-and-van-{city} → /man-with-van-{city}/
  m = path.match(/^\/man-and-van-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)

  // /{city}-man-and-van or /{city}-man-with-van → /man-with-van-{city}/
  m = path.match(/^\/([a-z0-9-]+)-man-and-van$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)
  m = path.match(/^\/([a-z0-9-]+)-man-with-van$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)

  return context.next()
}
