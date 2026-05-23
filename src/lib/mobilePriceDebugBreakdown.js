/**
 * Read-only row mapping for temporary mobile price debug UI.
 * Uses existing PriceBreakdown fields only — no pricing recalculation.
 *
 * @param {import('./pricingCalculator.js').PriceBreakdown | null | undefined} pricingBreakdown
 * @returns {{ label: string, amount: number, isDiscount?: boolean, isTotal?: boolean }[]}
 */
export function collectMobilePriceDebugRows(pricingBreakdown) {
  if (!pricingBreakdown) return []

  const money = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)
  const sumLines = (lines, pred) =>
    money((lines || []).reduce((s, l) => (pred(l) ? s + (Number(l.amount) || 0) : s), 0))

  const access = pricingBreakdown.accessLines || []
  const extras = pricingBreakdown.extrasLines || []
  const surcharges = pricingBreakdown.surchargeLines || []
  const discounts = pricingBreakdown.discountLines || []

  const floorCharges = sumLines(access, (l) => /^Floor\/access/i.test(l.label))
  const liftCharges = sumLines(
    access,
    (l) => /^No lift supplement/i.test(l.label) || /^Lift access charge/i.test(l.label),
  )
  const heavyCharges = sumLines(access, (l) => /^Heavy item/i.test(l.label))
  const accessCharges = sumLines(
    access,
    (l) =>
      !/^Floor\/access/i.test(l.label) &&
      !/^No lift supplement/i.test(l.label) &&
      !/^Lift access charge/i.test(l.label) &&
      !/^Heavy item/i.test(l.label),
  )

  const crewLabour = sumLines(extras, (l) => /crew member \(labour\)/i.test(l.label))
  const fuelSurcharge = sumLines(extras, (l) => /^Fuel surcharge/i.test(l.label))
  const waitingTime = sumLines(extras, (l) => /^Waiting time/i.test(l.label))
  const packing = sumLines(
    extras,
    (l) => /packing/i.test(l.label) && !/dismantling|reassembly/i.test(l.label),
  )
  const dismantling = sumLines(extras, (l) => /^Dismantling/i.test(l.label))
  const reassembly = sumLines(extras, (l) => /^Reassembly/i.test(l.label))
  const exactArrival = sumLines(extras, (l) => /^Exact arrival/i.test(l.label))
  const sameDay = sumLines(surcharges, (l) => /same-day/i.test(l.label))
  const weekend = sumLines(surcharges, (l) => /weekend/i.test(l.label))

  const discountAmount = money(
    discounts.reduce((s, l) => s + Math.abs(Number(l.amount) || 0), 0) ||
      Number(pricingBreakdown.discountTotal) ||
      0,
  )

  /** @type {{ label: string, amount: number, isDiscount?: boolean, isTotal?: boolean }[]} */
  const rows = [
    { label: 'Base Price', amount: money(pricingBreakdown.basePrice) },
    { label: 'Mileage Price', amount: money(pricingBreakdown.distancePrice) },
    { label: 'Volume Price', amount: money(pricingBreakdown.volumePrice) },
    { label: 'Crew Labour', amount: crewLabour },
    { label: 'Fuel Surcharge', amount: fuelSurcharge },
    { label: 'Access Charges', amount: accessCharges },
    { label: 'Floor Charges', amount: floorCharges },
    { label: 'Lift Charges', amount: liftCharges },
    { label: 'Heavy Item Charges', amount: heavyCharges },
    { label: 'Waiting Time', amount: waitingTime },
    { label: 'Packing', amount: packing },
    { label: 'Dismantling', amount: dismantling },
    { label: 'Reassembly', amount: reassembly },
    { label: 'Same Day Surcharge', amount: sameDay },
    { label: 'Weekend Surcharge', amount: weekend },
    { label: 'Exact Arrival Premium', amount: exactArrival },
    { label: 'Minimum Charge Adjustment', amount: money(pricingBreakdown.minimumApplied) },
    { label: 'Discounts', amount: discountAmount, isDiscount: true },
  ].filter((row) => row.amount !== 0)

  if (
    pricingBreakdown.estimatedTotal != null &&
    Number.isFinite(pricingBreakdown.estimatedTotal)
  ) {
    rows.push({
      label: 'Final Estimated Total',
      amount: money(pricingBreakdown.estimatedTotal),
      isTotal: true,
    })
  }

  return rows
}
