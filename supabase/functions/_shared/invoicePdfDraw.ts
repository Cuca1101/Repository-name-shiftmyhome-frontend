import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'npm:pdf-lib@1.17.1'
import { canonicalInvoiceInventory, customerDocumentNotes, totalItemQuantity } from './invoiceInventory.js'

type Stop = {
  stop_type?: string
  contact_name?: string | null
  contact_phone?: string | null
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
  requirements?: Array<Record<string, unknown>>
  quoteRef: string
  invoiceNumber: string
  amountPaidGbp: number
  invoiceTotalGbp: number | null
  remainingBalanceGbp: number | null
  paymentTypeLabel?: string
  /** Job sheets use this same drawing and omit the customer and move-detail block. */
  documentKind?: 'invoice' | 'job_sheet'
  logoPng?: Uint8Array
  company?: {
    legalName?: string
    address?: string
    companyNumber?: string
    email?: string
    phone?: string
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
const BLUE_SOFT = rgb(0.93, 0.96, 0.99)
const BLUE_SHADOW = rgb(0.84, 0.89, 0.96)
const BLUE_LINE = rgb(0.73, 0.82, 0.94)

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
  const phone = safe(company.phone) || '0141 461 4813'
  const website = (safe(company.website) || 'https://www.shiftmyhome.co.uk').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const termsUrl = safe(company.termsUrl) || 'https://www.shiftmyhome.co.uk/terms'
  const vatNumber = safe(company.vatNumber)

  const crew = Number(quote.crew_size)
  const crewLabel = crew >= 1 ? `${crew} man` : ''
  const serviceName = safe(quote.service_type || quote.service) || 'Removal'
  const serviceLine = crewLabel ? `${serviceName} service - ${crewLabel}` : `${serviceName} service`
  const moveLine = crewLabel ? `${serviceName} - ${crewLabel}` : serviceName
  const collection = safe(pickup?.address_line_1) || safe(quote.pickup_address)
  const dropoff = safe(delivery?.address_line_1) || safe(quote.delivery_address)
  const documentNotes = customerDocumentNotes({
    quote,
    stops,
    requirements: input.requirements || [],
  })

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
  const jobSheet = input.documentKind === 'job_sheet'
  const title = jobSheet ? 'JOB SHEET' : 'INVOICE'
  page.drawText(title, { x: MARGIN + width - bold.widthOfTextAtSize(title, 18), y: y - 16, size: 18, font: bold, color: NAVY })
  const meta = jobSheet
    ? [
        `Booking reference: ${safe(input.quoteRef)}`,
        `Issued: ${safe(quote.issued_on_label)}`,
      ]
    : [
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

  if (!jobSheet) {
    sectionTitle('BILL TO', MARGIN, y)
    sectionTitle('MOVE DETAILS', MARGIN + colWidth + colGap, y)
    y -= 14
    const billLines = [safe(quote.full_name), safe(quote.email), safe(quote.phone)].filter(Boolean)
    const moveLines = [safe(quote.move_date_label), moveLine, arrivalWindow(quote.arrival_window) ? `Arrival window: ${arrivalWindow(quote.arrival_window)}` : ''].filter(Boolean)
    const leftH = textBlock(billLines, MARGIN, y)
    const rightH = textBlock(moveLines, MARGIN + colWidth + colGap, y)
    y -= Math.max(leftH, rightH) + 8
  }

  const shown = (value: unknown) => {
    const text = safe(value)
    return text && !/^(n\/a|—|-)$/i.test(text) ? text : ''
  }
  const accessLine = (stop?: Stop) => {
    const floor = shown(stop?.floor)
    if (!floor) return ''
    const ground = floor === '0' || /^g$/i.test(floor) || /ground/i.test(floor)
    const place = ground ? 'Ground floor' : `Floor ${floor}`
    if (ground) return place
    if (stop?.lift_available === true) return `${place}. Lift: Yes`
    if (stop?.lift_available === false) return `${place}. Lift: No`
    return place
  }
  type BoxLine = { text: string, bold?: boolean, muted?: boolean }
  const jobAddressLines = (address: string) => (address ? wrap(address, bold, 9, colWidth - 16).slice(0, 3) : [])
  const jobSheetLines = (stop: Stop | undefined, address: string): BoxLine[] => {
    const lines: BoxLine[] = []
    const name = shown(stop?.contact_name) || shown(quote.full_name)
    const phone = shown(stop?.contact_phone) || shown(quote.phone)
    if (name) lines.push({ text: name, bold: true })
    if (phone) lines.push({ text: phone, bold: true })
    jobAddressLines(address).forEach((line) => lines.push({ text: line, bold: true }))
    const access = accessLine(stop)
    if (access) lines.push({ text: access, bold: true })
    return lines
  }
  const leftJobLines = jobSheetLines(pickup, collection)
  const rightJobLines = jobSheetLines(delivery, dropoff)
  const boxHeight = Math.max(58, 22 + Math.max(leftJobLines.length, rightJobLines.length, 1) * 12 + 8)
  room(boxHeight + 20)
  const drawJobAddressBox = (title: string, lines: BoxLine[], x: number) => {
    page.drawRectangle({ x, y: y - boxHeight, width: colWidth, height: boxHeight, color: SOFT, borderColor: LINE, borderWidth: 0.7 })
    page.drawText(title, { x: x + 8, y: y - 13, size: 7.5, font: bold, color: BLUE })
    lines.forEach((line, index) => {
      page.drawText(safe(line.text), {
        x: x + 8,
        y: y - 26 - index * 12,
        size: 9,
        font: line.bold ? bold : font,
        color: TEXT,
      })
    })
  }
  drawJobAddressBox('COLLECTION', leftJobLines, MARGIN)
  drawJobAddressBox('DELIVERY', rightJobLines, MARGIN + colWidth + colGap)
  y -= boxHeight + 16

  const drawServiceHeader = () => {
    room(36)
    page.drawText('SERVICE', { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    if (jobSheet) {
      page.drawText('MOVE DETAILS', { x: MARGIN + colWidth + colGap, y, size: 8, font: bold, color: MUTED })
    } else {
      page.drawText('AMOUNT', { x: MARGIN + width - bold.widthOfTextAtSize('AMOUNT', 8), y, size: 8, font: bold, color: MUTED })
    }
    y -= 6
    rule(y)
    y -= 14
  }
  drawServiceHeader()
  const serviceLines = wrap(serviceLine, bold, 9.5, jobSheet ? colWidth : width - 90)
  const arrival = arrivalWindow(quote.arrival_window)
  const moveWhen = jobSheet ? [safe(quote.move_date_label), arrival ? `Arrival time: ${arrival}` : ''].filter(Boolean) : []
  const rowCount = Math.max(serviceLines.length, moveWhen.length, 1)
  for (let index = 0; index < rowCount; index += 1) {
    if (serviceLines[index]) {
      page.drawText(serviceLines[index], { x: MARGIN, y, size: 9.5, font: bold, color: TEXT })
    }
    if (jobSheet && moveWhen[index]) {
      page.drawText(moveWhen[index], { x: MARGIN + colWidth + colGap, y, size: 9.5, font: bold, color: TEXT })
    }
    if (!jobSheet && index === 0) {
      const amount = money(total)
      page.drawText(amount, { x: MARGIN + width - font.widthOfTextAtSize(amount, 9.5), y, size: 9.5, font, color: TEXT })
    }
    y -= 13
  }
  y -= 8

  const inventoryColumns = inventory.length > 6 ? 3 : 1
  const inventoryGap = 16
  const inventoryColWidth = (width - inventoryGap * (inventoryColumns - 1)) / inventoryColumns
  const drawInventoryHeader = () => {
    room(34)
    page.drawText('INVENTORY', { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    for (let column = 0; column < inventoryColumns; column += 1) {
      const qtyTitle = 'QTY'
      const x = MARGIN + column * (inventoryColWidth + inventoryGap) + inventoryColWidth - bold.widthOfTextAtSize(qtyTitle, 8)
      page.drawText(qtyTitle, { x, y, size: 8, font: bold, color: MUTED })
    }
    y -= 6
    rule(y)
    y -= 13
  }
  if (inventory.length) {
    drawInventoryHeader()
    for (let index = 0; index < inventory.length; index += inventoryColumns) {
      const row = inventory.slice(index, index + inventoryColumns).map((item) => ({
        item,
        lines: wrap(item.name, font, 8.5, inventoryColWidth - 28),
        noteLines: item.note ? wrap(item.note, font, 7.5, inventoryColWidth - 28) : [],
      }))
      const rowHeight = Math.max(...row.map((cell) => Math.max(cell.lines.length, 1) * 11 + cell.noteLines.length * 10)) + 5
      if (y - rowHeight < 120) {
        newPage()
        drawInventoryHeader()
      }
      row.forEach((cell, column) => {
        const x = MARGIN + column * (inventoryColWidth + inventoryGap)
        cell.lines.forEach((line, lineIndex) => {
          page.drawText(line, { x, y: y - lineIndex * 11, size: 8.5, font, color: TEXT })
        })
        cell.noteLines.forEach((line, lineIndex) => {
          page.drawText(line, { x, y: y - cell.lines.length * 11 - lineIndex * 10, size: 7.5, font, color: MUTED })
        })
        const qty = String(cell.item.quantity)
        page.drawText(qty, {
          x: x + inventoryColWidth - font.widthOfTextAtSize(qty, 8.5),
          y,
          size: 8.5,
          font,
          color: TEXT,
        })
      })
      y -= rowHeight
    }
    y -= 2
    page.drawText(`Total items: ${itemCount}`, { x: MARGIN, y, size: 8.5, font: bold, color: TEXT })
    y -= 16
  }

  const drawWrappedBlock = (title: string, lines: string[]) => {
    const wrapped = lines.flatMap((line) => wrap(line, font, 8.5, width))
    if (!wrapped.length) return
    room(24)
    page.drawText(title, { x: MARGIN, y, size: 8, font: bold, color: MUTED })
    y -= 12
    for (const line of wrapped) {
      if (y < 130) newPage()
      page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: TEXT })
      y -= 11
    }
    y -= 6
  }
  drawWrappedBlock('SPECIAL INSTRUCTIONS', documentNotes.instructions)
  drawWrappedBlock('NOTES', documentNotes.notes)

  const summaryRows = [
    ['Invoice total', money(total)],
    ['Amount paid', money(paid)],
    ['Balance due', money(remaining)],
  ]
  if (!jobSheet) {
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
  }

  const footerLines = [
    legalName,
    companyAddress,
    `Company number ${companyNumber}`,
    vatNumber ? `VAT number ${vatNumber}` : '',
    `${phone}  |  ${website}  |  ${email}`,
    termsUrl,
  ].filter(Boolean)
  const notePad = 14
  const noteLines = wrap(
    'You can track your move online in My account, and you can update your booking there before moving day. Sign in at www.shiftmyhome.co.uk with the email address on this invoice.',
    font,
    8.5,
    width - notePad * 2,
  )
  const noteBoxHeight = 14 + 12 + 8 + noteLines.length * 12 + 12
  const footerClearance = 36 + footerLines.length * 9 + 18
  if (y - 10 - noteBoxHeight < footerClearance) newPage()
  y -= 10
  const boxBottom = y - noteBoxHeight
  page.drawRectangle({
    x: MARGIN + 2.5,
    y: boxBottom - 2.5,
    width,
    height: noteBoxHeight,
    color: BLUE_SHADOW,
  })
  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width,
    height: noteBoxHeight,
    color: BLUE_SOFT,
    borderColor: BLUE_LINE,
    borderWidth: 0.8,
  })
  page.drawRectangle({ x: MARGIN, y: boxBottom, width: 3.5, height: noteBoxHeight, color: BLUE })
  page.drawText('Thank you for choosing ShiftMyHome.', {
    x: MARGIN + notePad,
    y: y - 16,
    size: 9,
    font: bold,
    color: NAVY,
  })
  noteLines.forEach((line, index) => {
    page.drawText(line, { x: MARGIN + notePad, y: y - 32 - index * 12, size: 8.5, font, color: TEXT })
  })
  y = boxBottom - 12
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

  if (jobSheet) {
    page = pdf.addPage(PAGE)
    y = PAGE[1] - MARGIN
    if (logo) {
      const logoHeight = 32
      const logoWidth = Math.min(160, (logo.width / logo.height) * logoHeight)
      page.drawImage(logo, { x: MARGIN, y: y - logoHeight, width: logoWidth, height: logoHeight })
    }
    const sheetRef = `Booking reference: ${safe(input.quoteRef)}`
    page.drawText(sheetRef, {
      x: MARGIN + width - font.widthOfTextAtSize(sheetRef, 8),
      y: y - 12,
      size: 8,
      font,
      color: MUTED,
    })
    y -= 48
    page.drawText('Check in / check out', { x: MARGIN, y, size: 13, font: bold, color: NAVY })
    y -= 18
    page.drawText('Please state the overall condition of the furniture:', { x: MARGIN, y, size: 9, font, color: TEXT })
    y -= 16
    const choices = ['Brand new', 'Good condition', 'Average condition', 'Poor condition']
    choices.forEach((choice, index) => {
      const x = MARGIN + (index % 2) * (colWidth + colGap)
      const row = Math.floor(index / 2)
      page.drawRectangle({ x, y: y - row * 16 - 1, width: 9, height: 9, borderColor: TEXT, borderWidth: 0.8 })
      page.drawText(choice, { x: x + 14, y: y - row * 16, size: 9, font, color: TEXT })
    })
    y -= 40
    page.drawText('Please list any existing damage:', { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    y -= 8
    page.drawRectangle({ x: MARGIN, y: y - 52, width, height: 52, borderColor: LINE, borderWidth: 0.8 })
    y -= 66
    page.drawText('Driver sign off:', { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    y -= 8
    page.drawRectangle({ x: MARGIN, y: y - 36, width: 240, height: 36, borderColor: LINE, borderWidth: 0.8 })
    y -= 52
    page.drawText('Furniture collected at:', { x: MARGIN, y, size: 9, font, color: TEXT })
    page.drawLine({ start: { x: MARGIN + 130, y: y - 2 }, end: { x: MARGIN + 320, y: y - 2 }, thickness: 0.7, color: LINE })
    y -= 18
    page.drawText('Furniture delivered at:', { x: MARGIN, y, size: 9, font, color: TEXT })
    page.drawLine({ start: { x: MARGIN + 130, y: y - 2 }, end: { x: MARGIN + 320, y: y - 2 }, thickness: 0.7, color: LINE })
    y -= 22
    page.drawText('On arrival - goods received in the same condition:', { x: MARGIN, y, size: 9, font, color: TEXT })
    y -= 16
    ;['Yes', 'No'].forEach((choice, index) => {
      const x = MARGIN + index * 70
      page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderColor: TEXT, borderWidth: 0.8 })
      page.drawText(choice, { x: x + 14, y, size: 9, font, color: TEXT })
    })
    y -= 24
    page.drawText('Customer sign off:', { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    y -= 13
    const confirm = wrap('By signing here, I confirm the goods were delivered in the same condition as they were collected.', font, 8.5, width)
    confirm.forEach((line) => {
      page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: TEXT })
      y -= 11
    })
    y -= 4
    page.drawRectangle({ x: MARGIN, y: y - 36, width: 240, height: 36, borderColor: LINE, borderWidth: 0.8 })
    y -= 52
    if (status === 'PAID') {
      page.drawText('Customer has paid in full.', { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    } else if (status === 'PARTIALLY PAID') {
      page.drawText(`Balance due: ${money(remaining)}`, { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    } else {
      page.drawText(`Balance due: ${money(remaining)}`, { x: MARGIN, y, size: 9, font: bold, color: TEXT })
    }
    page.drawLine({
      start: { x: MARGIN, y: 32 },
      end: { x: MARGIN + width, y: 32 },
      thickness: 0.6,
      color: LINE,
    })
    page.drawText(`${legalName}  ·  ${phone}  ·  ${website}`, { x: MARGIN, y: 18, size: 7.5, font, color: MUTED })
  }

  return pdf.save()
}
