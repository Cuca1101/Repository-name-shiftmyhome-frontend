/**
 * Staff and customer are different contexts.
 * A signed-in admin or driver is not a customer, even when the email matches a booking.
 */

export function roleFromUser(user) {
  if (!user) return ''
  return String(user.app_metadata?.role || user.user_metadata?.role || '')
    .trim()
    .toLowerCase()
}

/** @returns {'none' | 'admin' | 'driver' | 'customer'} */
export function sessionKindFromUser(user) {
  if (!user) return 'none'
  const role = roleFromUser(user)
  if (role === 'admin') return 'admin'
  if (role === 'driver') return 'driver'
  return 'customer'
}

/** Customer Portal uses only its own customer session, never the admin or driver session. */
export function canEnterCustomerPortal(portalUser) {
  return Boolean(portalUser) && sessionKindFromUser(portalUser) === 'customer'
}

/** Keep an explicit admin-view customer id on portal links, including hashes. */
export function withCustomerQuery(path, customerId) {
  const id = String(customerId || '').trim()
  if (!id) return path
  const hashAt = String(path).indexOf('#')
  const hash = hashAt >= 0 ? path.slice(hashAt) : ''
  const base = hashAt >= 0 ? path.slice(0, hashAt) : String(path)
  const split = base.indexOf('?')
  const pathname = split >= 0 ? base.slice(0, split) : base
  const params = new URLSearchParams(split >= 0 ? base.slice(split + 1) : '')
  params.set('customer', id)
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${hash}`
}
