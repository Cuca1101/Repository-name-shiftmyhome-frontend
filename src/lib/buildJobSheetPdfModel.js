/**
 * Read-only view model for Job Sheet PDF (quotes-first).
 * Does not mutate quote data or perform pricing.
 */

import { CONTACT } from '../config'
import { formatWizardServiceExtrasBlock } from './emailQuotePayload'
import { formatDateTimeUK, formatDateUK } from './formatDateDisplay'
import { buildAvailableJobInventoryDisplayRows } from './availableJobInventoryDisplay'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  formatMoveArrivalSummary,
  formatVolumeAndCrew,
  mergeDetailSections,
  parseDetailsKeyValues,
  parsePricingText,
  parseWizardStructured,
  resolveFinancials,
} from './quoteJobAdminModel'
import { buildAdminJobQuoteDetailsViewModel, liftReadable } from './adminJobQuoteDetailsViewModel'

/** @param {unknown} v */
export function pdfField(v) {
  if (v == null || v === '') return 'N/A'
  const s = String(v).trim()
  if (!s || s === '—' || s === 'undefined' || s === 'null') return 'N/A'
  return s
}

/**
 * @param {string | null | undefined} addressText
 */
function extractUkPostcode(addressText) {
  if (addressText == null || addressText === '') return ''
  const m = String(addressText).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  if (!m) return ''
  return m[1].replace(/\s+/g, ' ').toUpperCase()
}

/**
 * City/town label when no postcode on delivery.
 * @param {string} address
 */
function deliveryRouteLabel(address) {
  const pc = extractUkPostcode(address)
  if (pc) return pc
  const s = String(address).trim()
  if (!s) return ''
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 1]
  return s.length > 32 ? `${s.slice(0, 29)}…` : s
}

/**
 * @param {string} s
 */
function normDedupKey(s) {
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * @param {Set<string>} seen
 * @param {string[]} lines
 * @param {string | null} label
 * @param {unknown} value
 */
function pushNote(seen, lines, label, value) {
  const v = String(value ?? '').trim()
  if (!v || v === '—' || v === 'N/A') return
  const key = normDedupKey(v)
  if (seen.has(key)) return
  seen.add(key)
  lines.push(label ? `${label}: ${v}` : v)
}

/**
 * Raw text between section markers in enquiry details.
 * @param {unknown} details
 * @param {string} sectionTitle
 */
function extractDetailsSectionBody(details, sectionTitle) {
  const text = String(details ?? '')
  const esc = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`—\\s*${esc}\\s*—\\s*\\n([\\s\\S]*?)(?=\\n—\\s*.+?\\s*—|$)`, 'i')
  const m = text.match(re)
  if (!m) return ''
  return m[1]
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (/^[^:]+:\s*.+$/.test(t) && !t.startsWith('Packing') && !t.startsWith('Dismantling')) {
        return false
      }
      return true
    })
    .join('\n')
    .trim()
}

/**
 * Collect all non-inventory operational notes for the driver (deduplicated).
 * @param {Record<string, unknown>} q
 * @param {ReturnType<typeof buildAdminJobQuoteDetailsViewModel>} vm
 * @param {Record<string, string>} kv
 * @param {Record<string, Record<string, string>>} sections
 * @param {ReturnType<typeof mergedAdminWorkflowForQuote>} overrides
 * @param {{ internalNotes?: string }} options
 */
