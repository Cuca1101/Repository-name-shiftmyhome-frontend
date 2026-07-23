/**
 * Cloudflare Pages middleware:
 * 1) SPA deep-link fallback for email / portal routes (avoid generic 404.html)
 * 2) Legacy SEO URL redirects
 */

/** @param {string} origin @param {string} path */
function redirect(origin, path) {
  return Response.redirect(`${origin}${path}`, 301)
}

/**
 * @param {EventContext} context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const origin = url.origin

  // --- Customer / admin SPA deep links (must not hit 404.html) ---
  const isSpa =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/quote' ||
    path.startsWith('/quote/resume/') ||
    path.startsWith('/quote/pay/') ||
    path.startsWith('/track/') ||
    path === '/payment-success' ||
    path === '/payment-cancelled'

  if (isSpa) {
    // Fetch the built React shell and return it under the original URL (no redirect).
    const shell = await context.env.ASSETS.fetch(`${origin}/index.html`)
    const body = await shell.arrayBuffer()
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': shell.headers.get('content-type') || 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  // --- Legacy SEO redirects ---
  let m = path.match(/^\/removals-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  m = path.match(/^\/house-removals-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  m = path.match(/^\/removal-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/${m[1]}-removals/`)

  m = path.match(/^\/man-and-van-([a-z0-9-]+)$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)

  m = path.match(/^\/([a-z0-9-]+)-man-and-van$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)
  m = path.match(/^\/([a-z0-9-]+)-man-with-van$/)
  if (m) return redirect(origin, `/man-with-van-${m[1]}/`)

  return context.next()
}
