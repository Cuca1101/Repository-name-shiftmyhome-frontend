/**
 * Pricing engine regression tests (Node — no Vite).
 * Run: npm run test:pricing
 *
 * Covers anti-stacking rules, floors-only minimums, volume-band-on-volume-only,
 * small-job calibration (~£65 weekday / ~£70 Saturday), and larger-job scaling.
 */
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function loadSrc(relPath) {
  return import(pathToFileURL(join(root, 'src', relPath)).href)
}

const { calculateQuote, sumInventoryVolume } = await loadSrc('lib/pricingCalculator.js')
const { getDefaultPricingSettings } = await loadSrc('lib/defaultPricingSettings.js')
const { verifyBreakdownReconcilesWithTotal } = await loadSrc('lib/pricingBreakdownDisplay.js')
const { calculateExtraItemsCharge } = await loadSrc('lib/extraChargePricing.js')
const { lineItemAppliesHeavyHandlingFee } = await loadSrc('lib/inventoryPricing.js')
const { getQuoteCrewRestrictions, getMinimumCrewForQuote } = await loadSrc('lib/crewPricingRules.js')

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK:', msg)
  }
}

function approx(n, target, tol, label) {
  const ok = Math.abs(Number(n) - target) <= tol
  assert(ok, `${label}: got £${Number(n).toFixed(2)}, expected ~£${target} (±${tol})`)
}

const settings = getDefaultPricingSettings()

const FRIDGE = [
  {
    name: 'Fridge freezer',
    quantity: 1,
    volumePerUnitM3: 0.95,
    handlingMultiplier: 1.15,
    weightType: 'heavy',
    heavyFee: false,
  },
]

const baseAccess = {
  pickupFloor: 0,
  deliveryFloor: 0,
  longWalk: false,
  parking: false,
  stairsFlights: 0,
}

function quote(partial) {
  return calculateQuote(settings, {
    serviceType: 'Man with Van',
    access: baseAccess,
    extras: {},
    lineItems: FRIDGE,
    ...partial,
  })
}

console.log('\n=== Volume / heavy stacking guards ===')
assert(sumInventoryVolume(FRIDGE) === 0.95, 'raw volume is 0.95 m³ (no ×1.15 inflation)')
assert(lineItemAppliesHeavyHandlingFee(FRIDGE[0]) === false, 'standard fridge does not get specialist heavy fee')
assert(
  lineItemAppliesHeavyHandlingFee({
    weightType: 'heavy',
    handlingMultiplier: 1.2,
    name: 'American fridge',
  }) === true,
  'American fridge (×1.2) still qualifies for specialist heavy fee',
)
assert(
  getQuoteCrewRestrictions({ heavyItemCount: 1 }).oneManAllowed === true,
  'heavy items do not block 1-man selection',
)
assert(getMinimumCrewForQuote('Man with Van', 1) === 1, 'heavy items do not force pricing crew')

const henryWeekday = quote({
  distanceMiles: 6.3,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: FRIDGE,
})
assert(
  !henryWeekday.accessLines.some((l) => /heavy/i.test(l.label)),
  'Henry Gibbs fridge: no heavy fee line',
)
assert(henryWeekday.fuelSurchargeAmount === 0, 'fuel off by default')
assert(
  henryWeekday.volumeMultiplier > 1 && henryWeekday.volumeMultiplier < 1.1,
  `small job uses smooth 0–3→3–8 mult (got ×${henryWeekday.volumeMultiplier})`,
)
assert(henryWeekday.volumeScalingAmount > 0, 'smooth volume uplift is applied on inventory £ only')

console.log('\n=== Scenario board (defaults) ===')
/** A */ const A = quote({
  distanceMiles: 5,
  crewSize: 1,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Box', quantity: 1, volumePerUnitM3: 1, weightType: 'medium', handlingMultiplier: 1 }],
})
/** B */ const B = quote({ distanceMiles: 6.3, crewSize: 2, moveDate: '2026-09-18', lineItems: FRIDGE })
/** C */ const C = quote({ distanceMiles: 6.3, crewSize: 2, moveDate: '2026-09-19', lineItems: FRIDGE })
/** D */ const D = quote({
  distanceMiles: 10,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Load', quantity: 1, volumePerUnitM3: 5, weightType: 'large', handlingMultiplier: 1 }],
})
/** E */ const E = quote({
  distanceMiles: 20,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Load', quantity: 1, volumePerUnitM3: 10, weightType: 'large', handlingMultiplier: 1 }],
})
/** F */ const F = quote({
  distanceMiles: 50,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Load', quantity: 1, volumePerUnitM3: 20, weightType: 'large', handlingMultiplier: 1 }],
})

console.log(
  JSON.stringify(
    {
      A: A.estimatedTotal,
      B: B.estimatedTotal,
      C: C.estimatedTotal,
      D: D.estimatedTotal,
      E: E.estimatedTotal,
      F: F.estimatedTotal,
    },
    null,
    2,
  ),
)

