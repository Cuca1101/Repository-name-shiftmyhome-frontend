/**
 * Shared EmailJS quote enquiry text + standard template field shape.
 */

import { formatDateUK } from './formatDateDisplay'
import { formatPickupDeliveryContactsForSummary } from './quoteWizardContactFields'
import { getEffectiveReassemblyItemCount } from './quoteWizardReassembly'

/** @param {Record<string, unknown>} wizard */
function formatPickupDeliveryContactsBlock(wizard) {
  return formatPickupDeliveryContactsForSummary(wizard)
}

/** One line per item with volume line ~m³ for email body */
export function formatInventoryRowsForEmail(rows) {
  if (!rows?.length) return '—'
  return rows
    .map((l) => {
      const mult = l.handlingMultiplier ?? 1
      const vol = l.quantity * l.volumePerUnitM3 * mult
      const vr = Math.round(vol * 100) / 100
      const custom = l.isCustom ? ', custom' : ''
      const category = l.categoryLabel ? ` [${l.categoryLabel}]` : ''
      const sizeBand =
        l.customSizeBand && l.isCustom ? `, size: ${l.customSizeBand}` : ''
      const wt = l.weightType || 'std'
      const heavyFragile =
        wt === 'heavy' ? ', heavy' : wt === 'large' ? ', large' : ''
      return `  • ${l.name}${category} ×${l.quantity}  (~${vr} m³ line vol, ${wt}${heavyFragile}${sizeBand}${custom})`
    })
    .join('\n')
}

export function makeQuoteRef() {
  const y = new Date().getFullYear()
  const n = Math.floor(100000 + Math.random() * 900000)
  return `SMH-${y}-${n}`
}

export function formatQuoteBreakdownLines(b) {
  if (!b) return ''
  const baseLead =
    b.basePriceUsesPerManPricing &&
    b.crewSizeUsedInPricing != null &&
    b.basePricePerManUnit != null
      ? `Base (${b.crewSizeUsedInPricing} × £${b.basePricePerManUnit.toFixed(2)} per man)`
      : 'Base'
  const lines = [
    `${baseLead}: £${b.basePrice.toFixed(2)}`,
    `Distance: £${b.distancePrice.toFixed(2)}`,
    `Volume: £${b.volumePrice.toFixed(2)} (total ${b.totalCubicMetres.toFixed(2)} m³)`,
  ]
  for (const l of b.accessLines) lines.push(`${l.label}: £${l.amount.toFixed(2)}`)
  for (const l of b.extrasLines) lines.push(`${l.label}: £${l.amount.toFixed(2)}`)
  for (const l of b.surchargeLines) lines.push(`${l.label}: £${l.amount.toFixed(2)}`)
  for (const l of b.discountLines || []) {
    lines.push(`${l.label}: −£${l.amount.toFixed(2)}`)
  }
  if (b.minimumApplied > 0) lines.push(`Minimum job adjustment: £${b.minimumApplied.toFixed(2)}`)
  lines.push(`Estimated total: £${b.estimatedTotal.toFixed(2)}`)
  return lines.join('\n')
}

export const ARRIVAL_LABELS = {
  flex_window: 'Flexible collection window',
  flex: 'Flexible on time',
  morning: 'Morning · 08:00–12:00',
  midday: 'Midday · 12:00–16:00',
  /** @deprecated use evening — kept for older quotes */
  afternoon: 'Evening · 16:00–20:00',
  evening: 'Evening · 16:00–20:00',
  exact: 'Exact arrival time (premium)',
}

/**
 * Short label for emails / breakdown context (not including "Arrival:" prefix).
 * @param {{ arrivalWindow?: string, exactArrivalTime?: string } | null | undefined} wizard
 */
export function formatWizardArrivalSummary(wizard) {
  if (!wizard) return '—'
  const awRaw = wizard.arrivalWindow
  const aw = awRaw === 'afternoon' ? 'evening' : awRaw
  if (aw === 'flex_window' && wizard.flexibleArrivalFrom && wizard.flexibleArrivalUntil) {
    return `Flexible window · ${wizard.flexibleArrivalFrom}–${wizard.flexibleArrivalUntil}`
  }
  if (aw === 'exact' && wizard.exactArrivalTime) {
    return `${wizard.exactArrivalTime} (Exact time)`
  }
  return ARRIVAL_LABELS[aw] || ARRIVAL_LABELS[wizard.arrivalWindow] || wizard.arrivalWindow || '—'
}

