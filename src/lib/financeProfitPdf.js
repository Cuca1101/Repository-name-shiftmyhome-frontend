import { jsPDF } from 'jspdf'
import { formatDateTimeUK } from './formatDateDisplay'
import {
  assertFinanceUnlocked,
  driverDayProfitPence,
  filterFinanceRange,
  financePdfFilename,
  formatDeductionPercent,
  formatGbp,
  formatIsoShort,
  formatMonthYear,
  isCurrentLondonMonth,
  monthBounds,
  profitTone,
  rowAttendance,
  summarizeFinance,
  toPence,
  weeklyAttendance,
} from './financeProfit'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN_X = 12
const MARGIN_TOP = 16
const MARGIN_BOTTOM = 14
const CONTENT_W = PAGE_W - MARGIN_X * 2

let fontBase64 = ''

export function setFinancePdfFontBase64(value) {
  fontBase64 = String(value || '')
}

export function financePdfFontReady() {
  return fontBase64.length > 0
}

function useFont(pdf) {
  if (!fontBase64) throw new Error('The PDF font is not loaded yet.')
  if (!pdf.__financeFont) {
    pdf.addFileToVFS('Roboto-Regular.ttf', fontBase64)
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    pdf.__financeFont = true
  }
  pdf.setFont('Roboto', 'normal')
}

function lineStep(size) {
  return size * 0.5
}

function drawRunningHeader(pdf, monthLabel, inProgress) {
  useFont(pdf)
  pdf.setFontSize(9)
  pdf.setTextColor(15, 23, 42)
  pdf.text('ShiftMyHome', MARGIN_X, 8)
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  pdf.text(monthLabel, MARGIN_X + pdf.getTextWidth('ShiftMyHome') + 3, 8)
  if (inProgress) {
    const mark = 'Month in progress'
    pdf.setTextColor(180, 83, 9)
    const width = pdf.getTextWidth(mark)
    pdf.text(mark, PAGE_W - MARGIN_X - width - 28, 8)
  }
  pdf.setDrawColor(226, 232, 240)
  pdf.line(MARGIN_X, 11, PAGE_W - MARGIN_X, 11)
}

function createWriter(pdf, monthLabel, inProgress, drawn) {
  const state = { y: MARGIN_TOP }
  const record = (text) => {
    const value = Array.isArray(text) ? text.join('\n') : String(text)
    drawn.push(value)
  }
  const text = (value, x, y) => {
    record(value)
    pdf.text(value, x, y)
  }
  const newPage = () => {
    pdf.addPage()
    drawRunningHeader(pdf, monthLabel, inProgress)
    state.y = MARGIN_TOP
  }
  const need = (height) => {
    if (state.y + height > PAGE_H - MARGIN_BOTTOM) newPage()
  }
  return { state, text, newPage, need, record }
}

function writeParagraph(pdf, writer, value, size, color) {
  useFont(pdf)
  pdf.setFontSize(size)
  pdf.setTextColor(...color)
  const lines = pdf.splitTextToSize(value, CONTENT_W)
  for (const line of lines) {
    writer.need(lineStep(size) + 1)
    writer.text(line, MARGIN_X, writer.state.y)
    writer.state.y += lineStep(size)
  }
  writer.state.y += 1.5
}

function writeHeading(pdf, writer, value) {
  writer.state.y += 2
  writeParagraph(pdf, writer, value, 12, [15, 23, 42])
}

