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

mkdirSync('.tmp-invoice-proof', { recursive: true })
const out = '.tmp-invoice-proof/SMH-2026-304234.pdf'
const stripeOut = '.tmp-invoice-proof/SMH-2026-248398.pdf'
writeFileSync(out, bytes)
writeFileSync(stripeOut, stripeBytes)
console.log(out, bytes.length)
console.log(stripeOut, stripeBytes.length)