/** Compact arrival line for mobile move summary (no empty times). */
export function formatCompactArrivalLine(wizard) {
  if (!wizard) return null
  if (
    wizard.arrivalWindow === 'flex_window' &&
    wizard.flexibleArrivalFrom &&
    wizard.flexibleArrivalUntil
  ) {
    return `Arrival window: ${wizard.flexibleArrivalFrom} – ${wizard.flexibleArrivalUntil}`
  }
  if (wizard.arrivalWindow === 'exact' && wizard.exactArrivalTime) {
    return `Exact arrival: ${wizard.exactArrivalTime}`
  }
  return null
}

/** @param {{ arrivalWindow?: string, exactArrivalTime?: string, flexibleArrivalFrom?: string, flexibleArrivalUntil?: string } | null | undefined} wizard */
export function getWizardArrivalTimePayload(wizard) {
  if (!wizard) return ''
  if (wizard.arrivalWindow === 'exact') {
    return (wizard.exactArrivalTime || '').trim()
  }
  if (wizard.arrivalWindow === 'flex_window') {
    const from = (wizard.flexibleArrivalFrom || '').trim()
    const until = (wizard.flexibleArrivalUntil || '').trim()
    if (from && until) return `${from}–${until}`
  }
  return ''
}

/**
 * Full line for UI summaries: "Arrival: …"
 * @param {{ arrivalWindow?: string, exactArrivalTime?: string } | null | undefined} wizard
 */
export function formatWizardArrivalTitle(wizard) {
  const inner = formatWizardArrivalSummary(wizard)
  if (inner === '—') return inner
  if (wizard?.arrivalWindow === 'exact' && wizard?.exactArrivalTime) {
    return `Arrival: ${wizard.exactArrivalTime} (Exact time)`
  }
  return `Arrival: ${inner}`
}

export const PARKING_LABELS = {
  easy: 'Easy — close to door',
  standard: 'Standard street parking',
  long: 'Extended carry / awkward parking',
}

export const WALKING_LABELS = {
  short: 'Short',
  standard: 'Typical',
  long: 'Long walk / courtyard / flats corridor',
}

/**
 * Human-readable block for packing / dismantling / reassembly request details (wizard or compatible shape).
 * @param {Record<string, unknown>} wizard
 */
export function formatWizardServiceExtrasBlock(wizard) {
  if (!wizard) return ''
  const blocks = []
  if (wizard.packing) {
    const bits = ['Packing requested']
    if (wizard.packingWhat) bits.push(`What to pack: ${wizard.packingWhat}`)
    const boxes = Number(wizard.packingApproxBoxes)
    if (Number.isFinite(boxes) && boxes > 0) bits.push(`Approx boxes/items: ${boxes}`)
    bits.push(`Fragile items: ${wizard.packingFragile ? 'Yes' : 'No'}`)
    bits.push(`Packing materials required: ${wizard.packingMaterials ? 'Yes' : 'No'}`)
    const materialsDetail = String(
      wizard.packingMaterialsDetail || '',
    ).trim()
    if (wizard.packingMaterials && materialsDetail) {
      bits.push(`Packing materials:\n${materialsDetail}`)
    }
    blocks.push(bits.join('\n'))
  }
  if (wizard.dismantling) {
    const bits = ['Dismantling requested']
    if (wizard.dismantlingWhat) bits.push(`Items: ${wizard.dismantlingWhat}`)
    const n = Number(wizard.dismantlingItemCount)
    if (Number.isFinite(n) && n > 0) bits.push(`How many items: ${n}`)
    blocks.push(bits.join('\n'))
  }
  if (wizard.reassembly) {
    const bits = ['Reassembly requested']
    const n = getEffectiveReassemblyItemCount(wizard)
    if (Number.isFinite(n) && n > 0) bits.push(`How many items: ${n}`)
    bits.push(`Same items as dismantling: ${wizard.reassemblySameAsDismantling ? 'Yes' : 'No'}`)
    if (wizard.reassemblyWhat) bits.push(`Items: ${wizard.reassemblyWhat}`)
    blocks.push(bits.join('\n'))
  }
  return blocks.filter(Boolean).join('\n\n')
}

/** Short lines for move summary sidebar */
export function formatWizardServiceExtrasSummary(wizard) {
  const block = formatWizardServiceExtrasBlock(wizard).trim()
  if (!block) return ''
  return block
}

function joinBlocks(blocks) {
  return blocks
    .flat()
    .filter((line) => line != null && line !== false)
    .join('\n')
}

