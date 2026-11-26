/**
 * Copy admin edits on a customer lead (price note, special instructions, items)
 * onto the linked booking without changing prices.
 */
import { sumCustomerLeadInventoryVolume } from './customerLeadCapture'
import {
  appendWizardSnapshotToDetails,
  extractWizardSnapshotFromDetails,
} from './adminPhoneBookingWizardSnapshot'
import { formatWizardArrivalSummary, getWizardArrivalTimePayload } from './emailQuotePayload'
import { liftValueForFloor } from './floorAccess'
import { normalizeServiceType } from './normalizeServiceType'
import { applyInstructionEdit, instructionFields, readInstructionParts } from './instructionAuthors.js'
import { parsePackingMaterialQuantities } from './packingMaterialsCatalog.js'
import { syncSuppliedBoxesIntoInventory } from './suppliedBoxesInventory.js'

/**
 * @param {Record<string, unknown> | null | undefined} lead
 */
export function leadWizardSteps(lead) {
  const wd = lead?.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const step1 = wd.step1 && typeof wd.step1 === 'object' ? wd.step1 : {}
  const step2 = wd.step2 && typeof wd.step2 === 'object' ? wd.step2 : {}
  const step3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}
  return { wd, step1, step2, step3 }
}

/**
 * @param {Record<string, unknown>} raw
 * @param {number} [index]
 */
export function normalizeAdminInventoryLine(raw, index = 0) {
  const name = String(raw?.name || '').trim()
  const quantity = Math.max(1, Math.round(Number(raw?.quantity) || 1))
  const m3raw = raw?.m3 ?? raw?.volumePerUnitM3
  const m3num = m3raw == null || m3raw === '' ? null : Number(m3raw)
  const m3 = Number.isFinite(m3num) && m3num >= 0 ? Math.round(m3num * 1000) / 1000 : null
  return {
    lineId: String(raw?.lineId || `lead-${index}-${name.toLowerCase()}`),
    catalogId: raw?.catalogId ?? null,
    name,
    quantity,
    m3,
    volumePerUnitM3: m3,
    weightType: String(raw?.weightType || raw?.weight_type || 'std'),
    mult: Number(raw?.mult) > 0 ? Number(raw.mult) : 1,
    isCustom: Boolean(raw?.isCustom),
    categoryLabel: String(raw?.categoryLabel || raw?.category || ''),
    suppliedByUs: Boolean(raw?.suppliedByUs) || String(raw?.lineId || '').startsWith('supplied-box:'),
    suppliedMaterialId: raw?.suppliedMaterialId ?? null,
  }
}

/**
 * Price note becomes the special instruction when that field is empty or still
 * holds the previous price note. A longer instruction written by hand is kept,
 * and the new note is added once.
 * @param {unknown} existing
 * @param {unknown} note
 * @param {unknown} [previousNote]
 */
export function mergePriceNoteIntoSpecialInstructions(existing, note, previousNote = '') {
  const current = String(existing || '').trim()
  const next = String(note || '').trim()
  const previous = String(previousNote || '').trim()
  if (!next) {
    if (previous && current === previous) return ''
    return current
  }
  if (!current || current === previous) return next
  if (current === next) return current
  const lines = current.split('\n').map((line) => line.trim())
  if (lines.includes(next)) return current
  return `${current}\n${next}`
}

/**
 * Remove one exact copy of an admin price note from a combined instructions string.
 * @param {unknown} text
 * @param {unknown} note
 */
