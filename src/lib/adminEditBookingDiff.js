/**
 * Customer-facing change detection for admin Edit Booking.
 * Internal admin notes are never included in customer email payloads.
 */
import { formatDateUK } from './formatDateDisplay'
import {
  formatWizardArrivalSummary,
  PARKING_LABELS,
  WALKING_LABELS,
} from './emailQuotePayload'

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return `£${round2(n).toFixed(2)}`
}

function normStr(v) {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function floorLabel(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (n === 0) return 'Ground'
  return String(n)
}

function liftLabel(v) {
  if (v == null || v === '') return '—'
  if (v === true || v === 'yes' || v === 'Yes') return 'Yes'
  if (v === false || v === 'no' || v === 'No') return 'No'
  return String(v)
}

function parkingLabel(v) {
  const key = String(v || '').trim()
  return PARKING_LABELS[key] || key || '—'
}

function walkingLabel(v) {
  const key = String(v || '').trim()
  return WALKING_LABELS[key] || key || '—'
}

/**
 * @param {Record<string, unknown>} wizard
 */
export function buildCustomerFacingBookingSnapshot(wizard, extras = {}) {
  const lines = Array.isArray(wizard?.inventoryLines) ? wizard.inventoryLines : []
  const inventory = lines
    .map((l) => ({
      name: normStr(l.name) || 'Item',
      quantity: Math.max(1, Number(l.quantity) || 1),
      m3: Number(l.m3) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.quantity - b.quantity)

  return {
    fullName: normStr(wizard.fullName),
    email: normStr(wizard.email),
    phone: normStr(wizard.phone),
    pickupAddress: normStr(wizard.pickupAddress),
    deliveryAddress: normStr(wizard.deliveryAddress),
    moveDate: normStr(wizard.moveDate),
    arrival: formatWizardArrivalSummary(wizard),
    pickupFloor: floorLabel(wizard.pickupFloor),
    deliveryFloor: floorLabel(wizard.deliveryFloor),
    pickupLift: liftLabel(wizard.pickupLift),
    deliveryLift: liftLabel(wizard.deliveryLift),
    parking: parkingLabel(wizard.parkingDistance),
    walking: walkingLabel(wizard.walkingDistance),
    stairsFlights: Number(wizard.stairsFlights) || 0,
    stairsNotes: normStr(wizard.stairsNotes),
    specialInstructions: normStr(wizard.specialInstructions),
    crewSize: wizard.crewSize != null ? Number(wizard.crewSize) : null,
    packing: Boolean(wizard.packing),
    packingWhat: normStr(wizard.packingWhat),
    packingMaterials: Boolean(wizard.packingMaterials),
    dismantling: Boolean(wizard.dismantling),
    dismantlingWhat: normStr(wizard.dismantlingWhat),
    reassembly: Boolean(wizard.reassembly),
    reassemblyWhat: normStr(wizard.reassemblyWhat),
    pickupContactName: normStr(wizard.pickupContactName),
    pickupContactPhone: normStr(wizard.pickupContactPhone),
    deliveryContactName: normStr(wizard.deliveryContactName),
    deliveryContactPhone: normStr(wizard.deliveryContactPhone),
    inventory,
    price: extras.price != null && Number.isFinite(Number(extras.price)) ? round2(extras.price) : null,
    serviceType: normStr(extras.serviceType),
  }
}

/**
 * @param {{ name: string, quantity: number }[]} before
 * @param {{ name: string, quantity: number }[]} after
 */
function diffInventory(before, after) {
  /** @type {Array<{ label: string, previous: string, next: string, kind: string }>} */
  const changes = []
  /** @type {Map<string, number>} */
  const beforeMap = new Map()
  /** @type {Map<string, number>} */
  const afterMap = new Map()

  for (const line of before) {
    const key = line.name.toLowerCase()
    beforeMap.set(key, (beforeMap.get(key) || 0) + line.quantity)
  }
  for (const line of after) {
    const key = line.name.toLowerCase()
    afterMap.set(key, (afterMap.get(key) || 0) + line.quantity)
  }

  const names = new Set([...beforeMap.keys(), ...afterMap.keys()])
  for (const key of [...names].sort()) {
    const prevQty = beforeMap.get(key) || 0
    const nextQty = afterMap.get(key) || 0
    if (prevQty === nextQty) continue
    const displayName =
      after.find((l) => l.name.toLowerCase() === key)?.name ||
      before.find((l) => l.name.toLowerCase() === key)?.name ||
      key
    if (prevQty === 0) {
      changes.push({
        label: 'Item added',
        previous: '—',
        next: `${displayName} × ${nextQty}`,
        kind: 'item_added',
      })
    } else if (nextQty === 0) {
      changes.push({
        label: 'Item removed',
        previous: `${displayName} × ${prevQty}`,
        next: '—',
        kind: 'item_removed',
      })
    } else {
      changes.push({
        label: displayName,
        previous: `Qty ${prevQty}`,
        next: `Qty ${nextQty}`,
        kind: 'item_qty',
      })
    }
  }
  return changes
}

function pushScalarChange(changes, label, previous, next, kind) {
  const prev = normStr(previous) || '—'
  const nxt = normStr(next) || '—'
  if (prev === nxt) return
  changes.push({ label, previous: prev, next: nxt, kind })
}

function yesNoService(enabled, detail) {
  if (!enabled) return 'No'
  const d = normStr(detail)
  return d ? `Yes — ${d}` : 'Yes'
}

/**
 * @param {ReturnType<typeof buildCustomerFacingBookingSnapshot>} before
 * @param {ReturnType<typeof buildCustomerFacingBookingSnapshot>} after
 * @returns {{ changes: Array<{ label: string, previous: string, next: string, kind: string }>, hasChanges: boolean }}
 */
export function diffCustomerFacingBooking(before, after) {
  /** @type {Array<{ label: string, previous: string, next: string, kind: string }>} */
  const changes = []

  pushScalarChange(
    changes,
    'Move date',
    formatDateUK(before.moveDate),
    formatDateUK(after.moveDate),
    'date',
  )
  pushScalarChange(changes, 'Arrival time', before.arrival, after.arrival, 'arrival')
  pushScalarChange(changes, 'Collection address', before.pickupAddress, after.pickupAddress, 'address')
  pushScalarChange(changes, 'Delivery address', before.deliveryAddress, after.deliveryAddress, 'address')
  pushScalarChange(changes, 'Customer name', before.fullName, after.fullName, 'customer')
  pushScalarChange(changes, 'Email', before.email, after.email, 'customer')
  pushScalarChange(changes, 'Phone', before.phone, after.phone, 'customer')
  pushScalarChange(changes, 'Pickup contact', before.pickupContactName, after.pickupContactName, 'contact')
  pushScalarChange(
    changes,
    'Pickup contact phone',
    before.pickupContactPhone,
    after.pickupContactPhone,
    'contact',
  )
  pushScalarChange(
    changes,
    'Delivery contact',
    before.deliveryContactName,
    after.deliveryContactName,
    'contact',
  )
  pushScalarChange(
    changes,
    'Delivery contact phone',
    before.deliveryContactPhone,
    after.deliveryContactPhone,
    'contact',
  )
  pushScalarChange(changes, 'Collection floor', before.pickupFloor, after.pickupFloor, 'access')
  pushScalarChange(changes, 'Delivery floor', before.deliveryFloor, after.deliveryFloor, 'access')
  pushScalarChange(changes, 'Collection lift', before.pickupLift, after.pickupLift, 'access')
  pushScalarChange(changes, 'Delivery lift', before.deliveryLift, after.deliveryLift, 'access')
  pushScalarChange(changes, 'Parking', before.parking, after.parking, 'access')
  pushScalarChange(changes, 'Walking distance', before.walking, after.walking, 'access')
  pushScalarChange(
    changes,
    'Stairs (flights)',
    String(before.stairsFlights || 0),
    String(after.stairsFlights || 0),
    'access',
  )
  pushScalarChange(changes, 'Stairs notes', before.stairsNotes, after.stairsNotes, 'access')
  pushScalarChange(
    changes,
    'Number of movers',
    before.crewSize != null ? String(before.crewSize) : '—',
    after.crewSize != null ? String(after.crewSize) : '—',
    'crew',
  )
  pushScalarChange(changes, 'Service type', before.serviceType, after.serviceType, 'service')
  pushScalarChange(
    changes,
    'Packing',
    yesNoService(before.packing, before.packingWhat),
    yesNoService(after.packing, after.packingWhat),
    'service',
  )
  pushScalarChange(
    changes,
    'Packing materials',
    before.packingMaterials ? 'Yes' : 'No',
    after.packingMaterials ? 'Yes' : 'No',
    'service',
  )
  pushScalarChange(
    changes,
    'Dismantling',
    yesNoService(before.dismantling, before.dismantlingWhat),
    yesNoService(after.dismantling, after.dismantlingWhat),
    'service',
  )
  pushScalarChange(
    changes,
    'Reassembly',
    yesNoService(before.reassembly, before.reassemblyWhat),
    yesNoService(after.reassembly, after.reassemblyWhat),
    'service',
  )
  pushScalarChange(
    changes,
    'Booking instructions',
    before.specialInstructions,
    after.specialInstructions,
    'instructions',
  )

  changes.push(...diffInventory(before.inventory || [], after.inventory || []))

  const prevPrice = money(before.price)
  const nextPrice = money(after.price)
  if (prevPrice && nextPrice && prevPrice !== nextPrice) {
    changes.push({
      label: 'Total price',
      previous: prevPrice,
      next: nextPrice,
      kind: 'price',
    })
  } else if (!prevPrice && nextPrice) {
    changes.push({
      label: 'Total price',
      previous: '—',
      next: nextPrice,
      kind: 'price',
    })
  } else if (prevPrice && !nextPrice) {
    changes.push({
      label: 'Total price',
      previous: prevPrice,
      next: '—',
      kind: 'price',
    })
  } else if (
    before.price != null &&
    after.price != null &&
    Math.abs(Number(before.price) - Number(after.price)) > 0.009
  ) {
    changes.push({
      label: 'Total price',
      previous: money(before.price) || '—',
      next: money(after.price) || '—',
      kind: 'price',
    })
  }

  return { changes, hasChanges: changes.length > 0 }
}