export function buildWizardFullSummaryText({
  wizard,
  serviceType,
  quoteRef,
  breakdown,
  photoFileNames = [],
}) {
  const rowsForEmail =
    wizard.inventoryLines?.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      volumePerUnitM3: l.m3,
      handlingMultiplier: l.mult ?? 1,
      weightType: l.weightType,
      isCustom: l.isCustom,
      categoryLabel: l.categoryLabel,
      customSizeBand: l.customSizeBand,
    })) ?? []
  const inv = formatInventoryRowsForEmail(rowsForEmail)

  const extrasDetail = formatWizardServiceExtrasBlock(wizard)

  const photoLine =
    photoFileNames.length > 0
      ? `Photos listed for upload: ${photoFileNames.length} file(s) — ${photoFileNames.join(', ')}`
      : null

  const priceBlock = breakdown ? formatQuoteBreakdownLines(breakdown) : null

  return joinBlocks([
    '=== QUOTE ENQUIRY (step-by-step wizard) ===',
    `Quote reference: ${quoteRef || '—'}`,
    '',
    '— Customer —',
    `Name: ${wizard.fullName || '—'}`,
    `Email: ${wizard.email || '—'}`,
    `Phone: ${wizard.phone || '—'}`,
    '',
    formatPickupDeliveryContactsBlock(wizard),
    '',
    '— Service —',
    `Selected service: ${serviceType || '—'}`,
    `Crew size: ${wizard.crewSize ? `${wizard.crewSize} ${Number(wizard.crewSize) === 1 ? 'Man' : 'Men'}` : '—'}`,
    `Route distance (miles): ${wizard.distanceMiles != null && wizard.distanceMiles !== '' ? wizard.distanceMiles : '—'}`,
    `Move date: ${wizard.moveDate ? formatDateUK(wizard.moveDate) : '—'}`,
    `Preferred arrival: ${formatWizardArrivalSummary(wizard)}`,
    wizard.arrivalWindow === 'exact'
      ? 'Note: Exact time requests are subject to route availability.'
      : null,
    '',
    '— Addresses —',
    `Pickup / collection: ${wizard.pickupAddress || '—'}`,
    `Delivery: ${wizard.deliveryAddress || '—'}`,
    '',
    '— Pickup property & access —',
    `Property type: ${wizard.pickupPropertyType || '—'}`,
    `Floor: ${wizard.pickupFloor != null ? wizard.pickupFloor : '—'}`,
    `Lift: ${wizard.pickupLift ? 'Yes' : 'No'}`,
    '',
    '— Delivery property & access —',
    `Property type: ${wizard.deliveryPropertyType || '—'}`,
    `Floor: ${wizard.deliveryFloor != null ? wizard.deliveryFloor : '—'}`,
    `Lift: ${wizard.deliveryLift ? 'Yes' : 'No'}`,
    '',
    '— Access & carry (both ends factored in pricing) —',
    `Parking / vehicle access: ${PARKING_LABELS[wizard.parkingDistance] || wizard.parkingDistance || '—'}`,
    `Walking distance (van to door): ${WALKING_LABELS[wizard.walkingDistance] || wizard.walkingDistance || '—'}`,
    `Flights of stairs (estimate): ${wizard.stairsFlights != null ? wizard.stairsFlights : '—'}`,
    wizard.stairsNotes && `Stairs & access notes: ${wizard.stairsNotes}`,
    wizard.heavyNotes && `Heavy / bulky items notes: ${wizard.heavyNotes}`,
    wizard.specialInstructions && `Special instructions: ${wizard.specialInstructions}`,
    photoLine,
    '',
    '— Extra services —',
    extrasDetail.trim() ? extrasDetail : 'None selected',
    '',
    '— Inventory —',
    inv,
    '',
    '— Estimated price —',
    priceBlock || 'Not available',
  ])
}

/**
 * @param {object} ctx
 */
