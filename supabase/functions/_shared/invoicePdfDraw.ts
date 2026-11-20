import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'npm:pdf-lib@1.17.1'
import { canonicalInvoiceInventory, customerInvoiceNotes, totalItemQuantity } from './invoiceInventory.js'

type Stop = {
  stop_type?: string
  address_line_1?: string | null
  floor?: string | null
  lift_available?: boolean | null
  parking_type?: string | null
  access_notes?: string | null
}

export type InvoiceDrawInput = {
  quote: Record<string, unknown>
  stops?: Stop[]
  inventoryItems?: Array<Record<string, unknown>>
  quoteRef: string
  invoiceNumber: string
  amountPaidGbp: number
  invoiceTotalGbp: number | null
  remainingBalanceGbp: number | null
  paymentTypeLabel?: string
  logoPng?: Uint8Array
  company?: {
    legalName?: string
    address?: string
    companyNumber?: string
    email?: string
    website?: string
    termsUrl?: string
    vatNumber?: string
  }
}

const PAGE: [number, number] = [595.28, 841.89]
const MARGIN = 40
const NAVY = rgb(0.0, 0.05, 0.15)
const BLUE = rgb(0.11, 0.31, 0.85)
const TEXT = rgb(0.07, 0.09, 0.13)
const MUTED = rgb(0.39, 0.45, 0.53)
const LINE = rgb(0.86, 0.89, 0.93)
const SOFT = rgb(0.96, 0.97, 0.98)
const GREEN = rgb(0.05, 0.45, 0.31)
const GREEN_BG = rgb(0.93, 0.98, 0.95)
const AMBER = rgb(0.57, 0.25, 0.05)
const AMBER_BG = rgb(1, 0.97, 0.92)

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

