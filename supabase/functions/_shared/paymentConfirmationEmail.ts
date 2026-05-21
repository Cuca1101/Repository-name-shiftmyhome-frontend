import type Stripe from 'npm:stripe@14.21.0'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { renderTransactionalEmailTemplate } from './transactionalEmailTemplates.ts'
import { sendResendEmailMinimal } from './postResendEmail.ts'
import { asciiEmailSubject, encodePdfBytesToResendBase64 } from './resendPayloadLog.ts'

type UpdateResult = {
  ok: boolean
  quote_id?: string | null
}

type QuoteRow = {
  id: string
  quote_ref: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  pickup_address: string | null
  delivery_address: string | null
  move_date: string | null
  service: string | null
  crew_size: number | null
  vehicle_size: string | null
  arrival_window: string | null
  details: string | null
  inventory_text: string | null
  pricing: string | null
  amount_paid: number | null
  payment_type: string | null
  paid_at: string | null
  inventory?: unknown
  payment_confirmation_email_sent_at: string | null
  payment_confirmation_email_intent_id?: string | null
  service_type: string | null
  estimated_total: number | null
  remaining_balance: number | null
}

type QuoteStopRow = {
  stop_type: 'pickup' | 'delivery'
  contact_name: string | null
  contact_phone: string | null
  address_line_1: string | null
  floor: string | null
  lift_available: boolean | null
  parking_type: string | null
  walking_distance: string | null
  date_time_window: string | null
  access_notes: string | null
}

type QuoteInventoryItemRow = {
  item_name: string
  quantity: number | null
  volume_m3: number | null
  size_category: string | null
  weight_category: string | null
  notes: string | null
}

type QuoteRequirementRow = {
  requirement_type: string
  description: string
}

type QuotePricingRow = {
  crew_count: number | null
  crew_label: string | null
  vehicle_size: string | null
  total_price: number | null
  remaining_balance: number | null
}

function asText(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

function envOrDefault(key: string, fallback: string) {
  const v = (Deno.env.get(key) || '').trim()
  return v || fallback
}

function pickCustomerEmail(pi: Stripe.PaymentIntent, fallback?: string | null) {
  const receipt = asText(pi.receipt_email)
  if (receipt) return receipt
  const meta = asText(pi.metadata?.customer_email)
  if (meta) return meta
  return asText(fallback)
}

function pickQuoteRef(pi: Stripe.PaymentIntent, quoteRef?: string | null) {
  const fromQuote = asText(quoteRef)
  if (fromQuote) return fromQuote
  const fromMeta = asText(pi.metadata?.quote_ref)
  if (fromMeta) return fromMeta
  return 'SMH-BOOKING'
}

function parsePounds(text: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function formatDateISO(isoDate: string) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-'
  const d = new Date(`${isoDate}T00:00:00Z`)
  return d.toLocaleDateString('en-GB')
}

function todayDateUK() {
  return new Date().toLocaleDateString('en-GB')
}

function pounds(n: number | null) {
  if (!Number.isFinite(Number(n))) return '-'
  return `GBP ${Number(n).toFixed(2)}`
}

/** StandardFonts Helvetica uses WinAnsi; unsupported glyphs can break pdf-lib drawText/save in Edge/Deno. */
function pdfSafeText(text: string): string {
  let out = ''
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0) ?? 63
    out += cp <= 255 ? ch : '?'
  }
  return out
}

const MIN_VALID_PDF_BYTES = 256

async function sha256Hex(bytes: Uint8Array) {
  const buf = bytes.slice()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function errorDetails(e: unknown) {
  if (e instanceof Error) {
    return {
      message: e.message,
      stack: e.stack || '',
      name: e.name || 'Error',
    }
  }
  return {
    message: String(e),
    stack: '',
    name: 'UnknownError',
  }
}

async function resolveEmailLogoUrl(candidateUrl: string) {
  const url = asText(candidateUrl)
  if (!url) return ''
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3500) })
    if (!res.ok) return ''
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('image/')) return url
    return ''
  } catch {
    return ''
  }
}

