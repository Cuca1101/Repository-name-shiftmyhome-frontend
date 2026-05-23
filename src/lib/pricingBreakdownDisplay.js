/**
 * Read-only breakdown display helpers — no pricing recalculation.
 * Used by quote UI, emails, and mobile debug card.
 */

const money = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)

/**
 * @param {import('./pricingCalculator.js').BreakdownLine[]} lines
 * @param {(line: import('./pricingCalculator.js').BreakdownLine) => boolean} pred
 */
function sumLineAmounts(lines, pred) {
  return money((lines || []).reduce((s, l) => (pred(l) ? s + (Number(l.amount) || 0) : s), 0))
}

/**
 * Standard grouped rows for debug / admin preview (amounts from engine output only).
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} b
 * @returns {{ label: string, amount: number, isDiscount?: boolean, isTotal?: boolean }[]}
 */
export function buildStandardPricingDisplayRows(b) {
  if (!b) return []

  const access = b.accessLines || []
  const extras = b.extrasLines || []
  const surcharges = b.surchargeLines || []
  const discounts = b.discountLines || []

  const floorCharges = sumLineAmounts(access, (l) => /^Floor\/access/i.test(l.label))
  const liftCharges = sumLineAmounts(
    access,
    (l) => /^No lift supplement/i.test(l.label) || /^Lift access charge/i.test(l.label),
  )
  const heavyCharges = sumLineAmounts(access, (l) => /^Heavy item/i.test(l.label))
  const accessCharges = sumLineAmounts(
    access,
    (l) =>
      !/^Floor\/access/i.test(l.label) &&
      !/^No lift supplement/i.test(l.label) &&
      !/^Lift access charge/i.test(l.label) &&
      !/^Heavy item/i.test(l.label),
  )

  const crewLabour =
    b.crewLabourTotal != null && Number.isFinite(b.crewLabourTotal)
      ? money(b.crewLabourTotal)
      : sumLineAmounts(extras, (l) => /crew member \(labour\)/i.test(l.label))

  const fuelSurcharge =
    b.fuelSurchargeAmount != null && Number.isFinite(b.fuelSurchargeAmount)
      ? money(b.fuelSurchargeAmount)
      : sumLineAmounts(extras, (l) => /^Fuel surcharge/i.test(l.label))

  const waitingTime = sumLineAmounts(extras, (l) => /^Waiting time/i.test(l.label))
  const packing = sumLineAmounts(
    extras,
    (l) => /packing/i.test(l.label) && !/dismantling|reassembly/i.test(l.label),
  )
  const dismantling = sumLineAmounts(extras, (l) => /^Dismantling/i.test(l.label))
  const reassembly = sumLineAmounts(extras, (l) => /^Reassembly/i.test(l.label))
  const exactArrival = sumLineAmounts(extras, (l) => /^Exact arrival/i.test(l.label))
  const sameDay = sumLineAmounts(surcharges, (l) => /same-day/i.test(l.label))
  const weekend = sumLineAmounts(surcharges, (l) => /weekend/i.test(l.label))

  const discountAmount = money(
    discounts.reduce((s, l) => s + Math.abs(Number(l.amount) || 0), 0) ||
      Number(b.discountTotal) ||
      0,
  )

  /** @type {{ label: string, amount: number, isDiscount?: boolean, isTotal?: boolean }[]} */
  const rows = [
    { label: 'Base Price', amount: money(b.basePrice) },
    { label: 'Mileage Price', amount: money(b.distancePrice) },
    { label: 'Volume Price', amount: money(b.volumePrice) },
    { label: 'Crew Labour', amount: crewLabour },
    { label: 'Fuel Surcharge', amount: fuelSurcharge },
    { label: 'Access Charges', amount: accessCharges },
    { label: 'Floor Charges', amount: floorCharges },
    { label: 'No-lift / Lift Charges', amount: liftCharges },
    { label: 'Heavy Item Charges', amount: heavyCharges },
    { label: 'Waiting Time', amount: waitingTime },
    { label: 'Packing', amount: packing },
    { label: 'Dismantling', amount: dismantling },
    { label: 'Reassembly', amount: reassembly },
    { label: 'Same Day Surcharge', amount: sameDay },
    { label: 'Weekend Surcharge', amount: weekend },
    { label: 'Exact Arrival Premium', amount: exactArrival },
    { label: 'Minimum Charge Adjustment', amount: money(b.minimumApplied) },
    { label: 'Discounts', amount: discountAmount, isDiscount: true },
  ].filter((row) => row.amount !== 0)

  if (b.estimatedTotal != null && Number.isFinite(b.estimatedTotal)) {
    rows.push({
      label: 'Final Estimated Total',
      amount: money(b.estimatedTotal),
      isTotal: true,
    })
  }

  return rows
}

/**
 * Verify grouped display rows reconcile with engine total (excluding final total row).
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} b
 */
export function verifyBreakdownReconcilesWithTotal(b) {
  if (!b || b.estimatedTotal == null) return { ok: true, delta: 0 }
  const rows = buildStandardPricingDisplayRows(b).filter((r) => !r.isTotal)
  let sum = money(b.basePrice + b.distancePrice + b.volumePrice + (b.accessTotal || 0) + (b.extrasTotal || 0))
  sum = money(sum + (b.surchargesTotal || 0) - (b.discountTotal || 0) + (b.minimumApplied || 0))
  const delta = money(b.estimatedTotal - sum)
  return { ok: Math.abs(delta) < 0.02, delta, computed: sum, estimatedTotal: b.estimatedTotal }
}

/**
 * Flatten price breakdown for UI lists (desktop sidebar, mobile summary, emails).
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} b
 * @returns {{ label: string, amount: number, isDiscount?: boolean }[]}
 */
export function collectBreakdownDisplayLines(b) {
  if (!b) return []
  const baseLabel =
    b.basePriceUsesPerManPricing &&
    b.crewSizeUsedInPricing != null &&
    b.basePricePerManUnit != null
      ? `Base (${b.crewSizeUsedInPricing} × £${b.basePricePerManUnit.toFixed(2)} per man)`
      : 'Base'
  /** @type {{ label: string, amount: number, isDiscount?: boolean }[]} */
  const rows = [
    { label: baseLabel, amount: b.basePrice },
    { label: 'Distance', amount: b.distancePrice },
    { label: `Volume (${b.totalCubicMetres.toFixed(2)} m³)`, amount: b.volumePrice },
  ]
  for (const l of b.accessLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.extrasLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.surchargeLines || []) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.discountLines || []) {
    rows.push({ label: l.label, amount: l.amount, isDiscount: true })
  }
  if (b.minimumApplied > 0) {
    rows.push({ label: 'Minimum job price adjustment', amount: b.minimumApplied })
  }
  return rows
}
