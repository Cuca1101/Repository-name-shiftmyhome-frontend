/**
 * Customer offer snapshot hash and cheaper-date helper.
 * Run: node scripts/test-customer-offer-snapshot.mjs
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { buildCustomerOfferIdentity, hashCustomerOfferIdentity, offerNeedsNewReview } = await import(
  '../src/lib/customerOfferSnapshot.js'
)
const { findCheaperReviewDate } = await import('../src/lib/reviewDateSavings.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const wizard = {
  moveDate: '2026-10-20',
  arrivalWindow: '11:30-15:00',
  pickupAddress: '1 High Street, Glasgow',
  deliveryAddress: '2 Low Street, Glasgow',
  pickupPostcode: 'g44 4rf',
  deliveryPostcode: 'G42 8NP',
  packageTier: 'platinum',
  crewSize: 2,
  inventoryLines: [
    { name: 'Sofa', quantity: 1, m3: 1.2 },
    { name: 'Box', quantity: 4, m3: 0.1 },
  ],
  specialInstructions: 'Fragile mirror',
}
const breakdown = {
  estimatedTotal: 870.33,
  quoteBaseTotal: 630.22,
  servicePackageFee: 240.11,
  extrasTotal: 0,
  servicePackageId: 'platinum',
}

const identity = buildCustomerOfferIdentity({ wizard, breakdown, totalM3: 5 })
assert(identity.pickupPostcode === 'G44 4RF', 'postcode is normalised')
assert(identity.originalTotal === 870.33, 'offer covers the full quote')
assert(identity.packageFee === 240.11, 'package fee is stored')
assert(identity.inventory[0].name === 'Box', 'inventory is sorted')

const hashA = await hashCustomerOfferIdentity(identity)
const hashB = await hashCustomerOfferIdentity(buildCustomerOfferIdentity({ wizard, breakdown, totalM3: 5 }))
assert(hashA === hashB && hashA.length === 64, 'hash is stable')

const changed = buildCustomerOfferIdentity({
  wizard: { ...wizard, moveDate: '2026-10-21' },
  breakdown,
  totalM3: 5,
})
assert(offerNeedsNewReview(await hashCustomerOfferIdentity(changed), hashA), 'date change needs a new review')
assert(!offerNeedsNewReview(hashA, hashA), 'same snapshot stays valid')

const cheaper = findCheaperReviewDate(
  [
    { moveDate: '2026-10-20', total: 870.33 },
    { moveDate: '2026-10-19', total: 801.83 },
    { moveDate: '2026-10-18', total: 790.11, full: true },
    { moveDate: '2026-10-17', total: 900 },
  ],
  '2026-10-20',
)
assert(cheaper?.moveDate === '2026-10-19' && cheaper.save === 68.5, 'cheaper date uses comparable totals and skips full days')
assert(findCheaperReviewDate([{ moveDate: '2026-10-20', total: 100, past: true }], '2026-10-20') == null, 'past selection has no hint')

console.log('customer offer snapshot checks passed')
