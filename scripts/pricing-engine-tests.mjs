/**
 * Pricing engine regression tests (Node — no Vite).
 * Run: npm run test:pricing
 */
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Load ESM module from src with .js extension for Node. */
async function loadSrc(relPath) {
  const url = pathToFileURL(join(root, 'src', relPath)).href
  return import(url)
}

const { calculateQuote } = await loadSrc('lib/pricingCalculator.js')
const { verifyBreakdownReconcilesWithTotal } = await loadSrc('lib/pricingBreakdownDisplay.js')

/** Minimal admin-like settings for tests (mirrors merged defaults + sample admin overrides). */
function testSettings(overrides = {}) {
  return {
    basePriceByService: { 'Man with Van': 72 },
    pricePerMile: 1.2,
    pricePerCubicMetre: 14,
    minimumJobPrice: 85,
    minimumJobPriceOneMan: 85,
    minimumJobPriceTwoMen: 105,
    minimumJobPriceThreeMen: 130,
    floorChargePerFloor: 13,
    noLiftCharge: 30,
    yesLiftChargePerEnd: 0,
    fuelSurchargeEnabled: true,
    fuelSurchargePerMile: 0.2,
    secondManBaseFee: 15,
    secondManHourlyRate: 18,
    firstManBaseFee: 15,
    firstManHourlyRate: 18,
    firstManLabourFee: 30,
    thirdManBaseFee: 25,
    thirdManHourlyRate: 16,
    secondManLabourFee: 30,
    thirdManLabourFee: 38,
    fallbackSpeedMph: 35,
    oneManLabourDiscountPercent: 18,
    basePricePerMan: false,
    waitingTimePricePerHour: 40,
    sameDaySurchargePercent: 12,
    weekendSurchargePercent: 15,
    packingPricePerBoxOrItem: 5,
    dismantlingPricePerItem: 42,
    reassemblyPricePerItem: 42,
    exactArrivalPremiumGbp: 20,
    promoCodesEnabled: false,
    promoCodes: [],
    ...overrides,
  }
}

const SOFA_LINE = [{ name: 'Sofa', quantity: 1, volumePerUnitM3: 1.5, handlingMultiplier: 1, weightType: 'large' }]

function runScenario(id, settings, input) {
  const breakdown = calculateQuote(settings, input)
  const reconcile = verifyBreakdownReconcilesWithTotal(breakdown)
  const rows = breakdown.standardDisplayRows || []
  return {
    id,
    finalTotal: breakdown.estimatedTotal,
    minimumApplied: breakdown.minimumApplied,
    crewLabourTotal: breakdown.crewLabourTotal,
    mileagePrice: breakdown.distancePrice,
    fuelSurcharge: breakdown.fuelSurchargeAmount,
    breakdownRows: rows.filter((r) => !r.isTotal),
    reconcileOk: reconcile.ok,
    reconcileDelta: reconcile.delta,
  }
}

const settings = testSettings()
const baseAccess = {
  pickupFloor: 0,
  deliveryFloor: 0,
  pickupLift: false,
  deliveryLift: false,
  longWalk: false,
  parking: false,
  stairsFlights: 0,
  heavyItemCount: 0,
}