export function buildJobSheetSpecialInstructions(q, vm, kv, sections, overrides, options = {}) {
  const seen = new Set()
  /** @type {string[]} */
  const lines = []

  const accessCarry = sections['Access & carry (both ends factored in pricing)'] || {}
  const pickupSec = sections['Pickup property & access'] || {}
  const deliverySec = sections['Delivery property & access'] || {}
  const serviceSec = sections['Service'] || {}
  const formAccess = mergeDetailSections(sections, ['Property / access'])

  pushNote(seen, lines, 'Customer notes', q.customer_message)

  for (const part of String(vm.specialInstructions || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    if (part === '—') continue
    pushNote(seen, lines, null, part.replace(/^Special instructions:\s*/i, ''))
  }

  for (const key of ['Special instructions', 'Customer message', 'Additional notes', 'Notes']) {
    pushNote(seen, lines, null, kv[key])
    pushNote(seen, lines, null, serviceSec[key])
    pushNote(seen, lines, null, accessCarry[key])
  }

  pushNote(seen, lines, 'Heavy / bulky items', accessCarry['Heavy / bulky items notes'] || kv['Heavy / bulky items notes'])

  const arrivalSummary = formatMoveArrivalSummary(q, { ...kv, ...serviceSec })
  if (arrivalSummary && arrivalSummary !== '—') {
    pushNote(seen, lines, 'Arrival window', arrivalSummary)
  }
  if (String(q.arrival_type || '').toLowerCase() === 'exact' && q.arrival_time) {
    pushNote(seen, lines, null, 'Exact arrival time requested (subject to route availability).')
  } else if (String(q.arrival_type || '').toLowerCase() === 'window') {
    pushNote(seen, lines, null, 'Flexible arrival window — confirm with customer if needed.')
  }
  if (serviceSec['Note'] || kv['Note']) {
    pushNote(seen, lines, null, serviceSec['Note'] || kv['Note'])
  }

  const parkingLabel =
    accessCarry['Parking / vehicle access'] ||
    (formAccess['Awkward parking / extended carry'] ? 'Awkward / extended parking' : '')
  const walkingLabel =
    accessCarry['Walking distance (van to door)'] ||
    (formAccess['Long walk / carry'] === 'Yes' ? 'Long walk from van to door' : '')
  const stairsFlights = accessCarry['Flights of stairs (estimate)'] || formAccess['Stairs flights (estimate)']
  const stairsNotes = accessCarry['Stairs & access notes']

  if (pickupSec.Floor && pickupSec.Floor !== '—') {
    pushNote(seen, lines, 'Pickup floor', pickupSec.Floor)
  } else if (vm.pickupFloor !== '—') {
    pushNote(seen, lines, 'Pickup floor', vm.pickupFloor)
  }
  if (pickupSec.Lift) pushNote(seen, lines, 'Pickup lift', liftReadable(pickupSec.Lift))
  if (deliverySec.Floor && deliverySec.Floor !== '—') {
    pushNote(seen, lines, 'Delivery floor', deliverySec.Floor)
  } else if (vm.deliveryFloor !== '—') {
    pushNote(seen, lines, 'Delivery floor', vm.deliveryFloor)
  }
  if (deliverySec.Lift) pushNote(seen, lines, 'Delivery lift', liftReadable(deliverySec.Lift))
  if (stairsFlights) pushNote(seen, lines, 'Stairs (estimate)', stairsFlights)
  if (stairsNotes && stairsNotes !== '—') pushNote(seen, lines, 'Stairs & access', stairsNotes)
  if (parkingLabel) pushNote(seen, lines, 'Parking / vehicle access', parkingLabel)
  if (walkingLabel) pushNote(seen, lines, 'Walking distance', walkingLabel)

  const extrasBlock = formatWizardServiceExtrasBlock({
    packing: /packing requested/i.test(extractDetailsSectionBody(q.details, 'Extra services')),
    packingWhat: kv['What to pack'] || '',
    packingApproxBoxes: Number(kv['Approx boxes/items']) || 0,
    packingFragile: /fragile:\s*yes/i.test(String(q.details || '')),
    packingMaterials: /packing materials:\s*yes/i.test(String(q.details || '')),
    dismantling: /dismantling requested/i.test(extractDetailsSectionBody(q.details, 'Extra services')),
    dismantlingWhat: kv['Items'] || '',
    dismantlingItemCount: Number(kv['How many items']) || 0,
    reassembly: /reassembly requested/i.test(extractDetailsSectionBody(q.details, 'Extra services')),
    reassemblyWhat: '',
    reassemblyItemCount: 0,
    reassemblySameAsDismantling: /same items as dismantling:\s*yes/i.test(String(q.details || '')),
  })
  if (extrasBlock) {
    for (const block of extrasBlock.split(/\n\n+/)) {
      pushNote(seen, lines, null, block)
    }
  }

  const extraServicesRaw = extractDetailsSectionBody(q.details, 'Extra services')
  if (extraServicesRaw && !/none selected/i.test(extraServicesRaw)) {
    pushNote(seen, lines, 'Extra services', extraServicesRaw)
  }

  const { lines: pricingLines } = parsePricingText(q.pricing)
  for (const row of pricingLines) {
    if (/packing|dismantl|reassembl|fragile|heavy item|waiting|helper/i.test(row.label)) {
      pushNote(seen, lines, row.label, `£${row.amount.toFixed(2)} booked`)
    }
  }

  pushNote(seen, lines, 'Admin notes', options.internalNotes)
  pushNote(seen, lines, 'Admin notes', overrides.internalNotes)
  pushNote(seen, lines, 'Admin log', overrides.adminNotesLog)
  pushNote(seen, lines, 'Completion note', overrides.adminCompletionNote)

  const driverName =
    String(q.assigned_driver_name || '').trim() || String(overrides.assignedDriver || '').trim()
  const partnerName =
    String(q.assigned_partner_company || '').trim() || String(overrides.assignedPartnerCompany || '').trim()
  if (driverName) pushNote(seen, lines, 'Assigned driver', driverName)
  if (partnerName) pushNote(seen, lines, 'Assigned partner', partnerName)
  if (q.vehicle_size && String(q.vehicle_size).trim()) {
    pushNote(seen, lines, 'Vehicle', String(q.vehicle_size).trim())
  }

  const skipKey =
    /^(name|email|phone|quote reference|selected service|crew size|route distance|move date|preferred arrival|pickup|delivery|property type|floor|lift|parking|walking|flights|item|qty|volume|estimated|stripe|payment)/i

  for (const [k, v] of Object.entries(kv)) {
    if (skipKey.test(k)) continue
    if (/inventory|m³|×\d/i.test(v)) continue
    pushNote(seen, lines, k, v)
  }

  return lines
}

/**
 * @param {string[]} bullets
 */
export function formatSpecialInstructionsForPdf(bullets) {
  if (!bullets.length) return 'No special instructions provided.'
  return bullets.join('\n')
}

/**
 * City/area label for route summary (prefer place name over postcode).
 * @param {string} address
 */
function routePlaceLabel(address) {
  const s = String(address).trim()
  if (!s) return ''
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  const nonPostcode = parts.filter((p) => !/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(p))
  if (nonPostcode.length >= 2) return nonPostcode[nonPostcode.length - 1]
  if (nonPostcode.length === 1) return nonPostcode[0]
  return deliveryRouteLabel(address)
}

/**
 * @param {string} service
 */
export function formatServiceHeadline(service) {
  const s = String(service || '').trim()
  if (!s || s === 'N/A') return 'Removal job'
  const low = s.toLowerCase()
  if (/furniture/i.test(low)) return 'Furniture move'
  if (/house|home/i.test(low) && /removal/i.test(low)) return 'House removal'
  if (/office|commercial/i.test(low)) return 'Office removal'
  if (/man\s*&\s*van|man and van/i.test(low)) return 'Man & van'
  if (/single/i.test(low)) return 'Single item move'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * @param {string} crew
 */
export function formatCrewLine(crew) {
  const n = parseInt(String(crew), 10)
  if (Number.isFinite(n) && n > 0) {
    return `${n} ${n === 1 ? 'Person' : 'People'} required`
  }
  const s = String(crew || '').trim()
  if (!s || s === 'N/A' || s === '—') return ''
  return `${s} required`
}

/**
 * @param {string} service
 * @param {string} quoteRef
 * @param {string} moveDate
 * @param {string} arrival
 */
export function buildJobSheetTitleLine(service, quoteRef, moveDate, arrival) {
  const headline = formatServiceHeadline(service)
  const ref = quoteRef && quoteRef !== 'N/A' ? quoteRef : '—'
  const date = moveDate && moveDate !== 'N/A' ? moveDate : '—'
  const arr = arrival && arrival !== 'N/A' ? arrival : '—'
  return `${headline} (${ref}) - ${date} - ${arr}`
}

/**
 * @param {{ item: string, qty: string }[]} inventoryRows
 * @param {string} volumeM3
 * @param {string} pickupAddress
 * @param {string} deliveryAddress
 */
export function buildJobSummaryLine(inventoryRows, volumeM3, pickupAddress, deliveryAddress) {
  const itemPart =
    inventoryRows.length > 0
      ? inventoryRows.map((r) => `${r.qty}× ${r.item}`).join(', ')
      : 'See inventory list'
  const volPart = volumeM3 && volumeM3 !== 'N/A' ? ` (${volumeM3})` : ''
  const fromLabel = routePlaceLabel(pickupAddress) || 'pickup'
  const toLabel = routePlaceLabel(deliveryAddress) || 'delivery'
  return `${itemPart}${volPart} from ${fromLabel} to ${toLabel}`
}

/**
 * @param {Record<string, unknown>} q
 * @param {{ customerTotal: number|null, paid: number, remaining: number|null }} fin
 */
export function jobSheetPaymentBadge(q, fin) {
  const ps = String(q.payment_status || '').toLowerCase()
  const remaining = fin.remaining != null ? Number(fin.remaining) : null
  if (ps === 'paid' && (remaining == null || remaining <= 0.01)) {
    return { label: 'PAID IN FULL', bg: '#059669', color: '#fff' }
  }
  if (ps === 'deposit_paid' || String(q.payment_type || '').toLowerCase() === 'deposit') {
    return { label: 'DEPOSIT PAID', bg: '#0284c7', color: '#fff' }
  }
  return { label: 'BALANCE DUE', bg: '#d97706', color: '#fff' }
}

/**
 * @param {Record<string, unknown>} q
 * @param {{ customerTotal: number|null, paid: number, remaining: number|null }} fin
 */
function buildPaymentNote(q, fin) {
  const ps = String(q.payment_status || '').toLowerCase()
  const remaining = fin.remaining != null ? Number(fin.remaining) : null
  if (ps === 'paid' && (remaining == null || remaining <= 0.01)) {
    return 'Customer has paid in full.'
  }
  if (ps === 'deposit_paid' || String(q.payment_type || '').toLowerCase() === 'deposit') {
    const bal = remaining != null ? `£${remaining.toFixed(2)}` : 'see office'
    return `Deposit paid. Balance due: ${bal}.`
  }
  const bal = remaining != null ? `£${remaining.toFixed(2)}` : 'see office'
  return `Balance due on completion: ${bal}.`
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 */
export function buildJobSheetPdfModel(quote, options = {}) {
  const q = quote && typeof quote === 'object' ? quote : {}
  const vm = buildAdminJobQuoteDetailsViewModel(q)
  const kv = parseDetailsKeyValues(q.details)
  const sections = parseWizardStructured(q.details)
  const overrides = mergedAdminWorkflowForQuote(q)
  const adjSum = options.adjustmentsSumGbp ?? (overrides.adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0)
  const fin = resolveFinancials(q, adjSum)
  const badge = jobSheetPaymentBadge(q, fin)
  const pricingParsed = parsePricingText(q.pricing)

  const volumeM3 =
    pricingParsed.volumeM3 != null
      ? `${pricingParsed.volumeM3.toFixed(2)}m³`
      : q.total_cubic_metres != null && Number(q.total_cubic_metres) > 0
        ? `${Number(q.total_cubic_metres).toFixed(2)}m³`
        : vm.volumeLine !== '—'
          ? vm.volumeLine.replace(/\s*m³/i, 'm³')
          : 'N/A'

  const driver =
    String(q.assigned_driver_name || '').trim() ||
    String(overrides.assignedDriver || '').trim() ||
    ''
  const partner =
    String(q.assigned_partner_company || '').trim() ||
    String(overrides.assignedPartnerCompany || '').trim() ||
    ''
  const vanType = q.vehicle_size != null && String(q.vehicle_size).trim() !== '' ? String(q.vehicle_size) : ''

  const inventoryRows = buildAvailableJobInventoryDisplayRows(q).map((row) => {
    const custom =
      /custom/i.test(String(row.sizeType || '')) ||
      /custom/i.test(String(row.name || '')) ||
      String(row.sizeType || '').toLowerCase() === 'custom'
    const notes = [row.sizeType && row.sizeType !== '—' ? String(row.sizeType) : '', custom ? 'Custom item' : '']
      .filter(Boolean)
      .join(' · ')
    return {
      item: String(row.name || 'Item'),
      qty: String(row.qty ?? 1),
      volume: String(row.volume || 'N/A'),
      notes: notes || 'N/A',
    }
  })

  const pickupSec = sections['Pickup property & access'] || {}
  const deliverySec = sections['Delivery property & access'] || {}
  const accessCarry = sections['Access & carry (both ends factored in pricing)'] || {}

  const pickupAccessNotes = [
    vm.stairs !== '—' && vm.stairs ? `Stairs: ${vm.stairs}` : '',
    vm.stairsNotes !== '—' ? vm.stairsNotes : '',
    pickupSec['Access notes'] || kv['Pickup access notes'] || '',
  ]
    .filter(Boolean)
    .join(' · ')

  const deliveryAccessNotes = [
    deliverySec['Access notes'] || kv['Delivery access notes'] || '',
    deliverySec['Stairs & access notes'] || '',
  ]
    .filter(Boolean)
    .join(' · ')

  const specialInstructionsBullets = buildJobSheetSpecialInstructions(q, vm, kv, sections, overrides, options)
  const specialInstructions = formatSpecialInstructionsForPdf(specialInstructionsBullets)
  const moveDate = q.move_date ? formatDateUK(q.move_date) : 'N/A'
  const arrival = pdfField(formatMoveArrivalSummary(q, kv))
  const serviceLabel = pdfField(vm.serviceLabel)
  const crewDisplay = pdfField(vm.crewDisplay)

  return {
    quoteRef: pdfField(q.quote_ref || q.id),
    generatedAt: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    paymentBadge: badge,
    paymentNote: buildPaymentNote(q, fin),
    titleLine: buildJobSheetTitleLine(serviceLabel, pdfField(q.quote_ref || q.id), moveDate, arrival),
    serviceHeadline: formatServiceHeadline(serviceLabel),
    crewLine: formatCrewLine(crewDisplay),
    operationalNotices: [
      'This job requires POD completion.',
      'Contact customer before collection.',
      buildPaymentNote(q, fin),
    ],
    specialInstructionsBullets,
    jobSummaryLine: buildJobSummaryLine(
      inventoryRows,
      volumeM3,
      vm.pickupAddress,
      vm.deliveryAddress,
    ),
    customer: {
      name: pdfField(q.full_name),
      phone: pdfField(q.phone),
      email: pdfField(q.email),
    },
    move: {
      date: moveDate,
      arrival,
      service: serviceLabel,
      crew: crewDisplay,
      volume: pdfField(vm.volumeLine),
      created: pdfField(q.created_at ? formatDateTimeUK(q.created_at) : ''),
      distance: pdfField(vm.distanceDisplay),
    },
    pickup: {
      contactName: pdfField(kv['Pickup contact'] || kv['Collection contact'] || q.full_name),
      phone: pdfField(kv['Pickup phone'] || q.phone),
      address: pdfField(vm.pickupAddress),
      propertyType: pdfField(vm.pickupType),
      floor: pdfField(vm.pickupFloor),
      lift: pdfField(liftReadable(vm.pickupLiftRaw)),
      parking: pdfField(accessCarry['Parking / vehicle access'] || vm.parking),
      walking: pdfField(accessCarry['Walking distance (van to door)'] || vm.walking),
      accessNotes: pdfField(pickupAccessNotes),
    },
    delivery: {
      contactName: pdfField(kv['Delivery contact'] || kv['Delivery name'] || q.full_name),
      phone: pdfField(kv['Delivery phone'] || q.phone),
      address: pdfField(vm.deliveryAddress),
      propertyType: pdfField(vm.deliveryType),
      floor: pdfField(vm.deliveryFloor),
      lift: pdfField(liftReadable(vm.deliveryLiftRaw)),
      parking: pdfField(deliverySec['Parking'] || accessCarry['Parking / vehicle access'] || vm.parking),
      walking: pdfField(deliverySec['Walking distance'] || accessCarry['Walking distance (van to door)'] || vm.walking),
      accessNotes: pdfField(deliveryAccessNotes || (vm.stairsNotes !== '—' ? vm.stairsNotes : '')),
    },
    inventory: inventoryRows,
    inventorySummary: pdfField(formatVolumeAndCrew(q)),
    payment: {
      estimatedTotal: fin.customerTotal != null ? `£${fin.customerTotal.toFixed(2)}` : 'N/A',
      paid: fin.paid != null ? `£${fin.paid.toFixed(2)}` : 'N/A',
      balance: fin.remaining != null ? `£${fin.remaining.toFixed(2)}` : 'N/A',
    },
    operations: {
      driver: pdfField(driver),
      partner: pdfField(partner),
      vanType: pdfField(vanType),
      operationalStatus: pdfField(q.operational_status || overrides.operationalStatus),
    },
    specialInstructions,
    footer: {
      brand: 'ShiftMyHome Ltd',
      email: 'support@shiftmyhome.co.uk',
      website: 'www.shiftmyhome.co.uk',
      phone: CONTACT.phoneDisplay,
      disclaimer:
        'This job sheet is for operational use by ShiftMyHome and assigned transport partners.',
    },
  }
}
