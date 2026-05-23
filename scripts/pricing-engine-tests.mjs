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

// --- Access charges must NOT scale with crew size ---
const accessInput = {
  pickupFloor: 1,
  deliveryFloor: 0,
  pickupLift: false,
  deliveryLift: false,
  longWalk: false,
  parking: false,
  stairsFlights: 0,
  heavyItemCount: 0,
}
const quote1ManAccess = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 1.3,
  lineItems: SOFA_LINE,
  access: accessInput,
  extras: {},
  crewSize: 1,
})
const quote2ManAccess = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 1.3,
  lineItems: SOFA_LINE,
  access: accessInput,
  extras: {},
  crewSize: 2,
})

function sumAccessByPrefix(b, re) {
  return (b.accessLines || [])
    .filter((l) => re.test(l.label))
    .reduce((s, l) => s + l.amount, 0)
}

const floor1 = sumAccessByPrefix(quote1ManAccess, /^Floor\/access/i)
const floor2 = sumAccessByPrefix(quote2ManAccess, /^Floor\/access/i)
const noLift1 = sumAccessByPrefix(quote1ManAccess, /^No lift supplement/i)
const noLift2 = sumAccessByPrefix(quote2ManAccess, /^No lift supplement/i)

console.log('\n=== Access charge crew invariance (1 vs 2 men) ===')
console.log(`1 man floor: £${floor1.toFixed(2)} | 2 men floor: £${floor2.toFixed(2)}`)
console.log(`1 man no-lift: £${noLift1.toFixed(2)} | 2 men no-lift: £${noLift2.toFixed(2)}`)
if (Math.abs(floor1 - floor2) > 0.01 || Math.abs(noLift1 - noLift2) > 0.01) {
  console.error('FAILED: access charges changed when crew size increased')
  process.exit(1)
}
if (quote2ManAccess.pricingDebugDetail?.accessCharges?.crewMultiplierApplied) {
  console.error('FAILED: debug detail reports crew multiplier on access')
  process.exit(1)
}
console.log('Access charges unchanged when crew increases: OK')

// --- Crew base fees separate from hourly labour ---
const base1 = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 5,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 1,
})
const base2 = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 5,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 2,
})
const base3 = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 5,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 3,
})

console.log('\n=== Crew base fee separation ===')
console.log(
  `1 man crew base: £${(base1.crewBaseFees?.total ?? 0).toFixed(2)} (expected £15)`,
)
console.log(
  `2 men crew base: £${(base2.crewBaseFees?.total ?? 0).toFixed(2)} (expected £30)`,
)
console.log(
  `3 men crew base: £${(base3.crewBaseFees?.total ?? 0).toFixed(2)} (expected £55)`,
)
const expectedBases = [15, 30, 55]
const actualBases = [base1.crewBaseFees?.total, base2.crewBaseFees?.total, base3.crewBaseFees?.total]
for (let i = 0; i < 3; i++) {
  if (Math.abs((actualBases[i] ?? 0) - expectedBases[i]) > 0.01) {
    console.error(`FAILED: crew base fee for ${i + 1} man(s) expected £${expectedBases[i]}`)
    process.exit(1)
  }
}
if ((base2.crewLabourTotal ?? 0) <= (base1.crewLabourTotal ?? 0)) {
  console.error('FAILED: 2-man crew labour should exceed 1-man hourly labour')
  process.exit(1)
}
console.log('Crew base thresholds (minimum operational floor): OK')

// --- Minimum threshold + volume scaling ---
const smallJob = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 1.3,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 1,
})
if (smallJob.baseThresholdApplied !== true || smallJob.estimatedTotal !== smallJob.minimumBaseThreshold) {
  console.error('FAILED: small job should hit minimum base threshold')
  process.exit(1)
}
if (smallJob.volumeMultiplier !== 1) {
  console.error(`FAILED: small job (0–3 m³) expected ×1.00 volume multiplier, got ×${smallJob.volumeMultiplier}`)
  process.exit(1)
}
console.log(`Small job (1.3mi, 1.5m³): calculated £${smallJob.scaledSubtotal.toFixed(2)} → final £${smallJob.estimatedTotal.toFixed(2)} (threshold applied, ×${smallJob.volumeMultiplier})`)

