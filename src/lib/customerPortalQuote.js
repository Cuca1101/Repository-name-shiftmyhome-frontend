/**
 * Read a stored booking into wizard shape.
 * Date, arrival, inventory, and address text can be edited.
 * Distance, coordinates, floors, and volume stay server-owned so a client cannot underprice the job.
 */
import { INVENTORY_BY_CATEGORY } from '../components/quote-wizard/inventoryCatalog.js'
import { isFlexibleWindowValid, isValidHalfHourSlot } from './arrivalTimeSlots.js'
import { initialWizardState } from './quoteWizardDefaults.js'
import { inventorySignature, londonTodayIso, round2, sumLineVolume } from './customerPortalModel.js'

const SNAPSHOT_START = '---SMH_PHONE_BOOKING_WIZARD_JSON---'
const SNAPSHOT_END = '---END_SMH_PHONE_BOOKING_WIZARD_JSON---'

export function catalogItems() {
  /** @type {Array<Record<string, unknown>>} */
  const items = []
  for (const category of Object.values(INVENTORY_BY_CATEGORY)) {
    const label = String(category?.label || '')
    for (const item of category?.items || []) {
      items.push({ ...item, categoryLabel: label })
    }
  }
  return items
}

function normName(name) {
  return String(name || '').trim().toLowerCase()
}

export function readWizardFromDetails(details) {
  const text = String(details || '')
  const start = text.indexOf(SNAPSHOT_START)
  if (start < 0) return null
  const end = text.indexOf(SNAPSHOT_END, start)
  if (end < 0) return null
  try {
    const parsed = JSON.parse(text.slice(start + SNAPSHOT_START.length, end).trim())
    const wizard = parsed?.wizard
    return wizard && typeof wizard === 'object' ? wizard : null
  } catch {
    return null
  }
}

export function inventoryLinesFromJson(inventory) {
  if (!Array.isArray(inventory)) return []
  return inventory
    .filter((line) => line && typeof line === 'object' && line.name)
    .map((line) => ({
      name: String(line.name),
      quantity: Math.max(1, Number(line.quantity) || 1),
      m3: Number(line.m3) || Number(line.volume_m3) || 0.1,
      mult: Number(line.mult) > 0 ? Number(line.mult) : 1,
      weightType: line.weight_type || line.weightType || 'medium',
      isCustom: Boolean(line.is_custom || line.isCustom),
      categoryLabel: line.category || line.categoryLabel || '',
      catalogId: line.catalogId || null,
    }))
}