function drawTable(pdf, writer, columns, rows, options = {}) {
  useFont(pdf)
  const headerHeight = 7
  const drawHeader = () => {
    writer.need(headerHeight + 4)
    pdf.setFillColor(241, 245, 249)
    pdf.rect(MARGIN_X, writer.state.y, CONTENT_W, headerHeight, 'F')
    pdf.setFontSize(8)
    pdf.setTextColor(71, 85, 105)
    let x = MARGIN_X
    for (const column of columns) {
      const label = column.label
      writer.record(label)
      const width = pdf.getTextWidth(label)
      const tx = column.align === 'right' ? x + column.width - 1.6 - width : x + 1.6
      pdf.text(label, tx, writer.state.y + 4.6)
      x += column.width
    }
    writer.state.y += headerHeight
  }

  drawHeader()
  if (!rows.length) {
    writeParagraph(pdf, writer, options.empty || 'None recorded.', 9, [100, 116, 139])
    return
  }

  rows.forEach((row, index) => {
    pdf.setFontSize(8)
    const cells = columns.map((column) => {
      const raw = String(row[column.key] ?? '')
      return pdf.splitTextToSize(raw || '—', Math.max(8, column.width - 3.2))
    })
    const lineCount = Math.max(...cells.map((lines) => lines.length), 1)
    const rowHeight = Math.max(6.2, lineCount * 3.7 + 2.2)
    if (writer.state.y + rowHeight > PAGE_H - MARGIN_BOTTOM) {
      writer.newPage()
      drawHeader()
    }
    if (index % 2 === 1) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(MARGIN_X, writer.state.y, CONTENT_W, rowHeight, 'F')
    }
    let x = MARGIN_X
    columns.forEach((column, columnIndex) => {
      const tone =
        column.key === 'profit' || (column.colorProfit && row.profitPence != null)
          ? profitTone(row.profitPence || 0)
          : ''
      if (tone === 'profit') pdf.setTextColor(4, 120, 87)
      else if (tone === 'loss') pdf.setTextColor(185, 28, 28)
      else pdf.setTextColor(15, 23, 42)
      pdf.setFontSize(8)
      cells[columnIndex].forEach((line, lineIndex) => {
        writer.record(line)
        let size = 8
        pdf.setFontSize(size)
        while (size > 6 && pdf.getTextWidth(line) > column.width - 2.2) {
          size -= 0.5
          pdf.setFontSize(size)
        }
        const width = pdf.getTextWidth(line)
        const tx = column.align === 'right' ? x + column.width - 1.6 - width : x + 1.6
        pdf.text(line, tx, writer.state.y + 4.2 + lineIndex * 3.7)
        pdf.setFontSize(8)
      })
      x += column.width
    })
    writer.state.y += rowHeight
    pdf.setDrawColor(226, 232, 240)
    pdf.line(MARGIN_X, writer.state.y, MARGIN_X + CONTENT_W, writer.state.y)
  })
  writer.state.y += 2
}

function moneyRows(items, labelKey = 'name') {
  return items.map((item) => ({
    label: item[labelKey],
    amount: formatGbp(item.amount),
  }))
}

/**
 * @param {{
 *   token: string,
 *   year: number,
 *   month: number,
 *   generatedAt?: string | Date,
 *   incomes?: object[],
 *   expenses?: object[],
 *   categories?: object[],
 * }} report
 */