const scenarios = [
  ['A', { crewSize: 1, distanceMiles: 1.3, access: baseAccess, extras: {} }],
  ['B', { crewSize: 2, distanceMiles: 1.3, access: baseAccess, extras: {} }],
  ['C', { crewSize: 1, distanceMiles: 5, access: baseAccess, extras: {} }],
  ['D', { crewSize: 2, distanceMiles: 5, access: baseAccess, extras: {} }],
  [
    'E',
    {
      crewSize: 1,
      distanceMiles: 1.3,
      access: { ...baseAccess, pickupFloor: 1, pickupLift: false, deliveryLift: false },
      extras: {},
    },
  ],
  [
    'F',
    {
      crewSize: 2,
      distanceMiles: 1.3,
      access: { ...baseAccess, pickupFloor: 1, pickupLift: false, deliveryLift: false },
      extras: {},
    },
  ],
  [
    'G',
    {
      crewSize: 1,
      distanceMiles: 1.3,
      access: { ...baseAccess, pickupFloor: 1, pickupLift: true, deliveryLift: true },
      extras: {},
    },
  ],
  [
    'H',
    { crewSize: 2, distanceMiles: 1.3, access: baseAccess, extras: { packing: true, packingApproxBoxes: 10 } },
  ],
  [
    'I',
    {
      crewSize: 2,
      distanceMiles: 1.3,
      access: baseAccess,
      extras: { dismantling: true, dismantlingItemCount: 2 },
    },
  ],
  [
    'J',
    { crewSize: 2, distanceMiles: 1.3, access: baseAccess, extras: { waitingHours: 2 } },
  ],
  [
    'K',
    {
      crewSize: 2,
      distanceMiles: 1.3,
      access: baseAccess,
      extras: { weekend: true },
      moveDate: '2026-05-16',
    },
  ],
  ['L', { crewSize: 2, distanceMiles: 1.3, access: baseAccess, extras: { sameDay: true } }],
  [
    'M',
    { crewSize: 2, distanceMiles: 1.3, access: baseAccess, extras: { exactArrivalPremium: true } },
  ],
]

const results = scenarios.map(([id, partial]) =>
  runScenario(String(id), settings, {
    serviceType: 'Man with Van',
    distanceMiles: partial.distanceMiles,
    lineItems: SOFA_LINE,
    access: partial.access,
    extras: partial.extras,
    crewSize: partial.crewSize,
    moveDate: partial.moveDate,
  }),
)

let failed = 0
for (const r of results) {
  const minExpected = r.id === 'A' || r.id === 'C' || r.id === 'E' || r.id === 'G' ? 85 : 0
  const ok = r.reconcileOk && r.finalTotal >= minExpected && (r.id === 'A' || r.id === 'C' ? r.crewLabourTotal > 0 : true)
  if (!ok) failed += 1
  console.log(`\n=== Scenario ${r.id} ===`)
  console.log(`Final total: £${r.finalTotal.toFixed(2)}`)
  console.log(`Minimum applied: £${r.minimumApplied.toFixed(2)}`)
  console.log(`Crew labour: £${(r.crewLabourTotal || 0).toFixed(2)}`)
  console.log(`Mileage: £${r.mileagePrice.toFixed(2)} | Fuel: £${(r.fuelSurcharge || 0).toFixed(2)}`)
  console.log(`Reconcile OK: ${r.reconcileOk} (delta ${r.reconcileDelta})`)
  console.log('Breakdown rows:')
  for (const row of r.breakdownRows) {
    const sign = row.isDiscount ? '−' : ''
    console.log(`  ${row.label} .... ${sign}£${Math.abs(row.amount).toFixed(2)}`)
  }
  if (!ok) console.log('FAILED')
}

const { mergePricingSettingsWithDefaults } = await loadSrc('lib/pricingSettingsMerge.js')

const adminOverride = mergePricingSettingsWithDefaults(
  { pricePerMile: 2.5, minimumJobPriceOneMan: 120 },
  { warnOnFallback: false },
)
const defaultQuote = calculateQuote(testSettings(), {
  serviceType: 'Man with Van',
  distanceMiles: 1.3,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 1,
})
const adminQuote = calculateQuote(adminOverride, {
  serviceType: 'Man with Van',
  distanceMiles: 1.3,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 1,
})

console.log('\n=== Admin override proof ===')
console.log(`Default pricePerMile total mileage: £${defaultQuote.distancePrice.toFixed(2)}`)
console.log(`Admin pricePerMile=2.5 total mileage: £${adminQuote.distancePrice.toFixed(2)}`)
if (adminQuote.distancePrice <= defaultQuote.distancePrice) {
  console.error('FAILED: admin pricePerMile did not override fallback')
  process.exit(1)
}
if (adminOverride.pricePerMile !== 2.5) {
  console.error('FAILED: merged admin settings lost pricePerMile override')
  process.exit(1)
}
console.log('Admin settings override fallback: OK')

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed`)
  process.exit(1)
}

console.log(`\nAll ${results.length} pricing scenarios passed.`)
