/**
 * Copy admin edits on a customer lead (price note, special instructions, items)
 * onto the linked booking without changing prices.
 */
import { sumCustomerLeadInventoryVolume } from './customerLeadCapture'
import {
  appendWizardSnapshotToDetails,
  extractWizardSnapshotFromDetails,
} from './adminPhoneBookingWizardSnapshot'

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
export function specialInstructionsWithoutPriceNote(text, note) {
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

/**
 * Split a lead note into the customer's words and the admin's words.
 * @param {Record<string, unknown>|null|undefined} lead
 * @returns {{ customer: string, admin: string }}
 */
export function notesForCustomerEmail(lead) {
  const { step3 } = leadWizardSteps(lead || {})
  const current = String(step3.specialInstructions || '').trim()
  const note = String(lead?.price_override_reason || '').trim()
  const source = String(step3.specialInstructionsSource || '').trim()
  const hasSnapshot = typeof step3.customerSpecialInstructions === 'string'
  const customer = hasSnapshot
    ? String(step3.customerSpecialInstructions).trim()
    : source === 'admin'
      ? ''
      : specialInstructionsWithoutPriceNote(current, note)

  let admin = ''
  if (source === 'admin' && current && current !== customer) {
    admin =
      customer && current.startsWith(`${customer}\n`)
        ? current.slice(customer.length).trim()
        : current
  }
  if (note && admin !== note && !admin.split('\n').some((line) => line.trim() === note)) {
    admin = admin ? `${admin}\n${note}` : note
  }
  if (admin === customer) admin = note && note !== customer ? note : ''
  return { customer, admin }
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
  }
  if (inventoryLines) wizard.inventoryLines = inventoryLines
  return appendWizardSnapshotToDetails(body, {
    ...extracted.meta,
    wizard,
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
  const nextInstructions = String(edits.specialInstructions || '').trim()
  const step3Next = {
    ...step3,
    specialInstructions: nextInstructions,
  }
  if (edits.instructionsAuthor === 'admin') {
    const priceNote = String(lead?.price_override_reason || '').trim()
    const customerOriginal =
      typeof step3.customerSpecialInstructions === 'string'
        ? String(step3.customerSpecialInstructions).trim()
        : specialInstructionsWithoutPriceNote(step3.specialInstructions, priceNote)
    step3Next.customerSpecialInstructions = customerOriginal
    step3Next.specialInstructionsSource = nextInstructions === customerOriginal ? 'customer' : 'admin'
  }
  return {
    lines,
    specialInstructions: nextInstructions,
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
  return {
    inventoryLines,
    specialInstructions: String(step3.specialInstructions || '').trim(),
    priceNote: String(lead?.price_override_reason || '').trim(),
  }
}
