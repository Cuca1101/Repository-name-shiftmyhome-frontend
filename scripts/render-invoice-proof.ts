import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { renderInvoicePdf } from '../supabase/functions/_shared/invoicePdfDraw.ts'

const inventory = [
  { name: '3-seater sofa', category: 'Living areas', quantity: 1 },
  { name: 'Table ', category: 'Kitchen & dining', quantity: 1 },
  { name: 'TV 40 inch', category: 'Electronics', quantity: 1 },
  { name: 'TV unit', category: 'Living areas', quantity: 1 },
  { name: 'Glass coffee table', category: 'Bedrooms', quantity: 1 },
  { name: 'Dining table ', category: 'Kitchen & dining', quantity: 1 },
  { name: 'Dining chair', category: 'Kitchen & dining', quantity: 1 },
  { name: 'Bedside table', category: 'Bedrooms', quantity: 1 },
  { name: 'Extra large box — duvets and pillows', category: 'Boxes & storage', quantity: 1 },
  { name: 'Moving box ( Extra Large )', category: 'Boxes & storage', quantity: 1 },
  { name: 'Bedside lamp', category: 'Bedrooms', quantity: 1 },
  { name: 'Headboard', category: 'Bedrooms', quantity: 1 },
  { name: 'Double bed frame', category: 'Bedrooms', quantity: 2 },
  { name: 'Moving box (medium)', category: 'Boxes & storage', quantity: 2 },
]

