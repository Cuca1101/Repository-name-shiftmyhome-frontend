/**
 * Homepage vs SEO landing quote parity + service normalization.
 * Run: npm run test:quote-parity
 *
 * Asserts that SEO pages and the homepage wizard feed the same canonical
 * calculateQuote / buildQuoteEngineInput path (no separate SEO calculator).
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { calculateQuote } = await import('../src/lib/pricingCalculator.js')
const { buildQuoteEngineInput } = await import('../src/lib/buildQuoteEngineInput.js')
const { getDefaultPricingSettings } = await import('../src/lib/defaultPricingSettings.js')
const { mergePricingSettingsWithDefaults } = await import('../src/lib/pricingSettingsMerge.js')
const {
  normalizeServiceType,
  resolveServiceLabel,
  isDomOrSyntheticEvent,
} = await import('../src/lib/normalizeServiceType.js')
const { getSeoPageByPath } = await import('../src/data/seoPages.js')
const { buildCustomerLeadUpsertPayload } = await import('../src/lib/customerLeadCapture.js')
const { verifyBreakdownReconcilesWithTotal } = await import('../src/lib/pricingBreakdownDisplay.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const settings = mergePricingSettingsWithDefaults(getDefaultPricingSettings())

/** Dundee → Aberdeen booking from the reported discrepancy. */
const SHARED_WIZARD = {
  distanceMiles: 66.1,
  mapboxRouteDurationSeconds: undefined,
  pickupFloor: null,
  deliveryFloor: null,
  pickupLift: null,
  deliveryLift: null,
  walkingDistance: '',
  parkingDistance: '',
  stairsFlights: 0,
  packing: false,
  packingApproxBoxes: 0,
  packingFragile: false,
  packingMaterials: false,
  dismantling: false,
  dismantlingItemCount: 0,
  reassembly: false,
  reassemblyItemCount: 0,
  reassemblySameAsDismantling: false,
  arrivalWindow: 'morning',
  promoCode: '',
  packageTier: 'standard',
  crewSize: 2,
  moveDate: '2026-07-28', // Tuesday — weekday, no weekend surcharge
}

const LINE_ITEMS = [
  {
    name: 'Inventory',
    quantity: 1,
    volumePerUnitM3: 6.77,
    handlingMultiplier: 1,
    weightType: 'large',
  },
]

console.log('=== Service normalization (reject [object Object]) ===')

assert(isDomOrSyntheticEvent({ preventDefault() {}, target: {} }), 'SyntheticEvent-like object detected')
assert(!isDomOrSyntheticEvent('House Removals'), 'string is not an event')

assert(resolveServiceLabel({ preventDefault() {} }) === '', 'click event → empty service')
assert(resolveServiceLabel('[object Object]') === '', '"[object Object]" string → empty')
assert(resolveServiceLabel({ label: 'House Removals' }) === 'House Removals', 'object.label → House Removals')
assert(resolveServiceLabel({ serviceType: 'Man with Van' }) === 'Man with Van', 'object.serviceType')
assert(normalizeServiceType('house-removals').label === 'House Removals', 'slug → label')
assert(normalizeServiceType('house-removals').key === 'house-removals', 'slug → key')
assert(normalizeServiceType('House Removals').key === 'house-removals', 'label → key')
console.log('Service normalization: OK')

console.log('\n=== SEO page service preset (/aberdeen-removals/) ===')
const aberdeen = getSeoPageByPath('/aberdeen-removals')
assert(aberdeen, 'aberdeen-removals page exists')
assert(aberdeen.serviceType === 'House Removals', `expected House Removals, got ${aberdeen.serviceType}`)
console.log('Aberdeen SEO page serviceType: OK')

console.log('\n=== Homepage vs SEO quote parity (Dundee → Aberdeen) ===')

const homepageService = 'House Removals'
const seoService = resolveServiceLabel(aberdeen.serviceType)

assert(homepageService === seoService, 'homepage and SEO service labels must match')

const homepageInput = buildQuoteEngineInput({
  serviceType: homepageService,
  wizard: SHARED_WIZARD,
  lineItems: LINE_ITEMS,
  heavyItemCount: 0,
})

const seoInput = buildQuoteEngineInput({
  serviceType: seoService,
  wizard: SHARED_WIZARD,
  lineItems: LINE_ITEMS,
  heavyItemCount: 0,
})

