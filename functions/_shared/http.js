const ALLOWED_ORIGINS = new Set(['https://shiftmyhome.co.uk', 'https://www.shiftmyhome.co.uk'])
const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

/** Local Vite only. A browser calling the public site still has to use the two production origins. */
function originAllowed(request) {
  const origin = request.headers.get('Origin') || ''
  if (ALLOWED_ORIGINS.has(origin)) return true
  if (!LOCAL_DEV_ORIGINS.has(origin)) return false
  const host = String(request.headers.get('Host') || '')
    .toLowerCase()
    .split(':')[0]
  return host === 'localhost' || host === '127.0.0.1'
}

const PRIVATE_NO_STORE = {
  'cache-control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  pragma: 'no-cache',
  expires: '0',
  'cdn-cache-control': 'no-store',
  'surrogate-control': 'no-store',
}

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** @param {Request} request */
export function assertBrowserOrigin(request) {
  if (!originAllowed(request)) {
    throw new HttpError(403, 'This browser origin is not allowed.')
  }
}

/** @param {Request} request */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  if (!originAllowed(request)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  }
}

/**
 * @param {unknown} data
 * @param {number} [status]
 * @param {Request} [request]
 */
export function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...PRIVATE_NO_STORE,
      'x-content-type-options': 'nosniff',
      ...(request ? corsHeaders(request) : {}),
    },
  })
}

/** @param {Request} request */
export function preflight(request) {
  if (!originAllowed(request)) {
    return json({ message: 'This browser origin is not allowed.' }, 403)
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...PRIVATE_NO_STORE,
      ...corsHeaders(request),
    },
  })
}

/** Log a failure without credentials, signed URLs, or telephone numbers. */
export function logServerError(label, error) {
  const name = error instanceof Error ? error.name : 'error'
  console.error(label, name)
}
