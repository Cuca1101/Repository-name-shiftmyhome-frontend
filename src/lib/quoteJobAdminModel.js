import { formatDateUK } from './formatDateDisplay'

/** @param {unknown} n */
function num(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x : 0
}

/** @param {unknown} n */
function round2(n) {
  return Math.round(num(n) * 100) / 100
}

/**
 * UK postcode-ish tail, else first line shortened.
 * @param {unknown} address
 * @param {number} [maxLen]
 */
export function shortAddressLine(address, maxLen = 36) {
  const s = String(address ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!s) return '—'
  const pc = s.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i)
  if (pc) {
    const before = s.slice(0, s.length - pc[0].length).trim()
    if (!before) return pc[1].toUpperCase()
    const head = before.length > maxLen ? `${before.slice(0, maxLen - 3)}…` : before
    return `${head} · ${pc[1].toUpperCase()}`
  }
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}

/**
 * Parse `formatQuoteBreakdownLines` output into labelled amounts.
 * @param {unknown} pricing
 */
export function parsePricingText(pricing) {
  const raw = String(pricing ?? '').trim()
  /** @type {{ label: string, amount: number }[]} */
  const lines = []
  let estimatedTotal = null
  /** @type {number|null} */
  let volumeM3 = null

  if (!raw) return { lines, estimatedTotal, volumeM3 }

  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const m = t.match(/^(.+?):\s*£([\d,]+(?:\.\d{1,2})?)/)
    if (!m) continue
    const label = m[1].trim()
    const amount = parseFloat(m[2].replace(/,/g, ''))
    if (!Number.isFinite(amount)) continue
    lines.push({ label, amount })
    if (/estimated total/i.test(label)) estimatedTotal = amount
    if (/^volume/i.test(label)) {
      const vol = t.match(/total\s*([\d.]+)\s*m³/i)
      if (vol) volumeM3 = parseFloat(vol[1])
    }
  }

  return { lines, estimatedTotal, volumeM3 }
}

/**
 * @param {{ label: string, amount: number }[]} lines
 */
function categorizePricingLines(lines) {
  /** @type {{ label: string, amount: number }[]} */
  const base = []
  /** @type {{ label: string, amount: number }[]} */
  const distance = []
  /** @type {{ label: string, amount: number }[]} */
  const volume = []
  /** @type {{ label: string, amount: number }[]} */
  const floorAccess = []
  /** @type {{ label: string, amount: number }[]} */
  const noLift = []
  /** @type {{ label: string, amount: number }[]} */
  const heavy = []
  /** @type {{ label: string, amount: number }[]} */
  const extras = []
  /** @type {{ label: string, amount: number }[]} */
  const other = []

  for (const row of lines) {
    const L = row.label.toLowerCase()
    if (L.startsWith('base')) base.push(row)
    else if (L.startsWith('distance')) distance.push(row)
    else if (L.startsWith('volume')) volume.push(row)
    else if (L.includes('no lift')) noLift.push(row)
    else if (L.includes('heavy item')) heavy.push(row)
    else if (/floor\/access|long walk|parking|stairs/i.test(row.label)) floorAccess.push(row)
    else if (/packing|dismantl|reassembl|fragile|materials|waiting|helper|same-day|weekend|surcharge|minimum/i.test(L))
      extras.push(row)
    else if (/estimated total/i.test(L)) {
      /* skip — shown separately */
    } else other.push(row)
  }

  return { base, distance, volume, floorAccess, noLift, heavy, extras, other }
}

/**
 * @param {Record<string, unknown>} quoteRow
 */
export function buildPricingBreakdownSections(quoteRow) {
  const { lines } = parsePricingText(quoteRow.pricing)
  return categorizePricingLines(lines)
}

/**
 * Extract "Label: value" pairs from enquiry text (wizard or quote form).
 * @param {unknown} details
 */
export function parseDetailsKeyValues(details) {
  const text = String(details ?? '')
  /** @type {Record<string, string>} */
  const map = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([^:]+):\s*(.+)\s*$/)
    if (!m) continue
    const k = m[1].trim()
    const v = m[2].trim()
    if (!k || k.startsWith('===')) continue
    if (!(k in map) || !map[k]) map[k] = v
  }
  return map
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function formatInventoryVolumeCell(v) {
  if (v == null || v === '') return '—'
  const s = String(v).trim()
  if (s === '—') return '—'
  if (/m³|m\^3/i.test(s)) return s
  const n = Number(String(s).replace(/,/g, ''))
  if (Number.isFinite(n)) return `${n} m³`
  return s
}

/**
 * Pipe table row: "Item name | 4 | 4 m³ | large"
 * @param {string} line
 * @returns {{ name: string, qty: number, volume: string, sizeType: string } | null}
 */