const mediumJob = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 45,
  lineItems: SOFA_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 2,
})
if (mediumJob.scaledSubtotal <= mediumJob.minimumBaseThreshold) {
  console.error('FAILED: medium/long job scaled subtotal should exceed minimum base threshold')
  process.exit(1)
}
if (mediumJob.minimumBaseAdjustment > 0) {
  console.error('FAILED: medium/long job should not need minimum base threshold adjustment')
  process.exit(1)
}
console.log(`Medium job (45mi, 1.5m³): calculated £${mediumJob.scaledSubtotal.toFixed(2)} → final £${mediumJob.estimatedTotal.toFixed(2)} (above threshold, no base bump)`)

const LARGE_LINE = [{ name: 'Load', quantity: 1, volumePerUnitM3: 18, handlingMultiplier: 1, weightType: 'large' }]
const largeJob = calculateQuote(settings, {
  serviceType: 'Man with Van',
  distanceMiles: 15,
  lineItems: LARGE_LINE,
  access: baseAccess,
  extras: {},
  crewSize: 2,
})
if (largeJob.volumeMultiplier !== 1.35) {
  console.error(`FAILED: large job expected ×1.35 volume multiplier, got ×${largeJob.volumeMultiplier}`)
  process.exit(1)
}
if (largeJob.scaledSubtotal <= largeJob.calculatedSubtotalBeforeMultiplier) {
  console.error('FAILED: large job scaled subtotal should exceed pre-multiplier subtotal')
  process.exit(1)
}
console.log(
  `Large job (15mi, 18m³): pre-multiplier £${largeJob.calculatedSubtotalBeforeMultiplier.toFixed(2)} × ${largeJob.volumeMultiplier} → £${largeJob.scaledSubtotal.toFixed(2)} → final £${largeJob.estimatedTotal.toFixed(2)}`,
)

function volumeLine(m3) {
  return [{ name: 'Load', quantity: 1, volumePerUnitM3: m3, handlingMultiplier: 1, weightType: 'large' }]
}

const bandCases = [
  { m3: 2, expected: 1, label: '0–3 m³' },
  { m3: 10, expected: 1.2, label: '8–15 m³' },
  { m3: 26, expected: 1.5, label: '25 m³+' },
]
for (const { m3, expected, label } of bandCases) {
  const job = calculateQuote(settings, {
    serviceType: 'Man with Van',
    distanceMiles: 20,
    lineItems: volumeLine(m3),
    access: baseAccess,
    extras: {},
    crewSize: 2,
  })
  if (job.volumeMultiplier !== expected) {
    console.error(`FAILED: ${label} job expected ×${expected}, got ×${job.volumeMultiplier}`)
    process.exit(1)
  }
}
console.log('Volume band multipliers (default fallbacks): OK')

const bandInput = {
  serviceType: 'Man with Van',
  distanceMiles: 20,
  lineItems: volumeLine(10),
  access: baseAccess,
  extras: {},
  crewSize: 2,
}
const defaultBandJob = calculateQuote(settings, bandInput)
const adminBandSettings = testSettings({ volumeMultiplier8To15M3: 2.5 })
const adminBandJob = calculateQuote(adminBandSettings, bandInput)
if (adminBandJob.volumeMultiplier !== 2.5) {
  console.error(`FAILED: admin 8–15 m³ override expected ×2.5, got ×${adminBandJob.volumeMultiplier}`)
  process.exit(1)
}
if (adminBandJob.volumeMultiplierSource !== 'admin') {
  console.error(`FAILED: admin override expected source "admin", got "${adminBandJob.volumeMultiplierSource}"`)
  process.exit(1)
}
if (adminBandJob.scaledSubtotal <= defaultBandJob.scaledSubtotal) {
  console.error('FAILED: admin multiplier override should increase scaled subtotal vs defaults')
  process.exit(1)
}
console.log(
  `Admin multiplier override (8–15 m³ ×2.5): default £${defaultBandJob.scaledSubtotal.toFixed(2)} → admin £${adminBandJob.scaledSubtotal.toFixed(2)}`,
)

const { SHOW_PRICE_DEBUG } = await loadSrc('lib/quotePricingDebugConfig.js')
if (SHOW_PRICE_DEBUG !== false) {
  console.error('FAILED: SHOW_PRICE_DEBUG must be false before production')
  process.exit(1)
}
console.log('SHOW_PRICE_DEBUG=false: OK')

console.log(`\nAll ${results.length} pricing scenarios passed.`)
