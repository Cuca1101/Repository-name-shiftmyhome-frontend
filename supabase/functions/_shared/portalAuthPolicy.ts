/** Small portal rules copied for the edge runtime. Do not import the website bundle. */

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase()
}

export function customerOwnsBooking(sessionEmail: unknown, bookingEmail: unknown): boolean {
  const a = normalizeEmail(sessionEmail)
  const b = normalizeEmail(bookingEmail)
  return Boolean(a && b && a === b)
}

export function safePortalNext(next: unknown): string {
  const value = String(next || '').trim()
  if (!value.startsWith('/portal/')) return '/portal/bookings'
  if (value.includes('://') || value.startsWith('//') || value.includes('\\')) return '/portal/bookings'
  return value
}

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'https://www.shiftmyhome.co.uk',
  'https://shiftmyhome.co.uk',
])

/** Use the browser origin only when it is this site. Otherwise use the public site. */
export function portalSiteOrigin(req: Request, fallback: string): string {
  const origin = String(req.headers.get('origin') || '').trim().replace(/\/$/, '')
  if (ALLOWED_ORIGINS.has(origin)) return origin
  return fallback.replace(/\/$/, '')
}