function parsePipeInventoryRow(line) {
  const t = line.trim()
  if (!t || t.startsWith('//') || t.startsWith('#')) return null
  if (!t.includes('|')) return null
  const cells = t.split('|').map((c) => c.trim())
  if (cells.length < 2 || !cells[0]) return null
  if (/^item$/i.test(cells[0]) && /^qty$/i.test(String(cells[1] || ''))) return null
  if (cells.length >= 4) {
    const qty = parseInt(cells[1], 10)
    return {
      name: cells[0],
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      volume: cells[2] || '—',
      sizeType: cells[3] || '—',
    }
  }
  if (cells.length === 3) {
    const qty = parseInt(cells[1], 10)
    return {
      name: cells[0],
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      volume: cells[2] || '—',
      sizeType: '—',
    }
  }
  if (cells.length === 2) {
    return { name: cells[0], qty: 1, volume: cells[1] || '—', sizeType: '—' }
  }
  return null
}

/**
 * Lines like: "  • Sofa ×2  (~3.2 m³ line vol, std)"
 * @param {unknown} inventoryText
 * @param {unknown} details
 */
export function parseInventoryTableRows(inventoryText, details) {
  /** @type {{ name: string, qty: number, volume: string, sizeType: string }[]} */
  const rows = []
  const invBlock = String(inventoryText ?? '').trim()
  const pushFromLine = (line) => {
    const pipe = parsePipeInventoryRow(line)
    if (pipe) {
      rows.push({
        ...pipe,
        volume: formatInventoryVolumeCell(pipe.volume),
      })
      return
    }
    const t = line.trim()
    const m = t.match(
      /^•\s*(.+?)\s*×\s*(\d+)\s*\(\s*~\s*([\d.]+)\s*m³\s*line\s*vol\s*,\s*([^)]+)\)/i,
    )
    if (m) {
      rows.push({
        name: m[1].trim(),
        qty: parseInt(m[2], 10) || 0,
        volume: `${m[3]} m³`,
        sizeType: (m[4] || '').trim() || '—',
      })
    }
  }

  for (const line of invBlock.split('\n')) pushFromLine(line)

  if (rows.length === 0 && details) {
    const d = String(details)
    const invIdx = d.indexOf('— Inventory —')
    const priceIdx = d.indexOf('— Estimated price —')
    const slice =
      invIdx >= 0 ? d.slice(invIdx, priceIdx >= 0 ? priceIdx : undefined) : ''
    for (const line of slice.split('\n')) pushFromLine(line)
  }

  return rows
}

/**
 * @param {Record<string, unknown>} q
 */
function quoteRowInventoryToRows(q) {
  const inv = q?.inventory
  if (!Array.isArray(inv)) return []
  /** @type {{ name: string, qty: number, volume: string, sizeType: string }[]} */
  const out = []
  for (const row of inv) {
    if (row && typeof row === 'object' && 'summary' in row) {
      out.push({ name: String(row.summary), qty: 1, volume: '—', sizeType: '—' })
    } else if (row && typeof row === 'object') {
      const rawVol =
        row.line_volume_m3 != null
          ? row.line_volume_m3
          : row.volume_m3 != null
            ? row.volume_m3
            : null
      out.push({
        name: String(row.item_name ?? row.name ?? 'Item'),
        qty: Math.max(1, num(row.quantity)),
        volume: formatInventoryVolumeCell(rawVol),
        sizeType: String(row.weight_type ?? row.size_category ?? row.size_type ?? '—'),
      })
    }
  }
  return out
}

/**
 * @param {Record<string, unknown>} q
 */
export function parseInventoryFromQuoteRow(q) {
  const fromJson = quoteRowInventoryToRows(q)
  if (fromJson.length) return fromJson
  return parseInventoryTableRows(q.inventory_text, q.details)
}

/**
 * Display-only: split free-text inventory when structured parsing returns nothing.
 * Does not modify stored data. Splits on newlines, then bullets (• · ●), then single-line commas.
 * @param {unknown} raw
 * @returns {{ name: string, qty: number, volume: string, sizeType: string }[]}
 */
