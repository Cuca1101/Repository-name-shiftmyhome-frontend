/** Survives navigation from a lead page to the Call Centre. */
let pending = null
const listeners = new Set()

/**
 * @param {{ name?: string, phone: string, e164: string }} request
 */
export function requestOutboundCall(request) {
  if (listeners.size === 0) {
    pending = request
    return
  }
  pending = null
  for (const listener of listeners) listener(request)
}

export function subscribeOutboundCall(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function takeOutboundCall() {
  const current = pending
  pending = null
  return current
}