function withoutNoteLine(text, note) {
  const current = String(text || '').trim()
  const extra = String(note || '').trim()
  if (!current) return ''
  if (!extra) return current
  if (current === extra) return ''
  const kept = []
  let removed = false
  for (const line of current.split('\n')) {
    if (!removed && line.trim() === extra) {
      removed = true
      continue
    }
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Keep special instructions as the customer's words. The price note stays a note. */
export function removePriceNoteFromInstructions(text, note) {
  return withoutNoteLine(text, note)
}

/**
 * Split a lead note into the customer's words and the admin's words.
 * @param {Record<string, unknown>|null|undefined} lead
 * @returns {{ customer: string, admin: string }}
 */
export function notesForCustomerEmail(lead) {
  const { step3 } = leadWizardSteps(lead || {})
  const note = String(lead?.price_override_reason || '').trim()
  const parts = readInstructionParts(step3, note)
  let admin = parts.admin
  if (note && admin !== note && !admin.split('\n').some((line) => line.trim() === note)) {
    admin = admin ? `${admin}\n${note}` : note
  }
  if (admin === parts.customer) admin = note && note !== parts.customer ? note : ''
  return { customer: parts.customer, admin }
}

/**
 * @param {string} text
 * @param {string} label
 * @param {string} value
 */
function replaceLabeledLine(text, label, value) {
  const lines = String(text || '').split('\n')
  const prefix = `${label}:`.toLowerCase()
  const idx = lines.findIndex((line) => line.trim().toLowerCase().startsWith(prefix))
  const flat = String(value || '').replace(/\s*\n+\s*/g, ' · ').trim()
  const nextLine = flat ? `${label}: ${flat}` : null
  if (idx >= 0) {
    if (nextLine) lines[idx] = nextLine
    else lines.splice(idx, 1)
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  if (!nextLine) return String(text || '').trim()
  const body = String(text || '').trim()
  return body ? `${body}\n${nextLine}` : nextLine
}

/**
 * @param {string} text
 * @param {Array<{ name?: string, quantity?: number, m3?: number | null }>} inventoryLines
 */
function replaceInventoryBlock(text, inventoryLines) {
  const lines = String(text || '').split('\n')
  const start = lines.findIndex((line) => /^inventory:\s*$/i.test(line.trim()))
  const block = inventoryLines.length
    ? [
        'Inventory:',
        ...inventoryLines.map(
          (line) => `- ${line.quantity || 1}× ${line.name || 'Item'} (${line.m3 ?? '?'} m³)`,
        ),
      ]
    : []
  if (start < 0) {
    const body = String(text || '').trim()
    if (!block.length) return body
    return body ? `${body}\n\n${block.join('\n')}` : block.join('\n')
  }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const row = lines[i].trim()
    if (!row) {
      end = i
      break
    }
    if (!row.startsWith('-') && !row.startsWith('•')) {
      end = i
      break
    }
  }
  const next = [...lines.slice(0, start), ...block, ...lines.slice(end)]
  return next.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * @param {unknown} details
 * @param {{
 *   specialInstructions?: string,
 *   priceNote?: string,
 *   inventoryLines?: Array<Record<string, unknown>>,
 * }} edits
 */
export function mergeLeadEditsIntoQuoteDetails(details, edits) {
  const extracted = extractWizardSnapshotFromDetails(details)
  let body = extracted.displayDetails
  body = replaceLabeledLine(body, 'Customer notes', String(edits.specialInstructions || '').trim())
  body = replaceLabeledLine(body, 'Price override reason', String(edits.priceNote || '').trim())
  const inventoryLines = Array.isArray(edits.inventoryLines)
    ? edits.inventoryLines.map((line, index) => normalizeAdminInventoryLine(line, index)).filter((line) => line.name)
    : null
  if (inventoryLines) body = replaceInventoryBlock(body, inventoryLines)
  if (!extracted.meta) return body
  const wizard = {
    ...extracted.meta.wizard,
    specialInstructions: String(edits.specialInstructions || '').trim(),
    ...(edits.wizardPatch && typeof edits.wizardPatch === 'object' ? edits.wizardPatch : {}),
  }
  if (inventoryLines) wizard.inventoryLines = inventoryLines
  return appendWizardSnapshotToDetails(body, {
    ...extracted.meta,
    wizard,
    serviceType:
      edits.serviceType != null ? String(edits.serviceType) : extracted.meta.serviceType,
    overrideReason: String(edits.priceNote || extracted.meta.overrideReason || ''),
  })
}

/**
 * Pipe rows the booking inventory view already understands.
 * @param {Array<Record<string, unknown>>} lines
 */
export function inventoryTextFromLines(lines) {
  return (lines || [])
    .map((line, index) => normalizeAdminInventoryLine(line, index))
    .filter((line) => line.name)
    .map((line) => {
      const qty = Number(line.quantity) || 1
      const unit = Number(line.m3)
      const lineVol = Number.isFinite(unit) ? Math.round(unit * qty * 100) / 100 : null
      const vol = lineVol != null ? `${lineVol} m³` : '—'
      const size = line.weightType || 'std'
      return `${line.name} | ${qty} | ${vol} | ${size}`
    })
    .join('\n')
}

/**
 * @param {Array<Record<string, unknown>>} lines
 */
export function inventoryJsonFromLines(lines) {
  return (lines || [])
    .map((line, index) => normalizeAdminInventoryLine(line, index))
    .filter((line) => line.name)
    .map((line) => ({
    name: line.name,
    quantity: Number(line.quantity) || 1,
    m3: line.m3,
    unit_volume_m3: line.m3,
    weight_type: line.weightType || 'std',
    is_custom: Boolean(line.isCustom),
    category: line.categoryLabel || null,
  }))
}

/**
 * @param {Record<string, unknown>} lead
 * @param {{ inventoryLines: Array<Record<string, unknown>>, specialInstructions: string, instructionsAuthor?: 'admin' }} edits
 */
export function buildLeadWizardData(lead, edits) {
  const { wd, step2, step3 } = leadWizardSteps(lead)
  const lines = edits.inventoryLines
    .map((line, index) => normalizeAdminInventoryLine(line, index))
    .filter((line) => line.name)
  const volume = sumCustomerLeadInventoryVolume(lines)
  const priceNote = String(lead?.price_override_reason || '').trim()
  const parts = readInstructionParts(step3, priceNote)
  const record =
    edits.instructionsAuthor === 'admin' || edits.instructionsAuthor === 'customer'
      ? applyInstructionEdit(
          {
            ...step3,
            customerSpecialInstructions: parts.customer,
            adminSpecialInstructions: parts.admin,
            supplyNoteAuthor: parts.supplyAuthor,
          },
          {
            customer: edits.instructionsAuthor === 'customer' ? edits.specialInstructions : parts.customer,
            admin: edits.instructionsAuthor === 'admin' ? edits.specialInstructions : parts.admin,
            priceNote,
          },
        )
      : applyInstructionEdit(step3, { priceNote })
  const step3Next = {
    ...step3,
    ...instructionFields(record),
    specialInstructionsSource: record.admin ? 'admin' : 'customer',
  }
  return {
    lines,
    specialInstructions: record.specialInstructions,
    total_volume_m3: volume != null ? volume : lead.total_volume_m3 ?? null,
    wizard_data: {
      ...wd,
      step2: {
        ...step2,
        inventoryLines: lines,
        ...(volume != null ? { totalVolumeM3: volume } : {}),
      },
      step3: step3Next,
    },
  }
}

/**
 * @param {Record<string, unknown>} lead
 */
export function editsFromLead(lead) {
  const { step2, step3 } = leadWizardSteps(lead)
  const inventoryLines = (Array.isArray(step2.inventoryLines) ? step2.inventoryLines : [])
    .map((line, index) => normalizeAdminInventoryLine(line, index))
    .filter((line) => line.name)
  const priceNote = String(lead?.price_override_reason || '').trim()
  const record = applyInstructionEdit(step3, { priceNote })
  return {
    inventoryLines,
    specialInstructions: String(step3.specialInstructions || '').trim(),
    customerInstructions: record.customer,
    adminInstructions: record.admin,
    instructionBlocks: record.blocks,
    supplyAuthor: record.supplyAuthor,
    priceNote,
  }
}

/**
 * @param {unknown} value
 */
function parseFloorValue(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {unknown} value
 */
function liftChoice(value) {
  if (value === 'yes' || value === true) return true
  if (value === 'no' || value === false) return false
  return null
}

/**
 * @param {unknown} pickup
 * @param {unknown} delivery
 */
function routeLabel(pickup, delivery) {
  const clip = (value) => {
    const text = String(value || '').trim()
    return text.length > 42 ? `${text.slice(0, 42)}…` : text
  }
  const from = clip(pickup)
  const to = clip(delivery)
  if (from && to) return `${from} → ${to}`
  return from || to || null
}

/**
 * @param {unknown} value
 */
function dateOnly(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

/**
 * @param {Record<string, unknown>} lead
 */
export function moveDetailsFormFromLead(lead) {
  const { step1 } = leadWizardSteps(lead)
  const pickupLift = step1.pickupLift
  const deliveryLift = step1.deliveryLift
  return {
    serviceType: String(step1.serviceType || lead?.service_type || ''),
    pickupAddress: String(step1.pickupAddress || lead?.pickup_address || ''),
    pickupPropertyType: String(step1.pickupPropertyType || ''),
    pickupFloor: step1.pickupFloor == null || step1.pickupFloor === '' ? '' : String(step1.pickupFloor),
    pickupLift: pickupLift === true ? 'yes' : pickupLift === false ? 'no' : '',
    deliveryAddress: String(step1.deliveryAddress || lead?.delivery_address || ''),
    deliveryPropertyType: String(step1.deliveryPropertyType || ''),
    deliveryFloor: step1.deliveryFloor == null || step1.deliveryFloor === '' ? '' : String(step1.deliveryFloor),
    deliveryLift: deliveryLift === true ? 'yes' : deliveryLift === false ? 'no' : '',
    moveDate: dateOnly(step1.moveDate || lead?.move_date),
    arrivalWindow: String(step1.arrivalWindow || ''),
    exactArrivalTime: String(step1.exactArrivalTime || ''),
    flexibleArrivalFrom: String(step1.flexibleArrivalFrom || ''),
    flexibleArrivalUntil: String(step1.flexibleArrivalUntil || ''),
  }
}

/**
 * Write move details onto the lead wizard. Distance and prices stay as they are.
 * @param {Record<string, unknown>} lead
 * @param {ReturnType<typeof moveDetailsFormFromLead>} form
 */
export function buildMoveDetailsWizard(lead, form) {
  const { wd, step1, step3 } = leadWizardSteps(lead)
  const service = normalizeServiceType(form.serviceType)
  const pickupFloor = parseFloorValue(form.pickupFloor)
  const deliveryFloor = parseFloorValue(form.deliveryFloor)
  const arrivalWindow = String(form.arrivalWindow || '').trim() === 'afternoon' ? 'evening' : String(form.arrivalWindow || '').trim()
  const nextStep1 = {
    ...step1,
    serviceType: service.label || String(form.serviceType || '').trim() || step1.serviceType || null,
    serviceKey: service.key || step1.serviceKey || null,
    pickupAddress: String(form.pickupAddress || '').trim(),
    deliveryAddress: String(form.deliveryAddress || '').trim(),
    pickupPropertyType: String(form.pickupPropertyType || '').trim(),
    deliveryPropertyType: String(form.deliveryPropertyType || '').trim(),
    pickupFloor,
    deliveryFloor,
    pickupLift: liftValueForFloor(pickupFloor, liftChoice(form.pickupLift)),
    deliveryLift: liftValueForFloor(deliveryFloor, liftChoice(form.deliveryLift)),
    moveDate: dateOnly(form.moveDate),
    arrivalWindow,
    exactArrivalTime: arrivalWindow === 'exact' ? String(form.exactArrivalTime || '').trim() : '',
    flexibleArrivalFrom: arrivalWindow === 'flex_window' ? String(form.flexibleArrivalFrom || '').trim() : '',
    flexibleArrivalUntil: arrivalWindow === 'flex_window' ? String(form.flexibleArrivalUntil || '').trim() : '',
  }
  nextStep1.arrivalSummary = formatWizardArrivalSummary(nextStep1)
  const wizardPatch = {
    serviceType: nextStep1.serviceType || '',
    pickupAddress: nextStep1.pickupAddress,
    deliveryAddress: nextStep1.deliveryAddress,
    pickupPropertyType: nextStep1.pickupPropertyType,
    deliveryPropertyType: nextStep1.deliveryPropertyType,
    pickupFloor: nextStep1.pickupFloor,
    deliveryFloor: nextStep1.deliveryFloor,
    pickupLift: nextStep1.pickupLift,
    deliveryLift: nextStep1.deliveryLift,
    moveDate: nextStep1.moveDate,
    arrivalWindow: nextStep1.arrivalWindow,
    exactArrivalTime: nextStep1.exactArrivalTime,
    flexibleArrivalFrom: nextStep1.flexibleArrivalFrom,
    flexibleArrivalUntil: nextStep1.flexibleArrivalUntil,
  }
  return {
    wizard_data: {
      ...wd,
      step1: nextStep1,
      step3: {
        ...step3,
        selectedMoveDate: nextStep1.moveDate || step3.selectedMoveDate || '',
      },
    },
    wizardPatch,
    service_type: nextStep1.serviceType || null,
    pickup_address: nextStep1.pickupAddress || null,
    delivery_address: nextStep1.deliveryAddress || null,
    move_date: nextStep1.moveDate || null,
    route_label: routeLabel(nextStep1.pickupAddress, nextStep1.deliveryAddress),
    arrival_window: arrivalWindow || null,
    arrival_type: arrivalWindow === 'exact' ? 'exact' : arrivalWindow || null,
    arrival_time: getWizardArrivalTimePayload(nextStep1) || null,
  }
}

/**
 * @param {Record<string, unknown>} lead
 */
export function quoteExtrasFormFromLead(lead) {
  const { step1, step3 } = leadWizardSteps(lead)
  return {
    selectedMoveDate: dateOnly(step3.selectedMoveDate || step1.moveDate || lead?.move_date),
    packing: Boolean(step3.packing),
    packingWhat: String(step3.packingWhat || ''),
    packingMaterials: Boolean(step3.packingMaterials),
    packingMaterialsDetail: String(step3.packingMaterialsDetail || ''),
    dismantling: Boolean(step3.dismantling),
    dismantlingItemCount: String(step3.dismantlingItemCount || 0),
    dismantlingWhat: String(step3.dismantlingWhat || ''),
    reassembly: Boolean(step3.reassembly),
    reassemblyItemCount: String(step3.reassemblyItemCount || 0),
    reassemblyWhat: String(step3.reassemblyWhat || ''),
    heavyNotes: String(step3.heavyNotes || ''),
    pickupContactName: String(step3.pickupContactName || ''),
    pickupContactPhone: String(step3.pickupContactPhone || ''),
    deliveryContactName: String(step3.deliveryContactName || ''),
    deliveryContactPhone: String(step3.deliveryContactPhone || ''),
    promoCode: String(step3.promoCode || ''),
  }
}

/**
 * Write quote extras onto the lead. Ordered boxes follow the materials text.
 * Prices stay as they are.
 * @param {Record<string, unknown>} lead
 * @param {ReturnType<typeof quoteExtrasFormFromLead>} form
 */
export function buildQuoteExtrasWizard(lead, form) {
  const { wd, step1, step2, step3 } = leadWizardSteps(lead)
  const packing = Boolean(form.packing)
  const packingMaterials = Boolean(form.packingMaterials)
  const dismantling = Boolean(form.dismantling)
  const reassembly = Boolean(form.reassembly)
  const packingMaterialsDetail = packingMaterials ? String(form.packingMaterialsDetail || '').trim() : ''
  const quantities = parsePackingMaterialQuantities(
    packingMaterials ? { packingMaterialsDetail } : { packingMaterialsQuantities: {} },
  )
  const lines = syncSuppliedBoxesIntoInventory(step2.inventoryLines || [], quantities)
  const volume = sumCustomerLeadInventoryVolume(lines)
  const moveDate = dateOnly(form.selectedMoveDate)
  const pickupContactName = String(form.pickupContactName || '').trim()
  const pickupContactPhone = String(form.pickupContactPhone || '').trim()
  const deliveryContactName = String(form.deliveryContactName || '').trim()
  const deliveryContactPhone = String(form.deliveryContactPhone || '').trim()
  const step3Next = {
    ...step3,
    selectedMoveDate: moveDate,
    packing,
    packingWhat: packing ? String(form.packingWhat || '').trim() : '',
    packingMaterials,
    packingMaterialsDetail,
    dismantling,
    dismantlingItemCount: dismantling ? Math.max(0, Math.round(Number(form.dismantlingItemCount) || 0)) : 0,
    dismantlingWhat: dismantling ? String(form.dismantlingWhat || '').trim() : '',
    reassembly,
    reassemblyItemCount: reassembly ? Math.max(0, Math.round(Number(form.reassemblyItemCount) || 0)) : 0,
    reassemblyWhat: reassembly ? String(form.reassemblyWhat || '').trim() : '',
    heavyNotes: String(form.heavyNotes || '').trim(),
    pickupContactName,
    pickupContactPhone,
    deliveryContactName,
    deliveryContactPhone,
    promoCode: String(form.promoCode || '').trim(),
    packingMaterialsQuantities: quantities,
    ...instructionFields(
      applyInstructionEdit(step3, {
        quantities,
        actor: 'admin',
        priceNote: lead?.price_override_reason,
      }),
    ),
  }
  const wizardPatch = {
    moveDate,
    packing: step3Next.packing,
    packingWhat: step3Next.packingWhat,
    packingMaterials: step3Next.packingMaterials,
    packingMaterialsDetail: step3Next.packingMaterialsDetail,
    dismantling: step3Next.dismantling,
    dismantlingItemCount: step3Next.dismantlingItemCount,
    dismantlingWhat: step3Next.dismantlingWhat,
    reassembly: step3Next.reassembly,
    reassemblyItemCount: step3Next.reassemblyItemCount,
    reassemblyWhat: step3Next.reassemblyWhat,
    heavyNotes: step3Next.heavyNotes,
    pickupContactName,
    pickupContactPhone,
    pickupContactSameAsCustomer: !(pickupContactName || pickupContactPhone),
    deliveryContactName,
    deliveryContactPhone,
    deliveryContactSameAsCustomer: !(deliveryContactName || deliveryContactPhone),
    dropoffSameAsPickup: !(deliveryContactName || deliveryContactPhone),
    promoCode: step3Next.promoCode,
    inventoryLines: lines,
    specialInstructions: step3Next.specialInstructions,
    customerSpecialInstructions: step3Next.customerSpecialInstructions,
    adminSpecialInstructions: step3Next.adminSpecialInstructions,
    supplyNoteAuthor: step3Next.supplyNoteAuthor,
    packingMaterialsQuantities: quantities,
  }
  return {
    lines,
    move_date: moveDate || null,
    total_volume_m3: volume != null ? volume : lead.total_volume_m3 ?? null,
    wizardPatch,
    wizard_data: {
      ...wd,
      step1: { ...step1, moveDate: moveDate || step1.moveDate || '' },
      step2: {
        ...step2,
        inventoryLines: lines,
        ...(volume != null ? { totalVolumeM3: volume } : {}),
      },
      step3: step3Next,
    },
  }
}
