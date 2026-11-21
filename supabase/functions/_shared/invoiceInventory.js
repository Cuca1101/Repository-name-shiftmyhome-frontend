/**
 * One inventory list for an invoice.
 * Structured rows win. The text copy is only a fallback, so the same items are not printed twice.
 * Same names with different quantities stay as separate rows.
 */

function positiveQty(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.round(n)
}

function cleanStoredName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

function parseInventoryText(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n|•/g)
  for (const raw of lines) {
    const line = raw.trim().replace(/^[-*·]\s*/, '')
    if (!line || /^inventory[:\s-]*$/i.test(line)) continue
    const qtyMatch = line.match(/[×x]\s*(\d+)/i) || line.match(/^(\d+)\s*[×x]\s*/i)
    const name = cleanStoredName(
      line
        .replace(/[×x]\s*\d+/gi, '')
        .replace(/^\d+\s*[×x]\s*/i, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\([^)]*(?:m³|m3|line vol)[^)]*\)/gi, ''),
    )
    if (!name) continue
    rows.push({ name, quantity: positiveQty(qtyMatch?.[1]) })
  }
  return rows
}

function itemNote(row) {
  const note = String(row?.notes ?? row?.note ?? '').replace(/\s+/g, ' ').trim()
  if (!note || GENERIC_NOTE.has(note.toLowerCase()) || isInternalPricingLine(note)) return ''
  return note
}

function inventoryRow(row) {
  return {
    name: cleanStoredName(row?.name ?? row?.item_name),
    quantity: positiveQty(row?.quantity ?? row?.qty),
    note: itemNote(row),
  }
}

export function canonicalInvoiceInventory({ inventoryItems = [], inventory = null, inventoryText = '' } = {}) {
  if (inventoryItems.length) {
    return inventoryItems.map(inventoryRow).filter((row) => row.name)
  }
  if (Array.isArray(inventory) && inventory.length) {
    return inventory.map(inventoryRow).filter((row) => row.name)
  }
  return parseInventoryText(inventoryText)
}

export function totalItemQuantity(rows) {
  return (rows || []).reduce((sum, row) => sum + positiveQty(row?.quantity), 0)
}

const GENERIC_NOTE = new Set([
  '',
  '-',
  'n/a',
  'na',
  'no',
  'none',
  'none selected',
  '0',
  'typical',
  'standard',
  'standard street parking',
  'house',
])

/** Pricing-engine breakdowns stay off the customer invoice. */
export function isInternalPricingLine(value) {
  const line = String(value || '').replace(/\s+/g, ' ').trim()
  if (!line) return false
  if (/best price/i.test(line)) return true
  if (/\(\s*\d+\s*%\s*\)/.test(line) && /[£]|GBP/i.test(line)) return true
  return /^(starting price|base price|distance|mileage|fuel|labour|labor|volume|same[- ]day|minimum|estimated total|calculated total|subtotal|crew labour|price per mile|access charge|floor charge)\b/i.test(line)
}

export function customerInvoiceNotes(values) {
  const notes = []
  for (const value of values || []) {
    for (const part of String(value || '').split(/\r?\n/)) {
      const line = part.replace(/\s+/g, ' ').trim()
      if (!line || GENERIC_NOTE.has(line.toLowerCase()) || isInternalPricingLine(line)) continue
      if (!notes.includes(line)) notes.push(line)
    }
  }
  return notes
}

const INSTRUCTION_LABELS = ['Special instructions', 'Customer notes', 'Customer message', 'Additional notes', 'Free-text message']

const NOTE_LABELS = [
  ['Stairs & access notes', 'Stairs and access'],
  ['Heavy / bulky items notes', 'Heavy or bulky items'],
  ['Pickup access notes', 'Collection access'],
  ['Delivery access notes', 'Delivery access'],
]

function labeledValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(text || '').match(new RegExp(`^\\s*${escaped}\\s*:\\s*(.+)\\s*$`, 'im'))
  return match?.[1]?.trim() || ''
}

function isDetailsDump(value) {
  const text = String(value || '')
  return text.length > 280 || /—\s*[^—\n]+\s*—/.test(text) || /===\s*QUOTE/i.test(text)
}

function extraServiceLines(details) {
  const match = String(details || '').match(/—\s*Extra services\s*—\s*\n([\s\S]*?)(?=\n—\s*[^—\n]+\s*—|$)/i)
  if (!match) return []
  const lines = []
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line || GENERIC_NOTE.has(line.toLowerCase()) || isInternalPricingLine(line) || /£/.test(line)) continue
    lines.push(line)
  }
  return lines.length ? [`Extra services: ${lines.join('. ')}`] : []
}

/**
 * Customer-written booking notes. Pricing breakdowns stay out.
 * Special instructions are kept separate from access and extra-service notes.
 */
export function customerDocumentNotes({ quote = {}, stops = [], requirements = [] } = {}) {
  const details = String(quote.details || '')
  const instructions = []
  const notes = []
  const seen = new Set()
  const push = (list, value) => {
    const line = String(value || '').replace(/\s+/g, ' ').trim()
    const key = line.toLowerCase()
    if (!line || GENERIC_NOTE.has(key) || isInternalPricingLine(line) || seen.has(key)) return
    seen.add(key)
    list.push(line)
  }

  for (const row of requirements || []) {
    if (/instruction|note/i.test(String(row?.requirement_type || ''))) push(instructions, row?.description)
  }
  for (const label of INSTRUCTION_LABELS) push(instructions, labeledValue(details, label))
  push(instructions, quote.customer_message)
  push(instructions, quote.special_instructions)

  for (const [label, prefix] of NOTE_LABELS) {
    const value = labeledValue(details, label)
    if (value) push(notes, `${prefix}: ${value}`)
  }
  for (const stop of stops || []) {
    if (!stop?.access_notes || isDetailsDump(stop.access_notes)) continue
    const place = String(stop.stop_type || '').toLowerCase() === 'delivery' ? 'Delivery access' : 'Collection access'
    push(notes, `${place}: ${stop.access_notes}`)
  }
  for (const line of extraServiceLines(details)) push(notes, line)
  if (quote.office_notes) push(notes, `Office notes: ${quote.office_notes}`)
  return { instructions, notes }
}
