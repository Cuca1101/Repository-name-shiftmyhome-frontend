/** Site CSP for payments, maps, and media. Teams calls open in a new window, not an iframe. */
export const DOCUMENT_CSP = [
  "frame-src 'self' https://js.stripe.com https://*.stripe.com https://hooks.stripe.com https://m.stripe.network https://maps.googleapis.com https://maps.gstatic.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob: mediastream:",
].join('; ')

/** Camera is not used by the public site. */
export const DOCUMENT_PERMISSIONS = 'camera=()'

/** @param {Response} response */
export function withDocumentSecurity(response) {
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html')) return response
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', DOCUMENT_CSP)
  headers.set('Permissions-Policy', DOCUMENT_PERMISSIONS)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
