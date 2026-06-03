/**
 * Cloudflare Pages fallback for legacy /removals-{city} URLs when _redirects is not applied.
 * Only invoked for paths matched by public/_routes.json (include: /removals-*).
 */
const LEGACY_CITY_RE = /^\/removals-([a-z0-9-]+)\/?$/

export function onRequest(context) {
  const url = new URL(context.request.url)
  const match = url.pathname.match(LEGACY_CITY_RE)
  if (!match) return context.next()

  const destination = `${url.origin}/${match[1]}-removals/`
  return Response.redirect(destination, 301)
}