export function renderFinanceMonthPdf(report) {
  assertFinanceUnlocked(report?.token)
  const year = Number(report.year)
  const month = Number(report.month)
  const bounds = monthBounds(year, month)
  const scoped = filterFinanceRange(report, bounds.from, bounds.to)
  const summary = summarizeFinance(scoped)
  const monthLabel = formatMonthYear(year, month)
  const inProgress = isCurrentLondonMonth(year, month, report.generatedAt ? new Date(report.generatedAt) : new Date())
  const filename = financePdfFilename(year, month)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: false })
  pdf.setProperties({
    title: `ShiftMyHome Finance ${filename.slice('ShiftMyHome_Finance_'.length, -4)}`,
    author: 'ShiftMyHome',
    subject: 'Manual finance records and the amount remaining after the percentage deduction',
  })
  const drawn = []
  drawRunningHeader(pdf, monthLabel, inProgress)
  const writer = createWriter(pdf, monthLabel, inProgress, drawn)

  writeParagraph(pdf, writer, 'ShiftMyHome', 16, [15, 23, 42])
  writeParagraph(pdf, writer, `Finance & Profit — ${monthLabel}`, 13, [15, 23, 42])
  if (inProgress) writeParagraph(pdf, writer, 'Month in progress', 11, [180, 83, 9])
  writeParagraph(
    pdf,
    writer,
    `Generated ${formatDateTimeUK(report.generatedAt || new Date().toISOString())} (Europe/London).`,
    9,
    [71, 85, 105],
  )
  writeParagraph(
    pdf,
    writer,
    'Manual records entered in Finance & Profit. Income, salaries, diesel and other expenses are not imported from bookings, jobs, payments or driver accounts. The percentage is applied once to this month.',
    9,
    [71, 85, 105],
  )

  const percentLabel = formatDeductionPercent(summary.deductionPercent)
  writeHeading(pdf, writer, 'Monthly summary')
  drawTable(
    pdf,
    writer,
    [
      { key: 'label', label: 'Item', width: 130 },
      { key: 'amount', label: 'Amount', width: 56, align: 'right', colorProfit: true },
    ],
    [
      { label: 'Total income', amount: formatGbp(summary.income) },
      { label: 'Total salaries', amount: formatGbp(summary.salaries) },
      { label: 'Total diesel', amount: formatGbp(summary.diesel) },
      { label: 'Total other expenses', amount: formatGbp(summary.other) },
      { label: 'Total expenses', amount: formatGbp(summary.expenses) },
      {
        label: 'Profit before deduction',
        amount: formatGbp(summary.profit),
        profitPence: summary.profit,
      },
      { label: `Deduction (${percentLabel})`, amount: formatGbp(summary.deduction) },
      {
        label: 'Final amount remaining',
        amount: formatGbp(summary.finalAmount),
        profitPence: summary.finalAmount,
      },
    ],
  )
  writeParagraph(
    pdf,
    writer,
    `${formatGbp(summary.income)} − ${formatGbp(summary.salaries)} − ${formatGbp(summary.diesel)} − ${formatGbp(summary.other)} = ${formatGbp(summary.profit)}. Deduction ${percentLabel} = ${formatGbp(summary.deduction)}. Final amount remaining ${formatGbp(summary.finalAmount)}.`,
    9,
    [15, 23, 42],
  )

  writeHeading(pdf, writer, 'Income by source')
  drawTable(
    pdf,
    writer,
    [
      { key: 'label', label: 'Source', width: 130 },
      { key: 'amount', label: 'Amount', width: 56, align: 'right' },
    ],
    moneyRows(summary.sources),
    { empty: 'No income recorded this month.' },
  )

  writeHeading(pdf, writer, 'Salaries by driver')
  drawTable(
    pdf,
    writer,
    [
      { key: 'label', label: 'Driver', width: 130 },
      { key: 'amount', label: 'Amount', width: 56, align: 'right' },
    ],
    moneyRows(summary.salariesByDriver),
    { empty: 'No salaries recorded this month.' },
  )

  writeHeading(pdf, writer, 'Other expenses by category')
  drawTable(
    pdf,
    writer,
    [
      { key: 'label', label: 'Category', width: 130 },
      { key: 'amount', label: 'Amount', width: 56, align: 'right' },
    ],
    moneyRows(summary.otherCategories),
    { empty: 'No other expenses recorded this month.' },
  )

  writeHeading(pdf, writer, 'Daily totals')
  drawTable(
    pdf,
    writer,
    [
      { key: 'date', label: 'Date', width: 24 },
      { key: 'drivers', label: 'Drivers', width: 18, align: 'right' },
      { key: 'income', label: 'Income', width: 24, align: 'right' },
      { key: 'salaries', label: 'Salaries', width: 24, align: 'right' },
      { key: 'diesel', label: 'Diesel', width: 22, align: 'right' },
      { key: 'other', label: 'Other', width: 22, align: 'right' },
      { key: 'expenses', label: 'Expenses', width: 26, align: 'right' },
      { key: 'profit', label: 'Profit', width: 26, align: 'right' },
    ],
    summary.daily.map((day) => ({
      date: formatIsoShort(day.date),
      drivers: String(day.drivers || 0),
      income: formatGbp(day.income),
      salaries: formatGbp(day.salaries),
      diesel: formatGbp(day.diesel),
      other: formatGbp(day.other),
      expenses: formatGbp(day.totalExpenses),
      profit: formatGbp(day.profit),
      profitPence: day.profit,
    })),
    { empty: 'No daily records this month.' },
  )

  const driverRows = [...(scoped.driverDays || [])].sort((left, right) => {
    const byDate = String(left.activity_date).localeCompare(String(right.activity_date))
    if (byDate !== 0) return byDate
    return String(left.driver_name || '').localeCompare(String(right.driver_name || ''), 'en-GB')
  })
  writeHeading(pdf, writer, 'Driver records')
  drawTable(
    pdf,
    writer,
    [
      { key: 'date', label: 'Date', width: 18 },
      { key: 'driver', label: 'Driver', width: 22 },
      { key: 'source', label: 'Source', width: 22 },
      { key: 'income', label: 'Income', width: 18, align: 'right' },
      { key: 'another', label: 'Another income', width: 18, align: 'right' },
      { key: 'salary', label: 'Salary', width: 16, align: 'right' },
      { key: 'diesel', label: 'Diesel', width: 16, align: 'right' },
      { key: 'other', label: 'Other', width: 16, align: 'right' },
      { key: 'note', label: 'Other detail', width: 22 },
      { key: 'profit', label: 'Profit', width: 18, align: 'right' },
    ],
    driverRows.map((row) => {
      const profit = driverDayProfitPence(row)
      return {
        date: formatIsoShort(row.activity_date),
        driver: row.driver_name || '—',
        source: row.source_name || '—',
        income: formatGbp(toPence(row.income_gbp)),
        another: formatGbp(toPence(row.another_income_gbp)),
        salary: formatGbp(toPence(row.salary_gbp)),
        diesel: formatGbp(toPence(row.diesel_gbp)),
        other: formatGbp(toPence(row.other_gbp)),
        note: row.other_description || '—',
        profit: formatGbp(profit),
        profitPence: profit,
      }
    }),
    { empty: 'No driver records this month.' },
  )

  const attendance = weeklyAttendance(
    { drivers: report.drivers || [], driverDays: scoped.driverDays || [] },
    bounds.from,
    bounds.to,
  )
  const attendanceRows = attendance.rows.filter((row) => row.daysWorked > 0 || row.daysAbsent > 0)
  writeHeading(pdf, writer, 'Attendance')
  writeParagraph(
    pdf,
    writer,
    'Days worked counts dates marked Worked in this month. Not set stays unrecorded and is not treated as Did not work. Attendance is kept separately for each driver and date.',
    9,
    [71, 85, 105],
  )
  drawTable(
    pdf,
    writer,
    [
      { key: 'driver', label: 'Driver', width: 110 },
      { key: 'worked', label: 'Days worked', width: 38, align: 'right' },
      { key: 'absent', label: 'Did not work', width: 38, align: 'right' },
    ],
    attendanceRows.map((row) => ({
      driver: row.archived ? `${row.name} (archived)` : row.name,
      worked: String(row.daysWorked),
      absent: String(row.daysAbsent),
    })),
    { empty: 'No attendance recorded this month.' },
  )
  const attendanceDetail = [...(scoped.driverDays || [])]
    .map((row) => ({ row, status: rowAttendance(row, { stored: true }) }))
    .filter((item) => item.status === 'worked' || item.status === 'absent')
    .sort((left, right) => {
      const byDate = String(left.row.activity_date).localeCompare(String(right.row.activity_date))
      if (byDate !== 0) return byDate
      return String(left.row.driver_name || '').localeCompare(String(right.row.driver_name || ''), 'en-GB')
    })
  drawTable(
    pdf,
    writer,
    [
      { key: 'date', label: 'Date', width: 28 },
      { key: 'driver', label: 'Driver', width: 90 },
      { key: 'status', label: 'Attendance', width: 68 },
    ],
    attendanceDetail.map((item) => ({
      date: formatIsoShort(item.row.activity_date),
      driver: item.row.driver_name || '—',
      status: item.status === 'absent' ? 'Did not work' : 'Worked',
    })),
    { empty: 'No worked or did-not-work days this month.' },
  )

  writeHeading(pdf, writer, 'Additional income')
  drawTable(
    pdf,
    writer,
    [
      { key: 'date', label: 'Date', width: 24 },
      { key: 'source', label: 'Source', width: 50 },
      { key: 'description', label: 'Description', width: 76 },
      { key: 'amount', label: 'Amount', width: 36, align: 'right' },
    ],
    [...scoped.incomes]
      .sort((left, right) => String(left.activity_date).localeCompare(String(right.activity_date)))
      .map((row) => ({
        date: formatIsoShort(row.activity_date),
        source: row.source_name || '—',
        description: row.description || '—',
        amount: formatGbp(toPence(row.amount_gbp)),
      })),
    { empty: 'No additional income this month.' },
  )

  writeHeading(pdf, writer, 'Additional expenses')
  drawTable(
    pdf,
    writer,
    [
      { key: 'date', label: 'Date', width: 24 },
      { key: 'category', label: 'Category', width: 40 },
      { key: 'description', label: 'Description', width: 86 },
      { key: 'amount', label: 'Amount', width: 36, align: 'right' },
    ],
    [...scoped.expenses]
      .sort((left, right) => String(left.expense_date).localeCompare(String(right.expense_date)))
      .map((row) => ({
        date: formatIsoShort(row.expense_date),
        category: row.category_name || 'Expense',
        description: [row.description, row.payee_name].filter(Boolean).join(' · ') || '—',
        amount: formatGbp(toPence(row.amount_gbp)),
      })),
    { empty: 'No additional expenses this month.' },
  )

  writeParagraph(
    pdf,
    writer,
    'Each driver record, additional income entry and additional expense is counted once. Salaries, diesel and other expenses are not added again when the month is totalled. The percentage is applied once to the month profit after expenses. A loss has a deduction of £0.00.',
    8,
    [100, 116, 139],
  )

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    useFont(pdf)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    const pageLabel = `Page ${page} of ${pageCount}`
    drawn.push(pageLabel)
    pdf.text(pageLabel, PAGE_W - MARGIN_X - pdf.getTextWidth(pageLabel), 8)
    const footer = 'Manual records. The percentage is applied once to this month.'
    drawn.push(footer)
    pdf.text(footer, MARGIN_X, PAGE_H - 6)
  }

  return {
    filename,
    bytes: pdf.output('arraybuffer'),
    drawn,
    summary,
  }
}

export function downloadFinanceMonthPdf(report) {
  const rendered = renderFinanceMonthPdf(report)
  const blob = new Blob([rendered.bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = rendered.filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return rendered.filename
}