function dateOnly(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

/**
 * @param {Record<string, unknown>} row
 */
export function hydratePortalWizard(row) {
  const snap = readWizardFromDetails(row?.details)
  const wizard = { ...initialWizardState(), ...(snap || {}) }
  wizard.fullName = String(wizard.fullName || row?.full_name || '')
  wizard.email = String(wizard.email || row?.email || '')
  wizard.phone = String(wizard.phone || row?.phone || '')
  wizard.pickupAddress = String(wizard.pickupAddress || row?.pickup_address || '')
  wizard.deliveryAddress = String(wizard.deliveryAddress || row?.delivery_address || '')
  fillEmptyAddressParts(wizard, 'pickup')
  fillEmptyAddressParts(wizard, 'delivery')
  wizard.distanceMiles = Number(wizard.distanceMiles) || Number(row?.distance_miles) || 0
  wizard.crewSize =
    wizard.crewSize != null && wizard.crewSize !== ''
      ? Number(wizard.crewSize)
      : row?.crew_size != null
        ? Number(row.crew_size)
        : null
  wizard.moveDate = dateOnly(wizard.moveDate || row?.move_date)
  const fromSnap = Array.isArray(wizard.inventoryLines) ? wizard.inventoryLines : []
  wizard.inventoryLines = fromSnap.length ? fromSnap : inventoryLinesFromJson(row?.inventory)
  const pkg = row?.service_package_snapshot?.service_package
  if (!wizard.packageTier && pkg) wizard.packageTier = String(pkg)
  return wizard
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} edits
 * @param {string} [todayIso]
 */
export function applyCustomerEdits(base, edits, todayIso = londonTodayIso()) {
  const next = {
    ...base,
    inventoryLines: Array.isArray(base.inventoryLines) ? base.inventoryLines.map((line) => ({ ...line })) : [],
  }
  const moveDate = dateOnly(edits?.moveDate)
  if (!moveDate) return { ok: false, error: 'Choose a move date.' }
  if (moveDate < todayIso) return { ok: false, error: 'Choose today or a later date.' }
  next.moveDate = moveDate

  const arrivalWindow = String(edits?.arrivalWindow || base.arrivalWindow || '').trim()
  next.arrivalWindow = arrivalWindow
  next.exactArrivalTime = String(edits?.exactArrivalTime || '').trim()
  next.flexibleArrivalFrom = String(edits?.flexibleArrivalFrom || '').trim()
  next.flexibleArrivalUntil = String(edits?.flexibleArrivalUntil || '').trim()
  if (arrivalWindow === 'exact') {
    if (!isValidHalfHourSlot(next.exactArrivalTime)) {
      return { ok: false, error: 'Choose an exact arrival time.' }
    }
    next.flexibleArrivalFrom = ''
    next.flexibleArrivalUntil = ''
  } else if (arrivalWindow === 'flex_window') {
    if (!isFlexibleWindowValid(next.flexibleArrivalFrom, next.flexibleArrivalUntil)) {
      return { ok: false, error: 'Choose a collection window.' }
    }
    next.exactArrivalTime = ''
  } else if (!arrivalWindow) {
    return { ok: false, error: 'Choose a collection window.' }
  }

  const inventory = mergeInventory(base.inventoryLines, edits?.inventoryLines)
  if (!inventory.ok) return inventory
  next.inventoryLines = inventory.lines

  if (!edits?.addressEdit) return { ok: true, wizard: next, addressChanged: false }
  const pickup = readStop('pickup', edits, base)
  const delivery = readStop('delivery', edits, base)
  const pickupError = validateStop('Collection', pickup)
  if (pickupError) return { ok: false, error: pickupError }
  const deliveryError = validateStop('Delivery', delivery)
  if (deliveryError) return { ok: false, error: deliveryError }
  const addressChanged = portalAddressChanged(base, stopPatch(pickup, delivery))
  if (!addressChanged) return { ok: true, wizard: next, addressChanged: false }
  Object.assign(next, stopPatch(pickup, delivery))
  next.pickupAddress = pickup.address
  next.deliveryAddress = delivery.address
  next.distanceMiles = base.distanceMiles
  next.mapboxRouteDurationSeconds = base.mapboxRouteDurationSeconds ?? null
  next.pickupLng = base.pickupLng ?? null
  next.pickupLat = base.pickupLat ?? null
  next.deliveryLng = base.deliveryLng ?? null
  next.deliveryLat = base.deliveryLat ?? null
  return { ok: true, wizard: next, addressChanged: true }
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

export function formatUkPostcode(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/)
  return match ? `${match[1]} ${match[2]}` : ''
}

export function composePortalStop({ houseNumber, street, town, flat, postcode, fallback }) {
  const pc = formatUkPostcode(postcode)
  const line1 = [cleanPart(houseNumber), cleanPart(street)].filter(Boolean).join(' ')
  const composed = [line1, cleanPart(flat), cleanPart(town), pc].filter(Boolean).join(', ')
  return composed.length >= 8 ? composed : cleanPart(fallback)
}

function cleanPart(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normPart(value) {
  return cleanPart(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function portalAddressChanged(base, next) {
  const keys = [
    'pickupHouseNumber',
    'pickupStreet',
    'pickupTown',
    'pickupPostcode',
    'pickupFlatDetails',
    'deliveryHouseNumber',
    'deliveryStreet',
    'deliveryTown',
    'deliveryPostcode',
    'deliveryFlatDetails',
  ]
  return keys.some((key) => normPart(base?.[key]) !== normPart(next?.[key]))
}

function fillEmptyAddressParts(wizard, side) {
  if (cleanPart(wizard[`${side}HouseNumber`]) && formatUkPostcode(wizard[`${side}Postcode`])) return
  const parsed = splitStoredAddress(wizard[`${side}Address`])
  if (!cleanPart(wizard[`${side}HouseNumber`])) wizard[`${side}HouseNumber`] = parsed.house
  if (!cleanPart(wizard[`${side}Street`])) wizard[`${side}Street`] = parsed.street
  if (!cleanPart(wizard[`${side}Town`])) wizard[`${side}Town`] = parsed.town
  if (!formatUkPostcode(wizard[`${side}Postcode`])) wizard[`${side}Postcode`] = parsed.postcode
}

export function splitStoredAddress(address) {
  const text = cleanPart(address)
  const postcodeMatch = text.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i)
  const postcode = postcodeMatch ? formatUkPostcode(postcodeMatch[1]) : ''
  const withoutPc = postcodeMatch
    ? cleanPart(text.replace(postcodeMatch[1], '').replace(/,\s*,/g, ',').replace(/,\s*$/, ''))
    : text
  const parts = withoutPc.split(',').map((part) => part.trim()).filter(Boolean)
  const first = parts[0] || ''
  const houseMatch = first.match(/^(\d+[A-Za-z]?)\s+(.*)$/)
  return {
    house: houseMatch ? houseMatch[1] : '',
    street: houseMatch ? houseMatch[2] : first,
    town: parts.slice(1).join(', '),
    postcode,
  }
}

function readStop(side, edits, base) {
  const houseNumber = cleanPart(edits?.[`${side}HouseNumber`] ?? base?.[`${side}HouseNumber`])
  const street = cleanPart(edits?.[`${side}Street`] ?? base?.[`${side}Street`])
  const town = cleanPart(edits?.[`${side}Town`] ?? base?.[`${side}Town`])
  const flat = cleanPart(edits?.[`${side}FlatDetails`] ?? base?.[`${side}FlatDetails`])
  const postcode = formatUkPostcode(edits?.[`${side}Postcode`] ?? base?.[`${side}Postcode`])
  const address = composePortalStop({
    houseNumber,
    street,
    town,
    flat,
    postcode,
    fallback: edits?.[`${side}Address`] || base?.[`${side}Address`],
  })
  return { houseNumber, street, town, flat, postcode, address }
}

function stopPatch(pickup, delivery) {
  return {
    pickupHouseNumber: pickup.houseNumber,
    pickupStreet: pickup.street,
    pickupTown: pickup.town,
    pickupPostcode: pickup.postcode,
    pickupFlatDetails: pickup.flat,
    deliveryHouseNumber: delivery.houseNumber,
    deliveryStreet: delivery.street,
    deliveryTown: delivery.town,
    deliveryPostcode: delivery.postcode,
    deliveryFlatDetails: delivery.flat,
  }
}

function validateStop(label, stop) {
  if (!stop.houseNumber) return `${label}: enter the house number.`
  if (!stop.postcode || !UK_POSTCODE.test(stop.postcode)) return `${label}: enter a UK postcode.`
  if (stop.address.length < 8) return `${label}: enter the full address.`
  return ''
}

function mergeInventory(existingLines, proposedLines) {
  if (!Array.isArray(proposedLines) || proposedLines.length === 0) {
    return { ok: false, error: 'Keep at least one item on the booking.' }
  }
  const catalog = catalogItems()
  const byId = new Map(catalog.map((item) => [String(item.id), item]))
  const byName = new Map(catalog.map((item) => [normName(item.name), item]))
  const existing = new Map(
    (Array.isArray(existingLines) ? existingLines : []).map((line) => [normName(line.name), line]),
  )
  /** @type {Array<Record<string, unknown>>} */
  const lines = []
  for (const raw of proposedLines) {
    const qty = Math.round(Number(raw?.quantity) || 0)
    if (qty < 1) continue
    if (qty > 99) return { ok: false, error: 'Item quantity cannot be more than 99.' }
    const name = String(raw?.name || '').trim()
    const prev = existing.get(normName(name))
    if (prev) {
      lines.push({ ...prev, quantity: qty })
      continue
    }
    const cat = byId.get(String(raw?.catalogId || '')) || byName.get(normName(name))
    if (!cat) return { ok: false, error: `“${name || 'Item'}” is not in the price list.` }
    lines.push({
      catalogId: cat.id,
      name: cat.name,
      quantity: qty,
      m3: Number(cat.m3) || 0.1,
      mult: Number(cat.mult) > 0 ? Number(cat.mult) : 1,
      weightType: cat.weightType || 'medium',
      heavyFee: cat.heavyFee,
      isCustom: false,
      categoryLabel: cat.categoryLabel || '',
    })
  }
  if (!lines.length) return { ok: false, error: 'Keep at least one item on the booking.' }
  return { ok: true, lines }
}

export function arrivalColumnsFromWizard(wizard) {
  if (wizard.arrivalWindow === 'exact' && wizard.exactArrivalTime) {
    return {
      arrivalType: 'exact',
      arrivalTime: String(wizard.exactArrivalTime),
      arrivalWindow: `${wizard.exactArrivalTime} (Exact time)`,
    }
  }
  if (wizard.arrivalWindow === 'flex_window' && wizard.flexibleArrivalFrom && wizard.flexibleArrivalUntil) {
    const range = `${wizard.flexibleArrivalFrom}–${wizard.flexibleArrivalUntil}`
    return {
      arrivalType: 'window',
      arrivalTime: range,
      arrivalWindow: `Flexible window · ${range}`,
    }
  }
  return {
    arrivalType: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
    arrivalTime: String(wizard.exactArrivalTime || wizard.flexibleArrivalFrom || ''),
    arrivalWindow: String(wizard.arrivalWindow || ''),
  }
}

export function inventoryJsonFromLines(lines) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    name: line.name,
    quantity: Number(line.quantity) || 1,
    m3: Number(line.m3) || 0,
    mult: Number(line.mult) > 0 ? Number(line.mult) : 1,
    weight_type: line.weightType || 'medium',
    is_custom: Boolean(line.isCustom),
    category: line.categoryLabel || '',
  }))
}

