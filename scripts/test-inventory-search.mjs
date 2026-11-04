/**
 * Inventory search: partial words, plurals, and the same ranking everywhere.
 * Run: node scripts/test-inventory-search.mjs
 */
import { getFlattenedCatalogEntries } from '../src/components/quote-wizard/inventoryCatalog.js'
import { filterAndSortInventorySearchResults } from '../src/components/quote-wizard/inventorySearchUtils.js'

const entries = getFlattenedCatalogEntries()

function names(query) {
  return filterAndSortInventorySearchResults(entries, query).map((entry) => entry.item.name)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const beds = names('bed')
const requiredBeds = [
  'Single bed & mattress',
  'Double bed & mattress',
  'King size bed & mattress',
  'Small double bed & mattress',
  'Small double bed frame',
  'Bunk bed',
  'Sofa bed',
]
for (const name of requiredBeds) {
  assert(beds.includes(name), `bed search missed ${name}`)
}
assert(beds.indexOf('Single bed & mattress') < beds.indexOf('Bedside table'), 'a whole-word bed ranks before Bedside table')
assert(beds.indexOf('Single bed & mattress') < beds.indexOf('Headboard'), 'a whole-word bed ranks before a synonym-only item')
assert(!beds.some((name) => /rocking/i.test(name)), 'bed search included rocking')

const sofas = names('sofa')
for (const name of ['2-seater sofa', '3-seater sofa', '4-seater sofa', 'Corner sofa', 'Sofa bed']) {
  assert(sofas.includes(name), `sofa search missed ${name}`)
}
const couches = names('couch')
assert(couches.includes('Corner sofa'), 'couch did not include the corner sofa')
assert(names('sofas').length === sofas.length, 'plural sofa search differs')

const kings = names('king')
assert(kings.includes('King size bed & mattress'), 'king missed the king size bed')
assert(!kings.some((name) => /rocking/i.test(name)), `king search included rocking: ${kings.join(', ')}`)
assert(names('KING').includes('King size bed & mattress'), 'search is case-sensitive')
assert(names('kingsize').includes('King size bed (frame only)'), 'joined spelling kingsize missed the frame')
assert(names('matress').includes('Double mattress'), 'matress spelling missed mattresses')

console.log('inventory search checks passed')
console.log('bed:', beds.join(' | '))
console.log('sofa:', sofas.join(' | '))
console.log('king:', kings.join(' | '))
