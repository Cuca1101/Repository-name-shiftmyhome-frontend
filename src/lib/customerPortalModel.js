/**
 * Customer portal rules: who can change a booking, how the price difference is
 * charged, and when a change waits for admin. Pure functions — no I/O.
 */
import { resolveChargeableTotal } from './adminAgreedPrice.js'
import { resolveDaySlotAvailability } from './calendarDayPricing.js'

const STARTED_KEYS = new Set([
  'on_way',
  'started',
  'start',
  'on_the_way',
  'on_way_to_collection',
  'arrived',
  'arrived_pickup',
  'loading',
  'loaded',
  'pickup_completed',
  'in_transit',
  'in_progress',
  'on_way_to_delivery',
  'arrived_delivery',
  'unloading',
])

/** Stripe GBP minimum charge. Smaller increases wait for the team. */
export const MIN_STRIPE_CHARGE_GBP = 0.3

export function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

export function formatGbp(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${round2(v).toFixed(2)}`
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

/** Verified identity must match the booking email. A booking id alone is not enough. */
export function customerOwnsBooking(sessionEmail, bookingEmail) {
  const a = normalizeEmail(sessionEmail)
  const b = normalizeEmail(bookingEmail)
  return Boolean(a && b && a === b)
}

export function normalizeJobKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/**
 * Modifications stop once the job has started, is completed, or is cancelled.
 * @param {Record<string, unknown> | null | undefined} quote
 */
export function jobModificationLock(quote) {
  const status = normalizeJobKey(quote?.status)
  const op = normalizeJobKey(quote?.operational_status)
  const assignment = normalizeJobKey(quote?.assignment_status)
  if (status === 'cancelled' || op === 'cancelled' || quote?.cancelled_at) {
    return { locked: true, reason: 'cancelled', contact: true }
  }
  if (
    status === 'completed'
    || op === 'completed'
    || assignment === 'completed'
    || quote?.completed_at
    || quote?.assignment_completed_at
  ) {
    return { locked: true, reason: 'completed', contact: true }
  }
  if (STARTED_KEYS.has(status) || STARTED_KEYS.has(op)) {
    return { locked: true, reason: 'started', contact: true }
  }
  return { locked: false, reason: '', contact: false }
}

/**
 * Call the driver currently assigned to this booking.
 * A live tracking payload replaces the stored driver after a reassignment.
 * Never falls back to the company number.
 *
 * @param {Record<string, unknown> | null | undefined} booking
 * @param {{ ok?: boolean, driver?: { full_name?: string, phone?: string } | null } | null} [tracking]
 */
export function resolveDriverContact(booking, tracking = null) {
  const live = tracking?.ok ? tracking.driver || null : null
  const useLive = Boolean(tracking?.ok)
  const driverId = useLive
    ? (live ? String(booking?.assigned_driver_id || 'assigned') : '')
    : String(booking?.assigned_driver_id || '').trim()
  const driverName = useLive
    ? String(live?.full_name || '').trim()
    : String(booking?.assigned_driver_name || '').trim()
  const rawPhone = useLive
    ? String(live?.phone || '').trim()
    : String(booking?.assigned_driver_phone || '').trim()
  const assigned = Boolean(driverId || driverName)
  const tel = rawPhone.replace(/[^\d+]/g, '')
  const digits = tel.replace(/\D/g, '')

  if (!assigned) {
    return {
      state: 'unassigned',
      message: 'A driver has not been assigned to this booking yet.',
      tel: null,
      display: '',
      name: '',
    }
  }
  if (digits.length < 10) {
    return {
      state: 'no_phone',
      message: driverName
        ? `${driverName} is assigned, but their phone number is not available.`
        : 'Your driver is assigned, but their phone number is not available.',
      tel: null,
      display: '',
      name: driverName,
    }
  }
  return {
    state: 'ready',
    message: '',
    tel,
    display: rawPhone,
    name: driverName,
  }
}

export function isHistoryBooking(quote, todayIso) {
  const lock = jobModificationLock(quote)
  if (lock.reason === 'completed' || lock.reason === 'cancelled') return true
  const day = String(quote?.move_date || '').slice(0, 10)
  return Boolean(day && todayIso && day < todayIso)
}

/** Upcoming, in progress, or completed/cancelled history. */
export function portalBookingGroup(quote) {
  const lock = jobModificationLock(quote)
  if (lock.reason === 'completed' || lock.reason === 'cancelled') return 'history'
  if (lock.reason === 'started') return 'in_progress'
  return 'upcoming'
}

/**
 * Fill only blank contact fields. Typed values stay so the customer can check them.
 * @param {Record<string, unknown>} wizard
 * @param {{ fullName?: string, phone?: string, email?: string, savedAddress?: string } | null | undefined} contact
 */
export function portalContactPrefill(wizard, contact) {
  const next = { ...(wizard || {}) }
  if (!String(next.fullName || '').trim() && contact?.fullName) next.fullName = String(contact.fullName)
  if (!String(next.phone || '').trim() && contact?.phone) next.phone = String(contact.phone)
  if (!String(next.email || '').trim() && contact?.email) next.email = String(contact.email)
  if (!String(next.pickupAddress || '').trim() && contact?.savedAddress) {
    next.pickupAddress = String(contact.savedAddress)
  }
  return next
}

/** Password change must not send role or profile metadata. */
export function passwordUpdateBody(password) {
  return { password: String(password || '') }
}

export function londonTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Slot count includes this booking when the date is unchanged.
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function dateSlotOpen(settings, isoDate, bookedOnDate, currentDate) {
  const target = String(isoDate || '').slice(0, 10)
  const current = String(currentDate || '').slice(0, 10)
  const raw = Math.max(0, Number(bookedOnDate) || 0)
  const booked = target && target === current ? Math.max(0, raw - 1) : raw
  return !resolveDaySlotAvailability(settings, target, booked).full
}

export function existingBalanceGbp(quote, chargeableTotal) {
  const remaining = Number(quote?.remaining_balance)
  if (Number.isFinite(remaining) && remaining >= 0) return round2(remaining)
  const paid = Number(quote?.amount_paid) || 0
  const total = Number(chargeableTotal)
  if (!Number.isFinite(total)) return 0
  return round2(Math.max(0, total - paid))
}

/** Same paid and balance figures as the customer portal booking list. */
export function portalPaymentFigures(booking) {
  const paid = Number(booking?.amount_paid) || 0
  const storedRemaining = Number(booking?.remaining_balance)
  const estimated = Number(booking?.estimated_total)
  const agreedRaw = booking?.agreed_price
  const agreed = agreedRaw != null && String(agreedRaw).trim() !== '' ? Number(agreedRaw) : null
  if (agreed != null && Number.isFinite(agreed) && agreed >= 0) {
    return { total: agreed, paid, balance: existingBalanceGbp(booking, agreed) }
  }
  if (
    Number.isFinite(estimated) &&
    estimated >= 0 &&
    Number.isFinite(storedRemaining) &&
    storedRemaining >= 0 &&
    Math.abs(estimated - (paid + storedRemaining)) < 0.05
  ) {
    return { total: estimated, paid, balance: storedRemaining }
  }
  const total = resolveChargeableTotal(booking)
  return { total, paid, balance: existingBalanceGbp(booking, total) }
}

/** Extra to take now. Never includes money already paid or the old balance. */
export function amountToCharge(delta) {
  const d = round2(delta)
  if (!Number.isFinite(d) || d < MIN_STRIPE_CHARGE_GBP) return 0
  return d
}

export function refundDue(total, amountPaid) {
  return round2(Math.max(0, round2(amountPaid) - round2(total)))
}

/**
 * @param {{
 *   quote?: Record<string, unknown>,
 *   previousTotal: number,
 *   nextTotal: number,
 *   dateChanged?: boolean,
 *   arrivalChanged?: boolean,
 *   inventoryChanged?: boolean,
 *   addressChanged?: boolean,
 *   distanceChanged?: boolean,
 *   volumeIncreased?: boolean,
 *   crewIncreased?: boolean,
 *   driverAssigned?: boolean,
 *   driverBusy?: boolean,
 *   dateAvailable?: boolean,
 *   dateInPast?: boolean,
 * }} input
 */
export function decideCustomerAmendment(input) {
  const previousTotal = round2(input.previousTotal)
  const nextTotal = round2(input.nextTotal)
  const delta = round2(nextTotal - previousTotal)
  const balance = existingBalanceGbp(input.quote, previousTotal)
  const base = {
    previousTotal,
    nextTotal,
    delta,
    existingBalance: balance,
    chargeGbp: 0,
    approvalReasons: /** @type {string[]} */ ([]),
  }

  const lock = jobModificationLock(input.quote)
  if (lock.locked) {
    return { ...base, outcome: 'blocked', reason: lock.reason }
  }

  const changed = Boolean(
    input.dateChanged || input.arrivalChanged || input.inventoryChanged || input.addressChanged,
  )
  if (!changed) {
    return { ...base, outcome: 'unchanged', reason: 'no_change' }
  }

  if (input.dateChanged && input.dateInPast) {
    return { ...base, outcome: 'blocked', reason: 'date_past' }
  }
  if (input.dateChanged && input.dateAvailable === false) {
    return { ...base, outcome: 'unavailable', reason: 'date_full' }
  }

  /** @type {string[]} */
  const approval = []
  if (delta < -0.009) approval.push('price_decrease')
  if (input.driverAssigned && input.dateChanged && input.driverBusy) approval.push('driver_busy')
  if (input.driverAssigned && (input.volumeIncreased || input.crewIncreased)) approval.push('crew_or_volume')
  if (input.driverAssigned && input.addressChanged && input.distanceChanged) approval.push('route')
  if (input.driverAssigned && input.arrivalChanged && !input.dateChanged && !input.inventoryChanged) {
    approval.push('arrival')
  }
  if (delta > 0.009 && delta < MIN_STRIPE_CHARGE_GBP) approval.push('small_increase')

  if (approval.length) {
    return { ...base, outcome: 'pending_approval', reason: approval[0], approvalReasons: approval }
  }
  if (delta > 0.009) {
    return {
      ...base,
      outcome: 'pending_payment',
      reason: 'price_increase',
      chargeGbp: amountToCharge(delta),
    }
  }
  return { ...base, outcome: 'apply', reason: 'confirmed' }
}

/**
 * Quote columns written when a change is confirmed.
 * Does not include status, operational_status, or completed_at.
 */
export function buildAppliedQuotePatch({
  proposed,
  amountPaid,
  paymentDelta,
  hadAgreedPrice,
}) {
  const delta = round2(Math.max(0, Number(paymentDelta) || 0))
  const paid = round2((Number(amountPaid) || 0) + delta)
  const total = round2(proposed.total)
  /** @type {Record<string, unknown>} */
  const patch = {
    move_date: proposed.moveDate,
    arrival_window: proposed.arrivalWindow || null,
    arrival_type: proposed.arrivalType || null,
    arrival_time: proposed.arrivalTime || null,
    inventory: proposed.inventory,
    inventory_text: proposed.inventoryText || null,
    crew_size: proposed.crewSize ?? null,
  }
  if (!proposed.priceUnchanged) {
    patch.estimated_total = total
    patch.calculated_total = total
    patch.amount_paid = paid
    patch.remaining_balance = round2(Math.max(0, total - paid))
    if (hadAgreedPrice) patch.agreed_price = total
  }
  if (proposed.addressChanged) {
    if (proposed.pickupAddress) patch.pickup_address = proposed.pickupAddress
    if (proposed.deliveryAddress) patch.delivery_address = proposed.deliveryAddress
    const miles = Number(proposed.distanceMiles)
    if (Number.isFinite(miles) && miles > 0) patch.distance_miles = miles
  }
  return patch
}

export function quotePatchTouchesCompletion(patch) {
  return ['status', 'operational_status', 'completed_at'].some((key) =>
    Object.prototype.hasOwnProperty.call(patch || {}, key),
  )
}

/**
 * After Stripe says the difference was paid, re-check before touching the booking.
 * A failed or abandoned payment never reaches this with paid=true.
 */
export function resolvePaidAmendment({
  locked,
  dateAvailable,
  driverNeedsReview,
}) {
  if (locked || dateAvailable === false || driverNeedsReview) {
    return { applyToQuote: false, status: 'paid_needs_review', quoteUnchanged: true }
  }
  return { applyToQuote: true, status: 'applied', quoteUnchanged: false }
}

/** Failed or abandoned checkout leaves the confirmed booking as it was. */
export function resolveUnpaidOutcome(kind) {
  const status = kind === 'failed' ? 'payment_failed' : 'abandoned'
  return { applyToQuote: false, status, quoteUnchanged: true }
}

export function amendmentAlreadySettled(status) {
  return status === 'applied' || status === 'rejected' || status === 'abandoned'
}

export function blocksNewAmendment(status) {
  return status === 'pending_approval' || status === 'paid_needs_review'
}

/**
 * @param {string | null | undefined} next
 */
export function safePortalNext(next) {
  const value = String(next || '').trim()
  if (!value.startsWith('/portal/')) return '/portal/bookings'
  if (value.includes('://') || value.startsWith('//') || value.includes('\\')) return '/portal/bookings'
  return value
}

export function classifyMagicLinkError(message) {
  const text = String(message || '').toLowerCase()
  if (text.includes('expired') || text.includes('otp_expired')) return 'expired'
  if (text.includes('invalid') || text.includes('already') || text.includes('not found')) return 'invalid'
  return 'error'
}

/**
 * Show the driver map once the job has started and a position exists.
 * A position older than the live window stays on the map as the last known point.
 * @param {{ stage?: string, gpsFresh?: boolean, hasCoords?: boolean }} args
 */
export function portalTrackingPresentation(args) {
  const stage = String(args.stage || '')
  if (stage === 'completed' || stage === 'cancelled') {
    return { showLivePosition: false, awaitingStart: false, live: false, message: '' }
  }
  if (stage === 'awaiting_departure' || stage === 'pending' || !stage) {
    return {
      showLivePosition: false,
      awaitingStart: true,
      live: false,
      message: 'Your driver has not started towards collection yet.',
    }
  }
  if (args.hasCoords) {
    return {
      showLivePosition: true,
      awaitingStart: false,
      live: Boolean(args.gpsFresh),
      message: args.gpsFresh ? '' : 'Showing the last known position. A new GPS update has not arrived yet.',
    }
  }
  return {
    showLivePosition: false,
    awaitingStart: false,
    live: false,
    message: 'Your driver is on the job. A live location is not available right now.',
  }
}

export function inventorySignature(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => `${String(line?.name || '').trim().toLowerCase()}×${Math.max(0, Number(line?.quantity) || 0)}`)
    .filter((row) => !row.startsWith('×'))
    .sort()
    .join('|')
}

export function sumLineVolume(lines) {
  let total = 0
  for (const line of Array.isArray(lines) ? lines : []) {
    total += (Number(line?.quantity) || 0) * (Number(line?.m3) || Number(line?.volumePerUnitM3) || 0)
  }
  return round2(total)
}
