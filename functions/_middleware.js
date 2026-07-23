/**
 * Cloudflare Pages middleware:
 * 1) Legacy SEO URL redirects
 * 2) SPA deep-link fallback for email / portal routes (avoid generic 404.html)
 */

/** @param {string} origin @param {string} path */
function redirect(origin, path) {
  return Response.redirect(`${origin}${path}`, 301)
}

/**
 * Serve the React shell for app routes that are not prerendered HTML folders.
 * @param {EventContext} context
 * @param {URL} url
 */
async function serveSpaShell(context, url) {
  const assetUrl = new URL('/index.html', url.origin)
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request))
}

/**
 * @param {EventContext} context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const origin = url.origin

  // --- Customer / admin SPA deep links (must not hit 404.html) ---
  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/quote' ||
    path.startsWith('/quote/resume/') ||
    path.startsWith('/quote/pay/') ||
    path.startsWith('/track/') ||
    path === '/payment-success' ||
    path === '/payment-cancelled'
  ) {
    return serveSpaShell(context, url)
  }

  // --- Legacy SEO redirects ---
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
