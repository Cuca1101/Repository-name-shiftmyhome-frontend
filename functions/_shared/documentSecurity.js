/** Site CSP for the Amazon Connect CCP, recordings, and existing embedded services. */
export const DOCUMENT_CSP = [
  "frame-src 'self' https://shiftmyhome.my.connect.aws https://*.my.connect.aws https://*.awsapps.com https://js.stripe.com https://*.stripe.com https://hooks.stripe.com https://m.stripe.network https://maps.googleapis.com https://maps.gstatic.com",
  "worker-src 'self' blob: https://shiftmyhome.my.connect.aws https://*.my.connect.aws",
  "media-src 'self' blob: mediastream: https://shiftmyhome.my.connect.aws https://*.my.connect.aws https://*.awsapps.com https://*.s3.eu-west-2.amazonaws.com https://*.s3.amazonaws.com",
].join('; ')

/** Microphone, speakers and ringtone for the framed softphone. Camera is not granted. */
export const DOCUMENT_PERMISSIONS = [
  'microphone=(self "https://shiftmyhome.my.connect.aws")',
  'autoplay=(self "https://shiftmyhome.my.connect.aws")',
  'speaker-selection=(self "https://shiftmyhome.my.connect.aws")',
].join(', ')

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