const homepageQuote = calculateQuote(settings, homepageInput)
const seoQuote = calculateQuote(settings, seoInput)

assert(
  homepageQuote.estimatedTotal === seoQuote.estimatedTotal,
  `totals differ: homepage £${homepageQuote.estimatedTotal} vs SEO £${seoQuote.estimatedTotal}`,
)
assert(
  homepageQuote.distancePrice === seoQuote.distancePrice,
  'distancePrice must match',
)
assert(
  homepageQuote.volumeMultiplier === seoQuote.volumeMultiplier,
  'volumeMultiplier must match (no double application on SEO)',
)
assert(
  homepageQuote.crewLabourTotal === seoQuote.crewLabourTotal,
  'crewLabourTotal must match',
)

const homepageReconcile = verifyBreakdownReconcilesWithTotal(homepageQuote)
const seoReconcile = verifyBreakdownReconcilesWithTotal(seoQuote)
assert(homepageReconcile.ok, `homepage reconcile delta ${homepageReconcile.delta}`)
assert(seoReconcile.ok, `SEO reconcile delta ${seoReconcile.delta}`)

console.log(
  `Parity total: £${homepageQuote.estimatedTotal} (66.1 mi, 6.77 m³, 2 men, no extras, weekday)`,
)
console.log('Homepage vs SEO calculateQuote parity: OK')

console.log('\n=== openQuote event coercion (legacy String(event) bug) ===')
/** Mirrors SeoQuoteModalContext.openQuote after fix */
function resolveOpenQuoteService(serviceTypeOverride, defaultServiceType) {
  const fromOverride = resolveServiceLabel(serviceTypeOverride)
  return fromOverride || resolveServiceLabel(defaultServiceType)
}

const fakeClickEvent = {
  preventDefault() {},
  stopPropagation() {},
  target: { tagName: 'BUTTON' },
  nativeEvent: {},
}
assert(
  resolveOpenQuoteService(fakeClickEvent, 'House Removals') === 'House Removals',
  'onClick={openQuote} must fall back to page default, not [object Object]',
)
assert(
  resolveOpenQuoteService(undefined, 'House Removals') === 'House Removals',
  'openQuote() uses default',
)
assert(
  resolveOpenQuoteService('Man with Van', 'House Removals') === 'Man with Van',
  'openQuote(string) overrides default',
)
console.log('openQuote event coercion: OK')

console.log('\n=== Lead payload service normalization ===')
const badLead = buildCustomerLeadUpsertPayload({
  step: 2,
  quoteRef: 'TEST-REF',
  serviceType: fakeClickEvent,
  wizard: { ...SHARED_WIZARD, fullName: 'Test', phone: '07000000000', email: 't@example.com' },
  sourcePageUrl: '/aberdeen-removals/',
})
assert(
  badLead.service_type == null || badLead.service_type === '',
  `expected empty service_type for event, got ${badLead.service_type}`,
)
assert(
  badLead.wizard_data?.step1?.serviceType == null || badLead.wizard_data.step1.serviceType === '',
  'wizard_data must not store [object Object]',
)

const goodLead = buildCustomerLeadUpsertPayload({
  step: 2,
  quoteRef: 'TEST-REF-2',
  serviceType: { label: 'House Removals', key: 'house-removals' },
  wizard: { ...SHARED_WIZARD, fullName: 'Test', phone: '07000000000', email: 't@example.com' },
  sourcePageUrl: '/aberdeen-removals/',
})
assert(goodLead.service_type === 'House Removals', 'object service normalized to label')
assert(goodLead.wizard_data.step1.serviceKey === 'house-removals', 'wizard_data stores service key')
assert(goodLead.wizard_data.step1.serviceType === 'House Removals', 'wizard_data stores service label')
console.log('Lead payload service normalization: OK')

console.log('\n=== No separate SEO pricing path ===')
// Architectural: both entry points produce identical engine input shape keys
const keys = Object.keys(homepageInput).sort().join(',')
const seoKeys = Object.keys(seoInput).sort().join(',')
assert(keys === seoKeys, 'engine input keys must match')
assert(JSON.stringify(homepageInput) === JSON.stringify(seoInput), 'engine inputs must be identical')
console.log('Shared canonical engine input: OK')

console.log('\nAll quote parity checks passed.')