const logo = new Uint8Array(readFileSync('public/email-logo.png'))
const bytes = await renderInvoicePdf({
  quote: {
    full_name: 'Jakky welsh',
    email: 'jakkywelsh@gmail.com',
    phone: '07808 216159',
    move_date_label: '16 November 2026',
    service: 'Man with Van',
    service_type: 'Man with Van',
    crew_size: 2,
    arrival_window: 'Flexible window · 10:00–17:00',
    pickup_address: '1 Greenacres, Kingseat, Dunfermline KY12 0RW',
    delivery_address: '116 Lochgelly Road, Cowdenbeath KY4 9HD',
    inventory,
    issued_on_label: '20 November 2026',
    paid_on_label: '16 November 2026, 21:28',
    agreed_price: 170,
  },
  quoteRef: 'SMH-2026-304234',
  invoiceNumber: 'SMH-INV-SMH-2026-304234',
  amountPaidGbp: 170,
  invoiceTotalGbp: 170,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Cash',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const stripeBytes = await renderInvoicePdf({
  quote: {
    full_name: 'Tarik',
    email: 'b.tarik1969@yahoo.co.uk',
    phone: '+44 7456 642996',
    move_date_label: '16 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–10:00',
    pickup_address: '53 Loudoun Road, Newmilns KA16 9HG',
    delivery_address: '1 Rowan Road, Aberdeen AB16 5EA',
    inventory: [
      { name: 'Fridge freezer', quantity: 1 },
      { name: 'Shelving unit', quantity: 2 },
      { name: 'Console table', quantity: 1 },
      { name: 'Single wardrobe', quantity: 1 },
      { name: 'Medium box', quantity: 19 },
      { name: 'Suitcase / bag', quantity: 3 },
    ],
    issued_on_label: '20 November 2026',
    paid_on_label: '16 November 2026, 16:12',
    estimated_total: 471.56,
  },
  stops: [
    { stop_type: 'pickup', address_line_1: '53 Loudoun Road, Newmilns KA16 9HG', floor: '0', lift_available: false, parking_type: 'Standard street parking' },
    { stop_type: 'delivery', address_line_1: '1 Rowan Road, Aberdeen AB16 5EA', floor: '3', lift_available: true, parking_type: 'Standard street parking' },
  ],
  quoteRef: 'SMH-2026-248398',
  invoiceNumber: 'SMH-INV-SMH-2026-248398',
  amountPaidGbp: 471.56,
  invoiceTotalGbp: 471.56,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Card',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const reservationBytes = await renderInvoicePdf({
  quote: {
    full_name: 'Sample customer',
    email: 'sample@example.com',
    phone: '07000 000000',
    move_date_label: '28 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–10:00',
    pickup_address: '12 Example Street, London E1 1AA',
    delivery_address: '48 Sample Road, Manchester M1 2AB',
    inventory: [
      { name: 'Double bed frame', quantity: 1 },
      { name: 'Mattress', quantity: 1 },
      { name: 'Wardrobe', quantity: 1 },
      { name: 'Medium box', quantity: 8 },
    ],
    issued_on_label: '20 November 2026',
    paid_on_label: '20 November 2026, 14:05',
  },
  quoteRef: 'SAMPLE-RESERVATION',
  invoiceNumber: 'SMH-INV-SAMPLE-RESERVATION',
  amountPaidGbp: 50,
  invoiceTotalGbp: 320,
  remainingBalanceGbp: 270,
  paymentTypeLabel: 'Deposit',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const reservationPaidBytes = await renderInvoicePdf({
  quote: {
    full_name: 'Sample customer',
    email: 'sample@example.com',
    phone: '07000 000000',
    move_date_label: '28 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–10:00',
    pickup_address: '12 Example Street, London E1 1AA',
    delivery_address: '48 Sample Road, Manchester M1 2AB',
    inventory: [
      { name: 'Double bed frame', quantity: 1 },
      { name: 'Mattress', quantity: 1 },
      { name: 'Wardrobe', quantity: 1 },
      { name: 'Medium box', quantity: 8 },
    ],
    issued_on_label: '20 November 2026',
    paid_on_label: '20 November 2026, 18:40',
  },
  quoteRef: 'SAMPLE-RESERVATION',
  invoiceNumber: 'SMH-INV-SAMPLE-RESERVATION',
  amountPaidGbp: 320,
  invoiceTotalGbp: 320,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Card',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const manyItems = [
  ['3-seater sofa', 1],
  ['Armchair', 2],
  ['Coffee table', 1],
  ['TV 55 inch', 1],
  ['TV unit', 1],
  ['Dining table', 1],
  ['Dining chair', 6],
  ['Double bed frame', 1],
  ['Double mattress', 1],
  ['Single bed frame', 1],
  ['Single mattress', 1],
  ['Wardrobe', 2],
  ['Chest of drawers', 2],
  ['Bedside table', 2],
  ['Desk', 1],
  ['Office chair', 1],
  ['Bookcase', 1],
  ['Fridge freezer', 1],
  ['Washing machine', 1],
  ['Microwave', 1],
  ['Lamp', 4],
  ['Mirror', 2],
  ['Suitcase', 3],
  ['Medium box', 18],
  ['Large box', 8],
  ['Extra large box - duvets and pillows', 2],
  ['Picture frame', 5],
  ['Garden chair', 4],
  ['Bicycle', 2],
].map(([name, quantity]) => ({ name, quantity }))

const manyBytes = await renderInvoicePdf({
  quote: {
    full_name: 'Sample customer',
    email: 'sample@example.com',
    phone: '07000 000000',
    move_date_label: '28 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–12:00',
    pickup_address: '12 Example Street, London E1 1AA',
    delivery_address: '48 Sample Road, Manchester M1 2AB',
    inventory: manyItems,
    issued_on_label: '20 November 2026',
    paid_on_label: '20 November 2026, 18:40',
  },
  quoteRef: 'SAMPLE-MANY-ITEMS',
  invoiceNumber: 'SMH-INV-SAMPLE-MANY-ITEMS',
  amountPaidGbp: 640,
  invoiceTotalGbp: 640,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Card',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const notedInventory = manyItems.map((row) =>
  row.name === 'Fridge freezer' ? { ...row, notes: 'American fridge, keep upright' } : row,
)
const bookingDetails = `— Access & carry (both ends factored in pricing) —
Stairs & access notes: Narrow staircase at collection, two flights
Heavy / bulky items notes: American fridge freezer, keep upright
Special instructions: Please call 20 minutes before arrival. The hallway is tight, so bring blankets for the furniture.

— Extra services —
Packing requested
What to pack: Kitchen and the picture frames
Fragile items: Yes
`

const jobSheetBytes = await renderInvoicePdf({
  documentKind: 'job_sheet',
  quote: {
    move_date_label: '28 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–12:00',
    pickup_address: '12 Example Street, London E1 1AA',
    delivery_address: '48 Sample Road, Manchester M1 2AB',
    inventory: notedInventory,
    details: bookingDetails,
    customer_message: 'Customer will be on site from 8am.',
    office_notes: 'Key safe code is with the neighbour at number 14.',
    issued_on_label: '20 November 2026',
    paid_on_label: '20 November 2026, 18:40',
  },
  stops: [
    { stop_type: 'pickup', contact_name: 'Sample customer', contact_phone: '07000 000000', address_line_1: '12 Example Street, London E1 1AA', floor: '0', lift_available: false },
    { stop_type: 'delivery', contact_name: 'Sample customer', contact_phone: '07800 111222', address_line_1: '48 Sample Road, Manchester M1 2AB', floor: '2', lift_available: true },
  ],
  quoteRef: 'SAMPLE-MANY-ITEMS',
  invoiceNumber: 'SMH-INV-SAMPLE-MANY-ITEMS',
  amountPaidGbp: 640,
  invoiceTotalGbp: 640,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Card',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

const invoiceNotesBytes = await renderInvoicePdf({
  quote: {
    full_name: 'Sample customer',
    email: 'sample@example.com',
    phone: '07000 000000',
    move_date_label: '28 November 2026',
    service: 'House Removals',
    service_type: 'House Removals',
    crew_size: 2,
    arrival_window: 'Flexible window · 08:00–12:00',
    pickup_address: '12 Example Street, London E1 1AA',
    delivery_address: '48 Sample Road, Manchester M1 2AB',
    inventory: notedInventory,
    details: bookingDetails,
    customer_message: 'Customer will be on site from 8am.',
    issued_on_label: '20 November 2026',
    paid_on_label: '20 November 2026, 18:40',
  },
  stops: [
    { stop_type: 'delivery', address_line_1: '48 Sample Road, Manchester M1 2AB', floor: '2', lift_available: true },
  ],
  quoteRef: 'SAMPLE-MANY-ITEMS',
  invoiceNumber: 'SMH-INV-SAMPLE-MANY-ITEMS',
  amountPaidGbp: 640,
  invoiceTotalGbp: 640,
  remainingBalanceGbp: 0,
  paymentTypeLabel: 'Card',
  logoPng: logo,
  company: {
    legalName: 'ShiftMyHome Ltd',
    address: '128 City Road, London, EC1V 2NX',
    companyNumber: '16730159',
    email: 'admin@shiftmyhome.co.uk',
    website: 'https://www.shiftmyhome.co.uk',
    termsUrl: 'https://www.shiftmyhome.co.uk/terms',
  },
})

mkdirSync('.tmp-invoice-proof', { recursive: true })
const out = '.tmp-invoice-proof/SMH-2026-304234.pdf'
const stripeOut = '.tmp-invoice-proof/SMH-2026-248398.pdf'
const reservationOut = '.tmp-invoice-proof/reservation-fee-50.pdf'
const reservationPaidOut = '.tmp-invoice-proof/reservation-fee-paid-full.pdf'
const manyOut = '.tmp-invoice-proof/inventory-many-items.pdf'
const jobSheetOut = '.tmp-invoice-proof/job-sheet.pdf'
const invoiceNotesOut = '.tmp-invoice-proof/invoice-with-notes.pdf'
writeFileSync(out, bytes)
writeFileSync(stripeOut, stripeBytes)
writeFileSync(reservationOut, reservationBytes)
writeFileSync(reservationPaidOut, reservationPaidBytes)
writeFileSync(manyOut, manyBytes)
writeFileSync(jobSheetOut, jobSheetBytes)
writeFileSync(invoiceNotesOut, invoiceNotesBytes)
console.log(out, bytes.length)
console.log(stripeOut, stripeBytes.length)
console.log(reservationOut, reservationBytes.length)
console.log(reservationPaidOut, reservationPaidBytes.length)
console.log(manyOut, manyBytes.length)
console.log(jobSheetOut, jobSheetBytes.length)
console.log(invoiceNotesOut, invoiceNotesBytes.length)