export function parseInventoryFallbackDisplayLines(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  let chunks = s.split(/\r?\n/).map((t) => t.trim()).filter(Boolean)
  if (chunks.length === 1) {
    chunks = s.split(/\s*[•·●]\s+/).map((t) => t.trim()).filter(Boolean)
  }
  if (chunks.length === 1 && s.includes(',')) {
    chunks = s
      .split(/,(?=\s*[^\s,])/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  }
  if (chunks.length === 0) chunks = [s]
  return chunks.map((name) => ({
    name,
    qty: 1,
    volume: '—',
    sizeType: '—',
  }))
}

/**
 * @param {Record<string, unknown>} q
 */
export function resolveCustomerTotalGbp(q) {
  const fromCol = num(q.estimated_total)
  if (fromCol > 0) return round2(fromCol)
  const { estimatedTotal } = parsePricingText(q.pricing)
  if (estimatedTotal != null && estimatedTotal > 0) return round2(estimatedTotal)
  return null
}

/**
 * @param {Record<string, unknown>} q
 * @param {number} adjustmentsSumGbp
 */
export function resolveFinancials(q, adjustmentsSumGbp = 0) {
  const baseTotal = resolveCustomerTotalGbp(q)
  const paid = round2(q.amount_paid)
  const adj = round2(adjustmentsSumGbp)
  const customerTotal = baseTotal != null ? round2(baseTotal + adj) : null
  const fromColBal = q.remaining_balance
  let remaining =
    fromColBal != null && String(fromColBal).trim() !== '' && Number.isFinite(Number(fromColBal))
      ? round2(fromColBal)
      : null
  if (remaining == null && customerTotal != null) {
    remaining = Math.max(0, round2(customerTotal - paid))
  }
  return { customerTotal, paid, remaining, baseQuoteTotal: baseTotal }
}

/**
 * @param {Record<string, unknown>} q
 */
export function deriveCardStatusBadge(q) {
  const st = String(q.status ?? '').trim()
  if (st === 'Cancelled') return { label: 'Cancelled', tone: 'slate' }
  if (String(q.payment_status) === 'paid') return { label: 'Paid', tone: 'emerald' }
  if (st === 'Booked' || st === 'Completed') return { label: 'Booked', tone: 'sky' }
  return { label: 'Available', tone: 'amber' }
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, string>} [kv]
 */
export function formatMoveArrivalSummary(q, kv = {}) {
  const awRaw = String(q.arrival_window ?? '').trim()
  const arrivalTime = String(q.arrival_time ?? '').trim()
  const preferred = String(kv['Preferred arrival'] ?? '').trim()

  const rangeFrom = (text) => {
    const m = String(text).match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/)
    if (!m) return null
    const pad = (h, min) => `${String(parseInt(h, 10)).padStart(2, '0')}:${String(parseInt(min, 10)).padStart(2, '0')}`
    return { start: pad(m[1], m[2]), end: pad(m[3], m[4]) }
  }

  const PRESETS = {
    flex_window: 'Flexible collection window',
    morning: 'Morning · 08:00–12:00',
    midday: 'Midday · 12:00–16:00',
    evening: 'Evening · 16:00–20:00',
    exact: 'Exact arrival time',
  }

  if (awRaw && awRaw !== '—') {
    if (PRESETS[awRaw]) return PRESETS[awRaw]
    if (rangeFrom(awRaw) || /exact|\(Exact/i.test(awRaw) || awRaw.includes('·')) return awRaw
    if (awRaw === 'flex_window' && arrivalTime) {
      const r = rangeFrom(arrivalTime)
      if (r) return `Flexible window · ${r.start}–${r.end}`
    }
    return awRaw
  }
  if (q.arrival_type === 'exact' && arrivalTime) return `${arrivalTime} (Exact time)`
  if (arrivalTime) {
    const r = rangeFrom(arrivalTime)
    if (r) return `Flexible window · ${r.start}–${r.end}`
  }
  if (preferred) return preferred
  return '—'
}

/**
 * Section-aware parser for wizard / quote-form enquiry text (handles duplicate labels across sections).
 * @param {unknown} details
 * @returns {Record<string, Record<string, string>>}
 */
export function parseWizardStructured(details) {
  const text = String(details ?? '')
  let section = '_'
  /** @type {Record<string, Record<string, string>>} */
  const sections = {}
  for (const line of text.split('\n')) {
    const secM = line.match(/^—\s*(.+?)\s*—\s*$/)
    if (secM) {
      section = secM[1].trim()
      if (!sections[section]) sections[section] = {}
      continue
    }
    const kv = line.match(/^\s*([^:]+):\s*(.+)$/)
    if (kv && section) {
      const k = kv[1].trim()
      const v = kv[2].trim()
      if (!k || k.startsWith('===')) continue
      if (!sections[section]) sections[section] = {}
      sections[section][k] = v
    }
  }
  return sections
}

/**
 * @param {Record<string, Record<string, string>>} sections
 * @param {string[]} names
 */
export function mergeDetailSections(sections, names) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const n of names) {
    const block = sections[n]
    if (!block) continue
    for (const [k, v] of Object.entries(block)) {
      if (v && out[k] == null) out[k] = v
    }
  }
  return out
}

/**
 * @param {Record<string, unknown>} q
 */
export function formatVolumeAndCrew(q) {
  const { volumeM3 } = parsePricingText(q.pricing)
  const vol =
    volumeM3 != null
      ? `${volumeM3.toFixed(2)} m³`
      : q.total_cubic_metres != null && num(q.total_cubic_metres) > 0
        ? `${num(q.total_cubic_metres).toFixed(2)} m³`
        : null
  const crewN = num(q.crew_size)
  const crew = crewN > 0 ? `${crewN} ${crewN === 1 ? 'person' : 'people'}` : null
  if (vol && crew) return `${vol} · ${crew}`
  if (vol) return vol
  if (crew) return crew
  return '—'
}