export function inventoryTextFromLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => `${line.name} × ${Number(line.quantity) || 1}`)
    .join('\n')
}

export function patchWizardSnapshot(details, wizard) {
  const text = String(details || '')
  const start = text.indexOf(SNAPSHOT_START)
  const end = start >= 0 ? text.indexOf(SNAPSHOT_END, start) : -1
  if (start < 0 || end < 0) return text
  try {
    const raw = text.slice(start + SNAPSHOT_START.length, end).trim()
    const parsed = JSON.parse(raw)
    parsed.wizard = { ...(parsed.wizard || {}), ...wizard }
    const block = `${SNAPSHOT_START}\n${JSON.stringify(parsed)}\n${SNAPSHOT_END}`
    return `${text.slice(0, start).trim()}\n\n${block}${text.slice(end + SNAPSHOT_END.length)}`.trim()
  } catch {
    return text
  }
}

export function bookingChangeRows(before, after) {
  /** @type {Array<{ label: string, previous: string, next: string }>} */
  const rows = []
  if (before.dateLabel !== after.dateLabel) {
    rows.push({ label: 'Move date', previous: before.dateLabel || '—', next: after.dateLabel || '—' })
  }
  if (before.arrivalLabel !== after.arrivalLabel) {
    rows.push({ label: 'Arrival', previous: before.arrivalLabel || '—', next: after.arrivalLabel || '—' })
  }
  if (inventorySignature(before.lines) !== inventorySignature(after.lines)) {
    rows.push({
      label: 'Items',
      previous: inventoryTextFromLines(before.lines).replaceAll('\n', ', ') || '—',
      next: inventoryTextFromLines(after.lines).replaceAll('\n', ', ') || '—',
    })
  }
  if (before.pickupLabel && before.pickupLabel !== after.pickupLabel) {
    rows.push({ label: 'Collection', previous: before.pickupLabel, next: after.pickupLabel || '—' })
  }
  if (before.deliveryLabel && before.deliveryLabel !== after.deliveryLabel) {
    rows.push({ label: 'Delivery', previous: before.deliveryLabel, next: after.deliveryLabel || '—' })
  }
  const beforeMiles = Number(before.miles)
  const afterMiles = Number(after.miles)
  if (Number.isFinite(beforeMiles) && Number.isFinite(afterMiles) && Math.abs(beforeMiles - afterMiles) > 0.15) {
    rows.push({
      label: 'Route',
      previous: `${beforeMiles.toFixed(1)} miles`,
      next: `${afterMiles.toFixed(1)} miles`,
    })
  }
  if (Math.abs(round2(before.total) - round2(after.total)) > 0.009) {
    rows.push({
      label: 'Price',
      previous: `£${round2(before.total).toFixed(2)}`,
      next: `£${round2(after.total).toFixed(2)}`,
    })
  }
  return rows
}

export function volumeIncreased(beforeLines, afterLines) {
  return sumLineVolume(afterLines) > sumLineVolume(beforeLines) + 0.05
}