export function buildQuoteFormFullSummaryText(ctx) {
  const {
    contact,
    effectiveServiceType,
    quoteRef,
    breakdown,
    variant,
    distanceMiles,
    pickupFloor,
    deliveryFloor,
    hasLift,
    longWalk,
    parking,
    stairsFlights,
    packing,
    packingWhat = '',
    packingApproxBoxes = 0,
    packingFragile = false,
    packingMaterials = false,
    dismantling,
    dismantlingWhat = '',
    dismantlingItemCount = 0,
    reassembly,
    reassemblyWhat = '',
    reassemblyItemCount = 0,
    reassemblySameAsDismantling = false,
    derivedWaitingHours,
    derivedExtraHelpers,
    sameDay,
    invSummary,
    tailoredLines = [],
  } = ctx

  const servicesDetail = formatWizardServiceExtrasBlock({
    packing,
    packingWhat,
    packingApproxBoxes,
    packingFragile,
    packingMaterials,
    dismantling,
    dismantlingWhat,
    dismantlingItemCount,
    reassembly,
    reassemblyWhat,
    reassemblyItemCount,
    reassemblySameAsDismantling,
  }).trim()

  const extrasTail = [
    derivedWaitingHours > 0 && `Waiting / time on site (hours): ${derivedWaitingHours}`,
    derivedExtraHelpers > 0 && `Extra helpers: ${derivedExtraHelpers}`,
    sameDay && 'Same-day move',
  ].filter(Boolean)

  const extrasSection = [servicesDetail, extrasTail.join('\n')]
    .filter((s) => String(s).trim())
    .join('\n\n')

  const access = [
    `Pickup floor: ${pickupFloor != null ? pickupFloor : '—'}`,
    `Delivery floor: ${deliveryFloor != null ? deliveryFloor : '—'}`,
    `Lift available (pricing uses same value at both ends in this form): ${hasLift ? 'Yes' : 'No'}`,
    `Long walk / carry: ${longWalk ? 'Yes' : 'No'}`,
    `Awkward parking / extended carry: ${parking ? 'Yes' : 'No'}`,
    `Stairs flights (estimate): ${stairsFlights != null ? stairsFlights : '—'}`,
  ]

  const priceBlock = breakdown ? formatQuoteBreakdownLines(breakdown) : null

  const variantBlock =
    tailoredLines.length > 0
      ? ['— Service-specific details —', ...tailoredLines].join('\n')
      : null

  return joinBlocks([
    '=== QUOTE ENQUIRY (quote form) ===',
    `Form variant: ${variant || '—'}`,
    `Quote reference: ${quoteRef || '—'}`,
    '',
    '— Customer —',
    `Name: ${contact.fullName || '—'}`,
    `Email: ${contact.email || '—'}`,
    `Phone: ${contact.phone || '—'}`,
    contact.message?.trim() && `Free-text message: ${contact.message.trim()}`,
    '',
    '— Service —',
    `Selected service: ${effectiveServiceType || '—'}`,
    `Route distance (miles): ${distanceMiles != null && distanceMiles !== '' ? distanceMiles : '—'}`,
    `Move date: ${contact.moveDate ? formatDateUK(contact.moveDate) : '—'}`,
    variantBlock,
    '',
    '— Addresses —',
    `Pickup / collection: ${contact.pickupAddress || '—'}`,
    `Delivery: ${contact.deliveryAddress || '—'}`,
    '',
    '— Property / access —',
    ...access.map((s) => s),
    '',
    '— Extra services —',
    extrasSection.trim() ? extrasSection : 'None selected',
    '',
    '— Inventory / items —',
    invSummary || '—',
    '',
    '— Estimated price —',
    priceBlock || 'Not available',
  ])
}

/**
 * Standard EmailJS template variables for quote flows (plain-text summary in `details`).
 */
export function buildQuoteEmailTemplateParams({
  name,
  email,
  phone,
  service,
  pickup,
  delivery,
  move_date,
  quote_ref,
  details,
  /** Optional — inventory summary text (also useful for PDF); omit from EmailJS template if unused */
  inventory,
  /** Optional — pricing / breakdown text (also useful for PDF) */
  pricing,
  /** @type {'window'|'exact'|undefined} */
  arrival_type,
  /** @type {string|undefined} HH:mm when exact */
  arrival_time,
}) {
  const md = (move_date ?? '').trim()
  const isIso = /^\d{4}-\d{2}-\d{2}$/.test(md)
  const base = {
    name: name || '',
    email: email || '',
    phone: phone || '',
    service: service || '',
    pickup: pickup || '',
    delivery: delivery || '',
    /** UK display for EmailJS / PDF short field — DB row uses `move_date_iso` when present */
    move_date: isIso ? formatDateUK(md) || md : formatDateUK(md) || md || '',
    move_date_iso: isIso ? md : '',
    quote_ref: quote_ref || '',
    details: details || '',
    arrival_type: arrival_type || '',
    arrival_time: arrival_time || '',
  }
  if (inventory != null && String(inventory).trim() !== '') {
    base.inventory = String(inventory)
  }
  if (pricing != null && String(pricing).trim() !== '') {
    base.pricing = String(pricing)
  }
  return base
}