function safe(text: unknown) {
  return String(text ?? '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00D7/g, 'x')
    .replace(/[^\u0000-\u00FF]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function money(value: number) {
  return `\u00A3${Math.abs(Number(value) || 0).toFixed(2)}`
}

function meaningful(value: unknown) {
  const text = safe(value).toLowerCase()
  return Boolean(text) && !GENERIC_NOTE.has(text)
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).split(' ').filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

function arrivalWindow(value: unknown) {
  const text = safe(value)
  const range = text.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)
  if (!range) return text
  return range[0].replace(/\s+/g, '')
}

export async function renderInvoicePdf(input: InvoiceDrawInput) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let logo: PDFImage | null = null
  if (input.logoPng?.length) {
    try {
      logo = await pdf.embedPng(input.logoPng)
    } catch {
      logo = null
    }
  }

  const quote = input.quote || {}
  const stops = input.stops || []
  const pickup = stops.find((stop) => stop.stop_type === 'pickup')
  const delivery = stops.find((stop) => stop.stop_type === 'delivery')
  const inventory = canonicalInvoiceInventory({
    inventoryItems: input.inventoryItems || [],
    inventory: quote.inventory,
    inventoryText: String(quote.inventory_text || ''),
  })
  const itemCount = totalItemQuantity(inventory)
  const paid = Math.max(0, Number(input.amountPaidGbp) || 0)
  const total = Number.isFinite(Number(input.invoiceTotalGbp)) ? Number(input.invoiceTotalGbp) : paid
  const remaining = Number.isFinite(Number(input.remainingBalanceGbp))
    ? Math.max(0, Number(input.remainingBalanceGbp))
    : Math.max(0, Math.round((total - paid) * 100) / 100)
  const status = paid > 0.009 && remaining <= 0.009 ? 'PAID' : paid > 0.009 ? 'PARTIALLY PAID' : 'UNPAID'
  const paidOn = status === 'UNPAID' ? '' : safe(quote.paid_on_label)
  const company = input.company || {}
  const legalName = safe(company.legalName) || 'ShiftMyHome Ltd'
  const companyAddress = safe(company.address) || '128 City Road, London, EC1V 2NX'
  const companyNumber = safe(company.companyNumber) || '16730159'
  const email = safe(company.email) || 'admin@shiftmyhome.co.uk'
  const website = (safe(company.website) || 'https://www.shiftmyhome.co.uk').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const termsUrl = safe(company.termsUrl) || 'https://www.shiftmyhome.co.uk/terms'
  const vatNumber = safe(company.vatNumber)

  const crew = Number(quote.crew_size)
  const crewLabel = crew === 1 ? '1 mover' : crew > 1 ? `${crew} movers` : ''
  const serviceName = safe(quote.service_type || quote.service) || 'Removal'
  const serviceLine = crewLabel ? `${serviceName} service - ${crewLabel}` : `${serviceName} service`
  const moveLine = crewLabel ? `${serviceName} - ${crewLabel}` : serviceName
  const collection = safe(pickup?.address_line_1) || safe(quote.pickup_address)
  const dropoff = safe(delivery?.address_line_1) || safe(quote.delivery_address)
  const notes = customerInvoiceNotes([pickup?.parking_type, pickup?.access_notes, delivery?.access_notes])

  let page = pdf.addPage(PAGE)
  let y = PAGE[1] - MARGIN
  const width = PAGE[0] - MARGIN * 2

  const newPage = () => {
    page = pdf.addPage(PAGE)
    y = PAGE[1] - MARGIN
  }
  const room = (height: number) => {
    if (y - height < 120) newPage()
  }

  const rule = (yy: number) => {
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: MARGIN + width, y: yy }, thickness: 0.6, color: LINE })
  }

  if (logo) {
    const logoHeight = 42
    const logoWidth = Math.min(210, (logo.width / logo.height) * logoHeight)
    page.drawImage(logo, { x: MARGIN, y: y - logoHeight, width: logoWidth, height: logoHeight })
  } else {
    page.drawText('ShiftMyHome', { x: MARGIN, y: y - 22, size: 16, font: bold, color: NAVY })
  }
  page.drawText('INVOICE', { x: MARGIN + width - bold.widthOfTextAtSize('INVOICE', 18), y: y - 16, size: 18, font: bold, color: NAVY })
  const meta = [
    `Invoice number: ${safe(input.invoiceNumber)}`,
    `Booking reference: ${safe(input.quoteRef)}`,
    `Issued: ${safe(quote.issued_on_label)}`,
  ]
  meta.forEach((line, index) => {
    const text = safe(line)
    page.drawText(text, {
      x: MARGIN + width - font.widthOfTextAtSize(text, 8),
      y: y - 32 - index * 11,
      size: 8,
      font,
      color: MUTED,
    })
  })
  const badge = status
  const badgeWidth = bold.widthOfTextAtSize(badge, 8) + 14
  page.drawRectangle({
    x: MARGIN + width - badgeWidth,
    y: y - 74,
    width: badgeWidth,
    height: 16,
    color: status === 'PAID' ? GREEN_BG : status === 'PARTIALLY PAID' ? AMBER_BG : SOFT,
    borderColor: status === 'UNPAID' ? LINE : status === 'PAID' ? GREEN : AMBER,
    borderWidth: 0.6,
  })
  page.drawText(badge, {
    x: MARGIN + width - badgeWidth + 7,
    y: y - 69.5,
    size: 8,
    font: bold,
    color: status === 'PAID' ? GREEN : status === 'PARTIALLY PAID' ? AMBER : MUTED,
  })
  y -= 108
  rule(y)
  y -= 18

  const colGap = 16
  const colWidth = (width - colGap) / 2
  const sectionTitle = (label: string, x: number, yy: number) => {
    page.drawText(label, { x, y: yy, size: 8, font: bold, color: BLUE })
  }
  const textBlock = (lines: string[], x: number, yy: number, size = 9.5, useBold = false) => {
    let cursor = yy
    for (const line of lines) {
      page.drawText(safe(line), { x, y: cursor, size, font: useBold ? bold : font, color: TEXT })
      cursor -= size + 3
    }
    return yy - cursor
  }

  sectionTitle('BILL TO', MARGIN, y)
  sectionTitle('MOVE DETAILS', MARGIN + colWidth + colGap, y)
  y -= 14
  const billLines = [safe(quote.full_name), safe(quote.email), safe(quote.phone)].filter(Boolean)
  const moveLines = [safe(quote.move_date_label), moveLine, arrivalWindow(quote.arrival_window) ? `Arrival window: ${arrivalWindow(quote.arrival_window)}` : ''].filter(Boolean)
  const leftH = textBlock(billLines, MARGIN, y)
  const rightH = textBlock(moveLines, MARGIN + colWidth + colGap, y)
  y -= Math.max(leftH, rightH) + 8

  const extrasFor = (stop?: Stop) => {
    const lines: string[] = []
    if (stop && meaningful(stop.floor)) lines.push(`Floor ${safe(stop.floor)}`)
    if (stop?.lift_available === true) lines.push('Lift available')
    return lines
  }
  const addressLinesFor = (address: string) => (address ? wrap(address, font, 8.5, colWidth - 16).slice(0, 3) : [])
  const leftAddress = addressLinesFor(collection)
  const rightAddress = addressLinesFor(dropoff)
  const leftExtras = extrasFor(pickup)
  const rightExtras = extrasFor(delivery)
  const boxHeight = Math.max(
    46,
    22 + Math.max(leftAddress.length, rightAddress.length, 1) * 11 + Math.max(leftExtras.length, rightExtras.length) * 10 + 8,
  )
  room(boxHeight + 20)
  const drawAddressBox = (title: string, lines: string[], extras: string[], x: number) => {
    page.drawRectangle({ x, y: y - boxHeight, width: colWidth, height: boxHeight, color: SOFT, borderColor: LINE, borderWidth: 0.7 })
    page.drawText(title, { x: x + 8, y: y - 13, size: 7.5, font: bold, color: BLUE })
    lines.forEach((line, index) => {
      page.drawText(line, { x: x + 8, y: y - 26 - index * 11, size: 8.5, font, color: TEXT })
    })
    extras.forEach((line, index) => {
      page.drawText(safe(line), {
        x: x + 8,
        y: y - 28 - lines.length * 11 - index * 10,
        size: 7.5,
        font,
        color: MUTED,
      })
    })
  }
  drawAddressBox('COLLECTION', leftAddress, leftExtras, MARGIN)
  drawAddressBox('DELIVERY', rightAddress, rightExtras, MARGIN + colWidth + colGap)
  y -= boxHeight + 16

  const drawServiceHeader = () => {
    room(36)
    page.drawText('SERVICE', { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    page.drawText('AMOUNT', { x: MARGIN + width - bold.widthOfTextAtSize('AMOUNT', 8), y, size: 8, font: bold, color: MUTED })
    y -= 6
    rule(y)
    y -= 14
  }
  drawServiceHeader()
  const serviceLines = wrap(serviceLine, font, 9.5, width - 90)
  serviceLines.forEach((line, index) => {
    page.drawText(line, { x: MARGIN, y, size: 9.5, font, color: TEXT })
    if (index === 0) {
      const amount = money(total)
      page.drawText(amount, { x: MARGIN + width - font.widthOfTextAtSize(amount, 9.5), y, size: 9.5, font, color: TEXT })
    }
    y -= 13
  })
  y -= 8

  const drawInventoryHeader = () => {
    room(34)
    page.drawText('INVENTORY', { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    const qtyTitle = 'QTY'
    page.drawText(qtyTitle, { x: MARGIN + width - bold.widthOfTextAtSize(qtyTitle, 8), y, size: 8, font: bold, color: MUTED })
    y -= 6
    rule(y)
    y -= 13
  }
  if (inventory.length) {
    drawInventoryHeader()
    for (const item of inventory) {
      const nameLines = wrap(item.name, font, 9, width - 50)
      const rowHeight = Math.max(nameLines.length, 1) * 12 + 2
      if (y - rowHeight < 120) {
        newPage()
        drawInventoryHeader()
      }
      nameLines.forEach((line, index) => {
        page.drawText(line, { x: MARGIN, y, size: 9, font, color: TEXT })
        if (index === 0) {
          const qty = String(item.quantity)
          page.drawText(qty, { x: MARGIN + width - font.widthOfTextAtSize(qty, 9), y, size: 9, font, color: TEXT })
        }
        y -= 12
      })
    }
    y -= 2
    page.drawText(`Total items: ${itemCount}`, { x: MARGIN, y, size: 8.5, font: bold, color: TEXT })
    y -= 16
  }

  if (notes.length) {
    room(20 + notes.length * 11)
    page.drawText('NOTES', { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    y -= 12
    for (const note of notes) {
      page.drawText(safe(note), { x: MARGIN, y, size: 8.5, font, color: TEXT })
      y -= 11
    }
    y -= 6
  }

  const summaryRows = [
    ['Invoice total', money(total)],
    ['Amount paid', money(paid)],
    ['Balance due', money(remaining)],
  ]
  const summaryWidth = 230
  const summaryX = MARGIN + width - summaryWidth
  room(78)
  y -= 4
  rule(y + 10)
  summaryRows.forEach((row, index) => {
    const [label, value] = row
    page.drawText(label, { x: summaryX, y, size: 9, font: index === 2 ? bold : font, color: TEXT })
    page.drawText(value, { x: MARGIN + width - bold.widthOfTextAtSize(value, 9), y, size: 9, font: bold, color: TEXT })
    y -= 14
  })
  y -= 2
  const method = safe(input.paymentTypeLabel)
  if (method) {
    page.drawText(`Payment method: ${method}`, { x: summaryX, y, size: 8.5, font, color: TEXT })
    y -= 12
  }
  if (paidOn) {
    page.drawText(`Paid on: ${paidOn}`, { x: summaryX, y, size: 8.5, font, color: TEXT })
    y -= 14
  } else {
    y -= 4
  }

  room(36)
  page.drawText('Thank you for choosing ShiftMyHome.', { x: MARGIN, y, size: 9, font, color: TEXT })
  y -= 22

  if (y < 108) newPage()
  const footerLines = [
    legalName,
    companyAddress,
    `Company number ${companyNumber}`,
    vatNumber ? `VAT number ${vatNumber}` : '',
    `${website}  |  ${email}`,
    termsUrl,
  ].filter(Boolean)
  const footerTop = 36 + footerLines.length * 9
  page.drawLine({
    start: { x: MARGIN, y: footerTop + 8 },
    end: { x: MARGIN + width, y: footerTop + 8 },
    thickness: 0.6,
    color: LINE,
  })
  footerLines.forEach((line, index) => {
    page.drawText(safe(line), { x: MARGIN, y: footerTop - 6 - index * 9, size: 7.5, font, color: MUTED })
  })

  return pdf.save()
}
