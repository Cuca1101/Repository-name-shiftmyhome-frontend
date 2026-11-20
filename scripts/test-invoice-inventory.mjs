import { canonicalInvoiceInventory, customerInvoiceNotes, isInternalPricingLine, totalItemQuantity } from '../supabase/functions/_shared/invoiceInventory.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

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

const text = inventory
  .map((row) => `  • ${row.name} [${row.category}] ×${row.quantity}  (~1 m³ line vol, medium)`)
  .join('\n')

const rows = canonicalInvoiceInventory({ inventory, inventoryText: text })
assert(rows.length === 14, 'the text copy is not added on top of the saved inventory')
assert(totalItemQuantity(rows) === 16, 'total items is the sum of quantities')
assert(!rows.some((row) => row.name.includes('[')), 'category brackets are not part of the item name')
assert(rows.filter((row) => row.name.startsWith('Moving box')).length === 2, 'two different boxes stay as two rows')
assert(rows.find((row) => row.name.startsWith('Moving box (Extra Large)')).quantity === 1, 'the extra large box keeps quantity 1')
assert(rows.find((row) => row.name === 'Moving box (medium)').quantity === 2, 'the medium box keeps quantity 2')

const textOnly = canonicalInvoiceInventory({ inventoryText: text })
assert(textOnly.length === 14 && totalItemQuantity(textOnly) === 16, 'text is used only when there is no structured inventory')

assert(isInternalPricingLine('Best price (Monday, 5%): -£8.86'), 'a best-price calculator line is not an invoice note')
assert(
  customerInvoiceNotes(['Best price (Monday, 5%): -£8.86', 'Parking bay reserved']).join('|') === 'Parking bay reserved',
  'calculator lines are dropped and a real access note stays',
)

console.log('invoice inventory checks passed')
