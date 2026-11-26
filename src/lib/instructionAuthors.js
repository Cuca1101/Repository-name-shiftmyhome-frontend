/**
 * Customer words and admin words stay in separate fields.
 * The Supply line belongs to whoever last changed the packing materials.
 */

import { buildSupplyNote, syncSupplyNote } from './supplyInstructionNote.js'

const SUPPLY_LINE = /^Supply:\s/i

/**
 * @param {unknown} text
 */
export function stripSupplyLines(text) {
  return syncSupplyNote(text, {})
}

/**
 * @param {unknown} text
 */
export function supplyLineIn(text) {
  const line = String(text ?? '')
    .split('\n')
    .map((row) => row.trim())
    .find((row) => SUPPLY_LINE.test(row))
  return line || ''
}

/**
 * @param {unknown} text
 * @param {unknown} priceNote
 */
function withoutPriceNote(text, priceNote) {
  const note = String(priceNote || '').trim()
  const current = stripSupplyLines(text)
  if (!note || !current) return current
  if (current === note) return ''
  return current
    .split('\n')
    .filter((line) => line.trim() !== note)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {string} text
 * @returns {{ customer: string, admin: string } | null}
 */
function parseLabeledInstructions(text) {
  const lines = String(text || '').split('\n')
  let mode = ''
  let saw = false
  const customer = []
  const admin = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^Added by customer:\s*$/i.test(trimmed)) {
      mode = 'customer'
      saw = true
      continue
    }
    if (/^Added by admin:\s*$/i.test(trimmed)) {
      mode = 'admin'
      saw = true
      continue
    }
    if (mode === 'admin') admin.push(line)
    else if (mode === 'customer') customer.push(line)
  }
  if (!saw) return null
  return {
    customer: stripSupplyLines(customer.join('\n')),
    admin: stripSupplyLines(admin.join('\n')),
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} step3
 * @param {unknown} [priceNote]
 */
export function readInstructionParts(step3, priceNote = '') {
  const source = step3 && typeof step3 === 'object' ? step3 : {}
  const storedCustomer = typeof source.customerSpecialInstructions === 'string'
  const storedAdmin = typeof source.adminSpecialInstructions === 'string'
  const author = String(source.supplyNoteAuthor || '').trim().toLowerCase()
  const supplyAuthor =
    author === 'admin' || author === 'customer' ? author : inferSupplyAuthor(source.specialInstructions)

  if (storedCustomer || storedAdmin) {
    return {
      customer: withoutPriceNote(source.customerSpecialInstructions, priceNote),
      admin: withoutPriceNote(source.adminSpecialInstructions, priceNote),
      supplyAuthor,
    }
  }

  const labeled = parseLabeledInstructions(source.specialInstructions)
  if (labeled) {
    return { ...labeled, supplyAuthor }
  }

  const plain = withoutPriceNote(source.specialInstructions, priceNote)
  if (String(source.specialInstructionsSource || '') === 'admin' && !storedCustomer) {
    return { customer: '', admin: plain, supplyAuthor }
  }
  return { customer: plain, admin: '', supplyAuthor }
}

/**
 * @param {{
 *   customer?: unknown,
 *   admin?: unknown,
 *   supplyNote?: unknown,
 *   supplyAuthor?: unknown,
 * }} input
 */
export function composeInstructionRecord(input) {
  const note = String(input.supplyNote || '').trim()
  // The Supply line is generated for the crew. It is an admin note, not the customer's words.
  const supplyAuthor = note ? 'admin' : ''
  const customerWords = stripSupplyLines(input.customer)
  const adminWords = stripSupplyLines(input.admin)
  const customerBody =
    supplyAuthor === 'customer' && note
      ? customerWords
        ? `${customerWords}\n${note}`
        : note
      : customerWords
  const adminBody =
    supplyAuthor === 'admin' && note
      ? adminWords
        ? `${adminWords}\n${note}`
        : note
      : adminWords
  /** @type {Array<{ author: 'customer' | 'admin', label: string, text: string }>} */
  const blocks = []
  if (customerBody) blocks.push({ author: 'customer', label: 'Added by customer', text: customerBody })
  if (adminBody) blocks.push({ author: 'admin', label: 'Added by admin', text: adminBody })
  return {
    customer: customerWords,
    admin: adminWords,
    supplyAuthor,
    blocks,
    specialInstructions: blocks.map((block) => `${block.label}:\n${block.text}`).join('\n\n'),
  }
}

/**
 * @param {unknown} text
 * @returns {'customer' | 'admin' | ''}
 */
function inferSupplyAuthor(text) {
  let mode = ''
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim()
    if (/^Added by customer:\s*$/i.test(trimmed)) {
      mode = 'customer'
      continue
    }
    if (/^Added by admin:\s*$/i.test(trimmed)) {
      mode = 'admin'
      continue
    }
    if (SUPPLY_LINE.test(trimmed) && (mode === 'customer' || mode === 'admin')) return mode
  }
  return ''
}

/**
 * Rebuild the two instruction fields.
 * Pass quantities only when packing materials changed. A text edit keeps the current Supply line and its author.
 * @param {Record<string, unknown> | null | undefined} step3
 * @param {{
 *   customer?: unknown,
 *   admin?: unknown,
 *   quantities?: Record<string, unknown> | null,
 *   actor?: 'customer' | 'admin' | '',
 *   priceNote?: unknown,
 * }} edit
 */
export function applyInstructionEdit(step3, edit = {}) {
  const source = step3 && typeof step3 === 'object' ? step3 : {}
  const parts = readInstructionParts(source, edit.priceNote || '')
  const quantitiesProvided = Object.prototype.hasOwnProperty.call(edit, 'quantities')
  const previous = supplyLineIn(source.specialInstructions)
  const note = quantitiesProvided ? buildSupplyNote(edit.quantities) : previous
  const author = note ? 'admin' : ''
  return composeInstructionRecord({
    customer: edit.customer != null ? edit.customer : parts.customer,
    admin: edit.admin != null ? edit.admin : parts.admin,
    supplyNote: note,
    supplyAuthor: author,
  })
}

/**
 * @param {ReturnType<typeof composeInstructionRecord>} record
 */
export function instructionFields(record) {
  return {
    customerSpecialInstructions: record.customer,
    adminSpecialInstructions: record.admin,
    supplyNoteAuthor: record.supplyAuthor,
    specialInstructions: record.specialInstructions,
  }
}