approx(A.estimatedTotal, 55, 20, 'A 1 m³ / 5 mi / 1 man / weekday')
approx(B.estimatedTotal, 65, 5, 'B fridge / 6.3 mi / 2 men / weekday')
approx(C.estimatedTotal, 70, 5, 'C same as B / Saturday')
assert(D.estimatedTotal > B.estimatedTotal, 'D 5 m³ / 10 mi > small job B')
assert(E.estimatedTotal > D.estimatedTotal, 'E 10 m³ / 20 mi > D')
assert(F.estimatedTotal > E.estimatedTotal, 'F 20 m³ / 50 mi > E')
assert(C.estimatedTotal >= B.estimatedTotal, 'Saturday >= weekday for same job')
assert(C.surchargeLines.length === 1, 'Saturday surcharge applied once')
assert(B.surchargeLines.length === 0, 'weekday has no weekend surcharge')
// Both hit the 2-man floor (£70); Saturday % is applied before the floor so totals match.
assert(C.minimumApplied > 0 && B.minimumApplied > 0, 'small MWV jobs sit on the 2-man floor')

console.log('\n=== Henry Gibbs original quote ===')
console.log('OLD PRICE: £142.31')
console.log(`NEW PRICE: £${C.estimatedTotal.toFixed(2)}`)
approx(C.estimatedTotal, 70, 5, 'Henry Gibbs Saturday replay')

console.log('\n=== Floors only (minimums never added) ===')
const tiny = quote({
  distanceMiles: 0.5,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Box', quantity: 1, volumePerUnitM3: 0.1, weightType: 'small', handlingMultiplier: 1 }],
})
assert(tiny.estimatedTotal === Math.max(tiny.scaledSubtotal, tiny.minimumBaseThreshold, tiny.minimumJobPrice), 'final is max(subtotal, floors)')
assert(
  tiny.estimatedTotal < tiny.scaledSubtotal + tiny.minimumJobPrice - 0.01 || tiny.minimumApplied > 0,
  'minimum acts as floor uplift only when needed',
)
// Prove we never hard-add service base into subtotal
assert(
  Math.abs(tiny.subtotalBeforeSurcharges - (tiny.distancePrice + tiny.volumePrice + tiny.accessTotal + tiny.extrasTotal)) < 0.02,
  'subtotal excludes service base hard-add',
)

console.log('\n=== Volume band on inventory only (new upper bands) ===')
approx(D.volumeMultiplier, 1.14, 0.01, '5 m³ smooth between ×1.1 and ×1.2')
approx(E.volumeMultiplier, 1.2286, 0.01, '10 m³ smooth between ×1.2 and ×1.3')
assert(F.volumeMultiplier === 1.4, '20 m³ uses flat 20–30 band ×1.4')
const at19 = quote({
  distanceMiles: 50,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Load', quantity: 1, volumePerUnitM3: 19.99, weightType: 'large', handlingMultiplier: 1 }],
})
assert(at19.volumeMultiplier === 1.3, '19.99 m³ uses flat 15–20 band ×1.3')
const at25 = quote({
  distanceMiles: 5,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'Load', quantity: 1, volumePerUnitM3: 25, weightType: 'large', handlingMultiplier: 1 }],
})
assert(at25.volumeMultiplier === 1.4, '25 m³ uses 20–30 band ×1.4')
const dBaseVol = D.baseVolumePrice
const dVol = D.volumePrice
assert(Math.abs(dVol - dBaseVol * D.volumeMultiplier) < 0.02, 'volume £ = base volume £ × smooth mult only')
// Whole-quote must not be scaled by volume band: distance should equal miles × rate
assert(Math.abs(D.distancePrice - 10 * settings.pricePerMile) < 0.02, 'mileage not scaled by volume band')

console.log('\n=== House Removals remains higher floor / scalable ===')
const house = calculateQuote(settings, {
  serviceType: 'House Removals',
  distanceMiles: 20,
  crewSize: 2,
  moveDate: '2026-09-18',
  lineItems: [{ name: 'House load', quantity: 1, volumePerUnitM3: 25, weightType: 'large', handlingMultiplier: 1 }],
  access: baseAccess,
  extras: {},
})
assert(house.estimatedTotal > F.estimatedTotal, 'House Removals large job prices above MWV F')
assert(house.serviceBasePrice >= 100, 'House Removals service floor stays elevated')

console.log('\n=== Extra-charge path parity (volume + specialist heavy) ===')
const extraFridge = calculateExtraItemsCharge(settings, FRIDGE)
assert(extraFridge.totalVolumeM3 === 0.95, 'extra charge uses raw m³')
assert(
  Math.abs(
    extraFridge.estimatedAmount - extraFridge.totalVolumeM3 * settings.pricePerCubicMetre * extraFridge.volumeMultiplier,
  ) < 0.02,
  'fridge extra = raw volume £ × smooth volume mult (no specialist heavy)',
)
const extraAmerican = calculateExtraItemsCharge(settings, [
  { name: 'American fridge', quantity: 1, volumePerUnitM3: 1.6, weightType: 'heavy', handlingMultiplier: 1.2 },
])
assert(extraAmerican.estimatedAmount > 1.6 * settings.pricePerCubicMetre, 'specialist heavy adds fee on extras path')

console.log('\n=== Reconcile display totals ===')
for (const [name, b] of [
  ['A', A],
  ['B', B],
  ['C', C],
  ['D', D],
  ['E', E],
  ['F', F],
]) {
  const r = verifyBreakdownReconcilesWithTotal(b)
  assert(r.ok, `${name} breakdown reconciles (delta ${r.delta})`)
}

console.log('\n=== Fuel default ===')
assert(settings.fuelSurchargeEnabled === false, 'fuel surcharge disabled in defaults')

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll pricing regression tests passed.')