function parseInventoryRows(inventoryText: string, inventoryRaw?: unknown) {
  const rows: Array<{ qty: string; name: string }> = []
  const normalizeSegments = (text: string) =>
    String(text || '')
      .split(/[\r\n]+|•/g)
      .map((s) => s.trim().replace(/^[-*·•]\s*/, ''))
      .filter((s) => s && !/^inventory[:\s]*$/i.test(s))

  const parseSegment = (segment: string) => {
    const qtyMatch = segment.match(/(?:×|x)\s*(\d+)/i) || segment.match(/^(\d+)\s*(?:×|x)\s*/i)
    const qty = qtyMatch?.[1] ? qtyMatch[1] : '1'
    const cleanName = segment
      .replace(/(?:×|x)\s*\d+/gi, '')
      .replace(/^\d+\s*(?:×|x)\s*/i, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!cleanName) return null
    return {
      qty,
      name: cleanName,
    }
  }

  if (Array.isArray(inventoryRaw)) {
    for (const item of inventoryRaw as Array<Record<string, unknown>>) {
      const qty = String(item.quantity ?? item.qty ?? '').trim()
      const name = String(item.item_name ?? item.name ?? '')
        .replace(/(?:×|x)\s*\d+/gi, '')
        .replace(/^\d+\s*(?:×|x)\s*/i, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (name) rows.push({ qty: qty || '1', name })
    }
  }

  const lines = normalizeSegments(inventoryText)

  for (const line of lines) {
    const parsed = parseSegment(line)
    if (parsed) rows.push(parsed)
  }

  const dedup = new Map<string, { qty: string; name: string }>()
  for (const r of rows) {
    const key = `${r.qty}|${r.name}`
    if (!dedup.has(key)) dedup.set(key, r)
  }
  return [...dedup.values()]
}

async function buildBookingConfirmationPdf(params: {
  quote: QuoteRow
  stops?: QuoteStopRow[]
  inventoryItems?: QuoteInventoryItemRow[]
  requirements?: QuoteRequirementRow[]
  pricing?: QuotePricingRow | null
  invoiceNumber: string
  quoteRef: string
  paymentStatusLabel: string
  amountPaidGbp: number
  estimatedTotalGbp: number | null
  remainingBalanceGbp: number | null
  paymentType: string
}) {
  const {
    quote,
    stops = [],
    inventoryItems = [],
    requirements = [],
    pricing = null,
    invoiceNumber,
    quoteRef,
    paymentStatusLabel,
    amountPaidGbp,
    estimatedTotalGbp,
    remainingBalanceGbp,
    paymentType,
  } =
    params
  const moveDate = formatDateISO(asText(quote.move_date))
  const paidDate = quote.paid_at ? new Date(quote.paid_at).toLocaleString('en-GB') : todayDateUK()
  const companyName = envOrDefault('COMPANY_NAME', 'ShiftMyHome')
  const companyWebsite = envOrDefault('COMPANY_WEBSITE', 'https://shiftmyhome.co.uk')
  const companyEmail = envOrDefault('COMPANY_SUPPORT_EMAIL', envOrDefault('COMPANY_EMAIL', 'admin@shiftmyhome.co.uk'))
  const site = companyWebsite.replace(/\/$/, '')
  const termsUrl = envOrDefault('TERMS_URL', envOrDefault('COMPANY_TERMS_URL', `${site}/terms`))
  const privacyUrl = envOrDefault('PRIVACY_URL', envOrDefault('COMPANY_PRIVACY_URL', `${site}/privacy`))
  const contactUrl = envOrDefault('CONTACT_URL', envOrDefault('COMPANY_CONTACT_URL', `${site}/contact`))
  const pickupStop = stops.find((s) => s.stop_type === 'pickup')
  const deliveryStop = stops.find((s) => s.stop_type === 'delivery')
  const detailsText = asText(quote.details)
  const findDetail = (pattern: RegExp) => detailsText.match(pattern)?.[1]?.trim() || ''
  const isMeaningful = (v: string) => {
    const t = String(v || '').trim()
    if (!t) return false
    const l = t.toLowerCase()
    return l !== '-' && l !== 'n/a' && l !== 'no' && l !== 'none' && l !== '0'
  }
  const inventoryRows = inventoryItems.length
    ? inventoryItems.map((r) => ({
        qty: String(r.quantity ?? 1),
        name: String(r.item_name ?? '')
          .replace(/(?:×|x)\s*\d+/gi, '')
          .replace(/^\d+\s*(?:×|x)\s*/i, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      }))
    : parseInventoryRows(asText(quote.inventory_text), quote.inventory)
  const totalItemsCount = inventoryRows.reduce((sum, r) => {
    const n = Number(r.qty)
    return sum + (Number.isFinite(n) && n > 0 ? n : 1)
  }, 0)
  const specialRequirements = requirements.map((r) => `${r.requirement_type}: ${r.description}`).join(' • ')
  const serviceDetailsRows = [
    { label: 'Packing required', value: findDetail(/Packing:\s*(.+)/i) },
    { label: 'Dismantling required', value: findDetail(/Dismantling:\s*(.+)/i) },
    { label: 'Reassembly required', value: findDetail(/Reassembly:\s*(.+)/i) },
    {
      label: 'Parking / vehicle access',
      value: pickupStop?.parking_type || deliveryStop?.parking_type || findDetail(/Parking \/ vehicle access:\s*(.+)/i),
    },
    {
      label: 'Walking distance from van to door',
      value: pickupStop?.walking_distance || deliveryStop?.walking_distance || findDetail(/Walking distance \(van to door\):\s*(.+)/i),
    },
    { label: 'Flights of stairs', value: findDetail(/Flights of stairs:\s*(.+)/i) },
    { label: 'Stairs & access notes', value: findDetail(/Stairs notes:\s*(.+)/i) },
    { label: 'Heavy / bulky items notes', value: findDetail(/Heavy\/bulky items notes:\s*(.+)/i) },
    {
      label: 'Special instructions',
      value: specialRequirements || findDetail(/Special instructions:\s*(.+)/i),
    },
    { label: 'Photos optional if uploaded', value: findDetail(/Photos \(optional\):\s*(.+)/i) },
  ].filter((r) => isMeaningful(r.value))
  const paidBadge = paymentType === 'deposit' ? 'DEPOSIT PAID' : 'PAID'
  const isDeposit = paymentType === 'deposit'

  console.log('[payment-email] pdf-lib render started', { mode: 'pdf-lib-text' })
  try {
    const pdf = await PDFDocument.create()
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pageSize: [number, number] = [595, 842]
    let page = pdf.addPage(pageSize)
    const margin = 40
    const width = page.getWidth()
    const contentW = width - margin * 2
    let y = page.getHeight() - margin

    const C = {
      navy: rgb(0.06, 0.13, 0.25),
      blue: rgb(0.07, 0.36, 0.72),
      blueSoft: rgb(0.92, 0.96, 1),
      border: rgb(0.84, 0.9, 0.97),
      text: rgb(0.11, 0.16, 0.23),
      textSoft: rgb(0.37, 0.43, 0.51),
      white: rgb(1, 1, 1),
      green: rgb(0.1, 0.64, 0.35),
      amber: rgb(0.85, 0.53, 0.04),
    }

    const safeCompanyName = pdfSafeText(companyName)
    const safeBookingRefLine = pdfSafeText(`Booking reference: ${quoteRef}`)
    const safePaidDate = pdfSafeText(paidDate)
    const safeFooterPrimary = pdfSafeText(`${companyWebsite}  •  ${companyEmail}`)
    const safeFooterLegal = pdfSafeText(`Terms: ${termsUrl}   Privacy: ${privacyUrl}   Contact: ${contactUrl}`)

    const wrap = (text: string, maxW: number, size = 10, bold = false) => {
      const words = String(pdfSafeText(text) || '-').split(/\s+/)
      const lines: string[] = []
      const f = bold ? fontBold : fontRegular
      let line = ''
      for (const w of words) {
        const t = line ? `${line} ${w}` : w
        if (f.widthOfTextAtSize(t, size) <= maxW) line = t
        else {
          if (line) lines.push(line)
          line = w
        }
      }
      if (line) lines.push(line)
      return lines.length ? lines : ['-']
    }

    const ensure = (h: number) => {
      if (y - h < 55) {
        page = pdf.addPage(pageSize)
        y = page.getHeight() - margin
      }
    }

    const drawLabelValue = (x: number, yy: number, label: string, value: string, maxW: number) => {
      page.drawText(label, { x, y: yy, size: 8.5, font: fontBold, color: C.textSoft })
      const lines = wrap(value || '-', maxW, 9.5, false)
      let ly = yy - 11
      for (const ln of lines) {
        page.drawText(ln, { x, y: ly, size: 9.5, font: fontRegular, color: C.text })
        ly -= 11
      }
      return yy - ly + 3
    }

    const drawCard = (title: string, x: number, yy: number, w: number, rows: Array<{ label: string; value: string }>) => {
      const rowHeights = rows.map((r) => {
        const lines = wrap(r.value || '-', w - 20, 9.5, false)
        return 16 + lines.length * 11
      })
      const bodyH = rowHeights.reduce((a, b) => a + b, 0)
      const h = 30 + bodyH + 8
      ensure(h + 8)
      page.drawRectangle({
        x,
        y: yy - h,
        width: w,
        height: h,
        color: C.white,
        borderColor: C.border,
        borderWidth: 1,
      })
      page.drawText(title, { x: x + 10, y: yy - 19, size: 10.5, font: fontBold, color: C.blue })
      let cy = yy - 34
      for (const r of rows) {
        cy -= drawLabelValue(x + 10, cy, r.label, r.value, w - 20)
      }
      return h
    }

    // Header banner
    ensure(95)
    page.drawRectangle({ x: margin, y: y - 76, width: contentW, height: 76, color: C.blue })
    page.drawRectangle({ x: margin, y: y - 76, width: contentW, height: 8, color: C.navy })
    page.drawText(safeCompanyName, { x: margin + 14, y: y - 32, size: 17, font: fontBold, color: C.white })
    page.drawText('Invoice / Payment Receipt', { x: margin + 14, y: y - 50, size: 10.5, font: fontRegular, color: rgb(0.9, 0.95, 1) })
    page.drawText('Trusted UK Removals', { x: width - margin - 130, y: y - 34, size: 9.5, font: fontBold, color: C.white })
    y -= 88

    // Booking highlight bar + status badge
    ensure(38)
    page.drawRectangle({ x: margin, y: y - 30, width: contentW, height: 28, color: C.blueSoft, borderColor: C.border, borderWidth: 1 })
    page.drawText(safeBookingRefLine, { x: margin + 10, y: y - 19, size: 11, font: fontBold, color: C.navy })
    const badgeW = isDeposit ? 102 : 62
    page.drawRectangle({
      x: width - margin - badgeW - 8,
      y: y - 25,
      width: badgeW,
      height: 18,
      color: isDeposit ? C.amber : C.green,
    })
    page.drawText(paidBadge, {
      x: width - margin - badgeW + 2,
      y: y - 18,
      size: 8.5,
      font: fontBold,
      color: C.white,
    })
    y -= 38

    // Customer card
    const customerH = drawCard('Customer details', margin, y, contentW, [
      { label: 'Customer', value: asText(quote.full_name) || '-' },
      { label: 'Email', value: asText(quote.email) || '-' },
      { label: 'Phone', value: asText(quote.phone) || '-' },
      { label: 'Invoice number', value: invoiceNumber },
    ])
    y -= customerH + 10

    // Pickup + delivery cards
    const colW = (contentW - 10) / 2
    const pickupRows = [
      { label: 'Contact', value: pickupStop?.contact_name || asText(quote.full_name) || '-' },
      { label: 'Phone', value: pickupStop?.contact_phone || asText(quote.phone) || '-' },
      { label: 'Address', value: pickupStop?.address_line_1 || asText(quote.pickup_address) || '-' },
      { label: 'Floor', value: pickupStop?.floor || '-' },
      { label: 'Move date', value: moveDate || '-' },
      { label: 'Arrival', value: pickupStop?.date_time_window || asText(quote.arrival_window) || '-' },
    ]
    const deliveryRows = [
      { label: 'Contact', value: deliveryStop?.contact_name || asText(quote.full_name) || '-' },
      { label: 'Phone', value: deliveryStop?.contact_phone || asText(quote.phone) || '-' },
      { label: 'Address', value: deliveryStop?.address_line_1 || asText(quote.delivery_address) || '-' },
      { label: 'Floor', value: deliveryStop?.floor || '-' },
      { label: 'Service', value: asText(quote.service_type || quote.service) || '-' },
      {
        label: 'Crew Size',
        value: Number(pricing?.crew_count ?? quote.crew_size) > 0 ? `${pricing?.crew_count ?? quote.crew_size} ${Number(pricing?.crew_count ?? quote.crew_size) === 1 ? 'Man' : 'Men'}` : '-',
      },
    ]
    const pickupH = drawCard('Pickup details', margin, y, colW, pickupRows)
    const deliveryH = drawCard('Delivery details', margin + colW + 10, y, colW, deliveryRows)
    y -= Math.max(pickupH, deliveryH) + 10

    // Inventory 2-column grid
    if (inventoryRows.length) {
      const gap = 8
      const colW = (contentW - gap) / 2
      const cellPad = 8

      const drawInventoryHeader = (continued = false) => {
        ensure(54)
        page.drawText(continued ? 'Inventory (continued)' : 'Inventory', { x: margin, y: y, size: 12, font: fontBold, color: C.blue })
        page.drawText(`Total items: ${totalItemsCount}`, { x: width - margin - 120, y: y, size: 9.5, font: fontBold, color: C.textSoft })
        y -= 16
      }

      drawInventoryHeader(false)
      for (let i = 0; i < inventoryRows.length; i += 2) {
        const rowItems = [inventoryRows[i], inventoryRows[i + 1]].filter(Boolean)
        const lineCounts = rowItems.map((r) => wrap(`${r.qty || 1}x ${r.name || '-'}`, colW - cellPad * 2, 10.5, true).length)
        const rowH = Math.max(...lineCounts, 1) * 13 + 12
        if (y - rowH < 65) {
          page = pdf.addPage(pageSize)
          y = page.getHeight() - margin
          drawInventoryHeader(true)
        }
        for (let col = 0; col < 2; col++) {
          const item = rowItems[col]
          if (!item) continue
          const cellX = margin + col * (colW + gap)
          page.drawRectangle({
            x: cellX,
            y: y - rowH,
            width: colW,
            height: rowH,
            color: (Math.floor(i / 2) + col) % 2 === 0 ? C.white : rgb(0.985, 0.992, 1),
            borderColor: C.border,
            borderWidth: 0.8,
          })
          const lines = wrap(`${item.qty || 1}x ${item.name || '-'}`, colW - cellPad * 2, 10.5, true)
          let cellY = y - 14
          for (const ln of lines) {
            page.drawText(ln, { x: cellX + cellPad, y: cellY, size: 10.5, font: fontBold, color: C.text })
            cellY -= 13
          }
        }
        y -= rowH + 1
      }
      y -= 10
    }

    // Special instructions & services (filled fields only)
    if (serviceDetailsRows.length) {
      const serviceRows = serviceDetailsRows.map((r) => {
        const lines = wrap(r.value, contentW - 26, 9.5, false)
        return { ...r, lines, h: 14 + lines.length * 11 }
      })
      const serviceHeight = 34 + serviceRows.reduce((sum, r) => sum + r.h, 0)
      ensure(serviceHeight + 10)
      page.drawRectangle({ x: margin, y: y - serviceHeight, width: contentW, height: serviceHeight, color: C.white, borderColor: C.border, borderWidth: 1 })
      page.drawText('Special Instructions & Services', { x: margin + 10, y: y - 19, size: 11, font: fontBold, color: C.blue })
      let sy = y - 34
      for (const row of serviceRows) {
        page.drawText(pdfSafeText(row.label), { x: margin + 10, y: sy, size: 8.8, font: fontBold, color: C.textSoft })
        let vy = sy - 11
        for (const ln of row.lines) {
          page.drawText(ln, { x: margin + 10, y: vy, size: 9.5, font: fontRegular, color: C.text })
          vy -= 11
        }
        sy = vy - 2
      }
      y -= serviceHeight + 10
    }

    // Payment summary card (must be last section before footer)
    const pricedTotal = pricing?.total_price ?? estimatedTotalGbp ?? quote.estimated_total
    const pricedRemaining = pricing?.remaining_balance ?? remainingBalanceGbp ?? quote.remaining_balance
    const summaryHeight = specialRequirements ? 146 : 132
    ensure(summaryHeight + 12)
    page.drawRectangle({ x: margin, y: y - summaryHeight, width: contentW, height: summaryHeight, color: rgb(0.97, 0.99, 1), borderColor: C.border, borderWidth: 1 })
    page.drawText('Payment summary', { x: margin + 10, y: y - 19, size: 10.5, font: fontBold, color: C.blue })
    page.drawText(pounds(amountPaidGbp), { x: margin + 10, y: y - 48, size: 22, font: fontBold, color: C.navy })
    page.drawText('Amount paid', { x: margin + 10, y: y - 62, size: 8.5, font: fontRegular, color: C.textSoft })
    const rightX = margin + contentW / 2 + 12
    page.drawText(`Estimated total: ${pounds(pricedTotal)}`, { x: rightX, y: y - 33, size: 9.5, font: fontRegular, color: C.text })
    page.drawText(`Remaining balance: ${pounds(pricedRemaining)}`, { x: rightX, y: y - 47, size: 9.5, font: fontRegular, color: C.text })
    page.drawText(`Payment type: ${paymentType === 'deposit' ? 'Deposit payment' : 'Full payment'}`, { x: rightX, y: y - 61, size: 9.5, font: fontRegular, color: C.text })
    page.drawText(`Status: ${paymentStatusLabel}`, { x: rightX, y: y - 75, size: 9.5, font: fontRegular, color: C.text })
    page.drawText(`Date paid: ${safePaidDate}`, { x: rightX, y: y - 89, size: 9.5, font: fontRegular, color: C.text })
    if (specialRequirements) {
      const reqLines = wrap(`Requirements: ${specialRequirements}`, contentW - 20, 8.5, false)
      let ry = y - 111
      for (const ln of reqLines.slice(0, 3)) {
        page.drawText(ln, { x: margin + 10, y: ry, size: 8.5, font: fontRegular, color: C.textSoft })
        ry -= 10
      }
    }
    y -= summaryHeight + 10

    // Footer
    ensure(54)
    page.drawRectangle({ x: margin, y: y - 46, width: contentW, height: 40, color: C.navy })
    page.drawText(safeFooterPrimary, { x: margin + 10, y: y - 22, size: 8.5, font: fontBold, color: rgb(0.89, 0.94, 1) })
    page.drawText(safeFooterLegal, {
      x: margin + 10,
      y: y - 34,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.78, 0.85, 0.94),
    })

    const bytes = await pdf.save()
    if (!bytes?.length || bytes.length < MIN_VALID_PDF_BYTES) {
      throw new Error(`pdf-lib save returned invalid buffer (length=${bytes?.length ?? 0})`)
    }
    console.log('[payment-email] pdf-lib render success', { bytes: bytes.length })
    return bytes
  } catch (e) {
    const detail = errorDetails(e)
    console.error('[payment-email] pdf-lib render failed', detail)
    throw e
  }
}

export async function sendPaymentConfirmationWithPdfIfNeeded(params: {
  supabase: SupabaseClient
  paymentIntent: Stripe.PaymentIntent
  updateResult: UpdateResult
  resendApiKey: string
  resendFromEmail: string
}) {
  const { supabase, paymentIntent, updateResult, resendApiKey, resendFromEmail } = params
  const metadataQuoteRef = asText(paymentIntent.metadata?.quote_ref)
  const metadataQuoteId = asText(paymentIntent.metadata?.quote_id)
  console.log('[payment-email] start', {
    payment_intent_id: paymentIntent.id,
    update_result_quote_id: updateResult.quote_id ?? null,
    metadata_quote_id: metadataQuoteId || null,
    metadata_quote_ref: metadataQuoteRef || null,
    update_ok: updateResult.ok,
    resend_configured: Boolean(resendApiKey),
  })
  if (!resendApiKey) {
    console.log('[payment-email] skipped - missing preconditions')
    return { sent: false, reason: 'skipped' as const, debug: { stage: 'preconditions' } }
  }

  const quoteSelect =
    'id, quote_ref, full_name, email, phone, pickup_address, delivery_address, move_date, service, service_type, crew_size, vehicle_size, arrival_window, details, inventory_text, inventory, pricing, amount_paid, payment_type, paid_at, payment_confirmation_email_sent_at, payment_confirmation_email_intent_id, estimated_total, remaining_balance'
  let quote: QuoteRow | null = null
  /** Prefer Stripe metadata.quote_ref so idempotency matches the row you inspect in the dashboard (updateResult.quote_id can point at a different row if metadata.quote_id was wrong/stale). */
  let quoteLookupVia: 'metadata_quote_ref' | 'metadata_quote_id' | 'update_result_quote_id' | null = null

  if (metadataQuoteRef) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('quote_ref', metadataQuoteRef).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'metadata_quote_ref'
    }
  }
  if (!quote && metadataQuoteId) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('id', metadataQuoteId).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'metadata_quote_id'
    }
  }
  const fallbackQuoteId = asText(updateResult.quote_id)
  if (!quote && fallbackQuoteId) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('id', fallbackQuoteId).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'update_result_quote_id'
    }
  }

  if (metadataQuoteRef && quote?.quote_ref && quote.quote_ref !== metadataQuoteRef) {
    console.warn('[payment-email] loaded quote_ref does not match PaymentIntent metadata.quote_ref', {
      loaded_quote_ref: quote.quote_ref,
      metadata_quote_ref: metadataQuoteRef,
      quote_lookup_via: quoteLookupVia,
    })
  }
  if (metadataQuoteId && quote?.id && quote.id !== metadataQuoteId) {
    console.warn('[payment-email] loaded quote id does not match PaymentIntent metadata.quote_id', {
      loaded_quote_id: quote.id,
      metadata_quote_id: metadataQuoteId,
      quote_lookup_via: quoteLookupVia,
    })
  }

  if (!quote?.id) {
    return {
      sent: false,
      reason: 'quote_missing' as const,
      debug: { stage: 'quote_lookup', metadata_quote_ref: metadataQuoteRef || null, metadata_quote_id: metadataQuoteId || null },
    }
  }

  console.log('[payment-email] quote resolved', {
    quote_lookup_via: quoteLookupVia,
    quote_id: quote.id,
    quote_ref: quote.quote_ref ?? null,
    payment_confirmation_email_sent_at: quote.payment_confirmation_email_sent_at ?? null,
    payment_confirmation_email_intent_id: quote.payment_confirmation_email_intent_id ?? null,
  })

  if (quote.payment_confirmation_email_sent_at && quote.payment_confirmation_email_intent_id === paymentIntent.id) {
    console.log('[payment-email] skipped - already sent', {
      quote_id: quote.id,
      quote_ref: quote.quote_ref ?? null,
      quote_lookup_via: quoteLookupVia,
      sent_at: quote.payment_confirmation_email_sent_at,
      sent_intent_id: quote.payment_confirmation_email_intent_id || null,
      payment_intent_id: paymentIntent.id,
    })
    return { sent: false, reason: 'already_sent' as const }
  }
  if (quote.payment_confirmation_email_sent_at && quote.payment_confirmation_email_intent_id !== paymentIntent.id) {
    console.log('[payment-email] prior email sent for different intent; continuing', {
      quote_id: quote.id,
      previous_sent_at: quote.payment_confirmation_email_sent_at,
      previous_intent_id: quote.payment_confirmation_email_intent_id || null,
      payment_intent_id: paymentIntent.id,
    })
  }

  const customerEmail = pickCustomerEmail(paymentIntent, quote.email)
  if (!customerEmail) {
    console.warn('[payment-email] skipped - no customer email')
    return { sent: false, reason: 'email_missing' as const, debug: { stage: 'customer_email' } }
  }

  const [{ data: stopsData }, { data: inventoryItemsData }, { data: requirementsData }, { data: pricingData }] = await Promise.all([
    supabase
      .from('quote_stops')
      .select('stop_type, contact_name, contact_phone, address_line_1, floor, lift_available, parking_type, walking_distance, date_time_window, access_notes')
      .eq('quote_id', quote.id),
    supabase
      .from('quote_inventory_items')
      .select('item_name, quantity, volume_m3, size_category, weight_category, notes')
      .eq('quote_id', quote.id),
    supabase.from('quote_requirements').select('requirement_type, description').eq('quote_id', quote.id),
    supabase
      .from('quote_pricing')
      .select('crew_count, crew_label, vehicle_size, total_price, remaining_balance')
      .eq('quote_id', quote.id)
      .maybeSingle(),
  ])

  const quoteRef = pickQuoteRef(paymentIntent, quote.quote_ref)
  const amountPaidGbp = Math.max(0, (paymentIntent.amount_received ?? paymentIntent.amount ?? 0) / 100)
  const paymentType = asText(quote.payment_type) || asText(paymentIntent.metadata?.payment_type) || 'full'
  const paymentStatusLabel = paymentType === 'deposit' ? 'Deposit paid' : 'Paid'

  const pricingText = asText(quote.pricing)
  const estimatedTotalGbp =
    parsePounds(pricingText, [
      /Estimated total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
      /Total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
    ]) ?? null
  const remainingBalanceGbp =
    paymentType === 'deposit' && estimatedTotalGbp != null ? Math.max(0, estimatedTotalGbp - amountPaidGbp) : 0

  const invoiceNumber = `SMH-INV-${quoteRef.replace(/[^A-Za-z0-9]/g, '').slice(-12)}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}`

  let pdfBase64 = ''
  let pdfBytesForStorage: Uint8Array | null = null
  let pdfAttached = false
  const attachmentFilename = `ShiftMyHome-Invoice-${quoteRef}.pdf`
  let pdfByteSize = 0
  let pdfSha256 = ''
  let pdfHeader = ''
  let pdfDebugStoredPath: string | null = null
  let pdfAttachmentUrl: string | null = null
  let invoiceDownloadUrl: string | null = null
  let invoiceBucket = ''
  try {
    console.log('[payment-email] generating pdf', { quote_ref: quoteRef, invoice_number: invoiceNumber })
    const pdfBytes = await buildBookingConfirmationPdf({
      quote,
      stops: (stopsData || []) as QuoteStopRow[],
      inventoryItems: (inventoryItemsData || []) as QuoteInventoryItemRow[],
      requirements: (requirementsData || []) as QuoteRequirementRow[],
      pricing: (pricingData as QuotePricingRow | null) || null,
      invoiceNumber,
      quoteRef,
      paymentStatusLabel,
      amountPaidGbp,
      estimatedTotalGbp,
      remainingBalanceGbp,
      paymentType,
    })
    pdfByteSize = pdfBytes.length
    pdfBytesForStorage = pdfBytes
    pdfHeader = new TextDecoder().decode(pdfBytes.subarray(0, Math.min(5, pdfBytes.length)))
    pdfSha256 = await sha256Hex(pdfBytes)
    pdfBase64 = encodePdfBytesToResendBase64(new Uint8Array(pdfBytes))
    pdfAttached = true
    console.log('[payment-email] pdf generated', {
      bytes: pdfByteSize,
      base64_length: pdfBase64.length,
      filename: attachmentFilename,
      header: pdfHeader,
      sha256: pdfSha256,
      quote_ref: quoteRef,
    })
  } catch (e) {
    const detail = errorDetails(e)
    pdfAttached = false
    console.error('[payment-email] pdf generation failed, sending without attachment', detail)
  }

  if (pdfAttached && (pdfByteSize < MIN_VALID_PDF_BYTES || !pdfBase64.length)) {
    console.error('[payment-email] pdf attachment discarded (invalid size or base64)', {
      pdfByteSize,
      base64Length: pdfBase64.length,
      quote_ref: quoteRef,
    })
    pdfAttached = false
    pdfBytesForStorage = null
  }

  // Optional storage persistence only. Never affects attachment delivery.
  if (pdfAttached) {
    invoiceBucket = asText(Deno.env.get('INVOICE_STORAGE_BUCKET'))
    if (!invoiceBucket) {
      console.log('[payment-email] storage upload skipped (no invoice bucket configured)')
    } else {
      try {
        const debugPath = `payment-invoices/${new Date().toISOString().slice(0, 10)}/${paymentIntent.id}-${Date.now()}.pdf`
        const up = await supabase.storage
          .from(invoiceBucket)
          .upload(debugPath, pdfBytesForStorage || new Uint8Array(), {
          contentType: 'application/pdf',
          upsert: true,
        })
        if (up.error) {
          console.error('[payment-email] invoice pdf upload failed', {
            bucket: invoiceBucket,
            path: debugPath,
            error: up.error.message,
          })
        } else {
          pdfDebugStoredPath = `${invoiceBucket}/${debugPath}`
          console.log('[payment-email] invoice pdf uploaded', { path: pdfDebugStoredPath })
          try {
            const signed = await supabase.storage.from(invoiceBucket).createSignedUrl(debugPath, 60 * 60 * 24 * 30)
            if (!signed.error && signed.data?.signedUrl) {
              invoiceDownloadUrl = signed.data.signedUrl
              console.log('[payment-email] invoice signed url created', { has_url: true })
            }
          } catch (e) {
            console.error('[payment-email] invoice signed url exception', errorDetails(e))
          }
          if (!invoiceDownloadUrl) {
            try {
              const pub = supabase.storage.from(invoiceBucket).getPublicUrl(debugPath)
              const publicUrl = asText(pub.data?.publicUrl)
              if (publicUrl) invoiceDownloadUrl = publicUrl
            } catch (e) {
              console.error('[payment-email] invoice public url exception', errorDetails(e))
            }
          }
        }
      } catch (e) {
        console.error('[payment-email] storage upload exception (ignored for attachment)', errorDetails(e))
      }
    }
  }

  const companyName = envOrDefault('COMPANY_NAME', 'ShiftMyHome')
  const companyEmail = envOrDefault('COMPANY_SUPPORT_EMAIL', envOrDefault('COMPANY_EMAIL', 'admin@shiftmyhome.co.uk'))
  const companyWebsite = envOrDefault('COMPANY_WEBSITE', 'https://shiftmyhome.co.uk')
  const companyAddress = envOrDefault('COMPANY_ADDRESS', 'Glasgow, Scotland')
  const companyNumber = envOrDefault('COMPANY_NUMBER', 'N/A')
  const site = companyWebsite.replace(/\/$/, '')
  const logoResolved = await resolveEmailLogoUrl(envOrDefault('COMPANY_LOGO_URL', ''))
  console.log('[payment-email] branding snapshot', {
    company_name: companyName,
    company_website: companyWebsite,
    logo_url_configured: Boolean(asText(envOrDefault('COMPANY_LOGO_URL', ''))),
    logo_url_resolved: Boolean(logoResolved),
    resend_from_email: resendFromEmail,
  })
  const rendered = renderTransactionalEmailTemplate({
    kind: 'payment_received',
    brand: {
      companyName,
      supportEmail: companyEmail,
      websiteUrl: companyWebsite,
      companyAddress,
      companyNumber,
      logoUrl: logoResolved,
      termsUrl: envOrDefault('TERMS_URL', envOrDefault('COMPANY_TERMS_URL', `${site}/terms`)),
      privacyUrl: envOrDefault('PRIVACY_URL', envOrDefault('COMPANY_PRIVACY_URL', `${site}/privacy`)),
      contactUrl: envOrDefault('CONTACT_URL', envOrDefault('COMPANY_CONTACT_URL', `${site}/contact`)),
    },
    paymentPayload: {
      quoteRef,
      paymentStatus: paymentStatusLabel,
      collectionSummary: asText(quote.pickup_address) || '-',
      deliverySummary: asText(quote.delivery_address) || '-',
    },
  })
  console.log('[payment-email] template rendered', {
    subject: rendered.subject,
    html_len: rendered.html.length,
    text_len: rendered.text.length,
  })

  console.log('[payment-email] sending via resend', {
    quote_ref: quoteRef,
    to: customerEmail,
    payment_intent_id: paymentIntent.id,
  })
  /** Identical `{ filename, content }` attachment rows + POST path as `resend-pdf-attachment-test` (`sendResendEmailMinimal`). */
  const attachments = pdfAttached
    ? [{ filename: attachmentFilename, content: pdfBase64 }]
    : []

  const subjectForResend = asciiEmailSubject(rendered.subject)
  if (subjectForResend !== rendered.subject) {
    console.warn('[payment-email] subject normalized to ASCII for Resend', {
      before_len: rendered.subject.length,
      after: subjectForResend,
    })
  }

  const resendResult = await sendResendEmailMinimal({
    logTag: 'payment-email',
    apiKey: resendApiKey,
    from: resendFromEmail,
    to: [customerEmail],
    subject: subjectForResend,
    html: rendered.html,
    text: rendered.text,
    attachments,
  })

  if (!resendResult.ok) {
    let detail = resendResult.bodyText
    try {
      const j = JSON.parse(resendResult.bodyText) as { message?: string }
      if (typeof j?.message === 'string') detail = j.message
    } catch {
      /* raw text */
    }
    const msg = detail || `Resend failed (${resendResult.status})`
    console.error('[payment-email] resend failed', {
      status: resendResult.status,
      status_text: resendResult.statusText,
      error: msg,
      response_body: resendResult.bodyText,
      request_id: resendResult.requestId || null,
      context: {
        quote_ref: quoteRef,
        quote_id: quote.id,
        payment_intent_id: paymentIntent.id,
        to: customerEmail,
        from: resendFromEmail,
        attachment_included: pdfAttached,
      },
    })
    throw new Error(msg)
  }

  const resendId = resendResult.resendId
  const resendResponseBody = resendResult.bodyText
  console.log('[payment-email] resend accepted', {
    attachment_included: pdfAttached,
    resend_id: resendId || null,
  })

  if (!pdfAttached || attachments.length === 0) {
    console.warn('[payment-email] resend delivered without attachment; not marking quote as sent', {
      quote_id: quote.id,
      quote_ref: quoteRef,
      payment_intent_id: paymentIntent.id,
      attachment_included: pdfAttached,
      attachment_count: attachments.length,
    })
    return {
      sent: false as const,
      reason: 'attachment_missing' as const,
      quoteRef,
      debug: {
        pdf: {
          attached: pdfAttached,
          bytes: pdfByteSize,
          base64Length: pdfBase64.length,
          filename: attachmentFilename,
          mimeType: 'application/pdf',
          header: pdfHeader,
          sha256: pdfSha256,
          storedPath: pdfDebugStoredPath,
          signedUrl: pdfAttachmentUrl,
        },
        resend: {
          id: resendId || null,
          attachmentCount: attachments.length,
          rawResponse: resendResponseBody || null,
        },
      },
    }
  }

  await supabase
    .from('quotes')
    .update({
      payment_confirmation_email_sent_at: new Date().toISOString(),
      payment_confirmation_email_provider: 'resend',
      payment_confirmation_email_intent_id: paymentIntent.id,
    })
    .eq('id', quote.id)
    .is('payment_confirmation_email_sent_at', null)
  console.log('[payment-email] marked sent in db', { quote_id: quote.id, payment_intent_id: paymentIntent.id })

  return {
    sent: true as const,
    quoteRef,
    debug: {
      pdf: {
        attached: pdfAttached,
        bytes: pdfByteSize,
        base64Length: pdfBase64.length,
        filename: attachmentFilename,
        mimeType: 'application/pdf',
        header: pdfHeader,
        sha256: pdfSha256,
        storedPath: pdfDebugStoredPath,
        signedUrl: pdfAttachmentUrl,
      },
      resend: {
        id: resendId || null,
        attachmentCount: attachments.length,
        rawResponse: resendResponseBody || null,
      },
    },
  }
}
