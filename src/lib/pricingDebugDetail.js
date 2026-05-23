/**
 * Admin/debug pricing breakdown — read-only detail from engine output.
 * Do not recalculate totals here; mirror calculateQuote() intermediates.
 */

import {
  calculateDistanceBasedCrewHourlyLabourFee,
  getFallbackSpeedMph,
  resolveCrewLabourDistanceRates,
  resolveTravelHoursForCrewLabour,
} from './crewPricingRules'

const money = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * @param {import('./pricingCalculator.js').PriceBreakdown} breakdown
 * @param {{
 *   settings: import('./pricingCalculator.js').PricingSettings
 *   serviceType: string
 *   distanceMiles: number
 *   mapboxRouteDurationSeconds?: number | null
 *   selectedCrew: number
 *   effectiveCrewSize: number
 *   largeMoveThreshold: number
 *   largeMoveTriggered: boolean
 *   minCrewForService: number
 *   minCrewForLargeMoves: number
 *   distanceCrewLabour: boolean
 *   basePricePerMan: boolean
 *   serviceBasePrice: number
 *   minimumBaseThreshold: number
 *   pricePerMile: number
 *   pricePerCubicMetre: number
 *   accessInput: import('./pricingCalculator.js').AccessInput
 *   extrasInput: import('./pricingCalculator.js').ExtrasInput
 * }} ctx
 */
export function buildPricingDebugDetail(breakdown, ctx) {
  const s = ctx.settings
  const travelResolve = ctx.distanceCrewLabour
    ? resolveTravelHoursForCrewLabour(s, ctx.distanceMiles, ctx.mapboxRouteDurationSeconds)
    : null
  const driveHours = travelResolve?.travelHours ?? 0
  const mapboxSec = Number(ctx.mapboxRouteDurationSeconds)
  const mapboxMinutes =
    Number.isFinite(mapboxSec) && mapboxSec > 0 ? money(mapboxSec / 60) : null

  const pricePerM3 = Number(s.pricePerCubicMetre) || 0
  const totalM3 = breakdown.totalCubicMetres || 0

  const crewBase = breakdown.crewBaseFees || {
    firstManBase: 0,
    secondManBase: 0,
    thirdManBase: 0,
    fourthManBase: 0,
    total: 0,
    lines: [],
  }

  /** @type {{ role: string, label: string, hours: number, hourlyRate: number, subtotal: number }[]} */
  const hourlySubtotals = []
  if (ctx.distanceCrewLabour && ctx.effectiveCrewSize >= 1) {
    const roles = [
      { min: 1, role: 'first', label: 'First man hourly' },
      { min: 2, role: 'second', label: 'Second man hourly' },
      { min: 3, role: 'third', label: 'Third man hourly' },
      { min: 4, role: 'fourth', label: 'Fourth man hourly' },
    ]
    for (const { min, role, label } of roles) {
      if (ctx.effectiveCrewSize < min) continue
      const { hourly } = resolveCrewLabourDistanceRates(s, role)
      const subtotal = calculateDistanceBasedCrewHourlyLabourFee(
        s,
        ctx.distanceMiles,
        ctx.mapboxRouteDurationSeconds,
        role,
      )
      if (hourly > 0 || subtotal > 0) {
        hourlySubtotals.push({
          role,
          label,
          hours: money(driveHours),
          hourlyRate: hourly,
          subtotal: money(subtotal),
        })
      }
    }
  }

  const access = ctx.accessInput || {}
  const pickupFloor = Math.max(0, Number(access.pickupFloor) || 0)
  const deliveryFloor = Math.max(0, Number(access.deliveryFloor) || 0)
  const perFloor = Number(s.floorChargePerFloor) || 0
  const noLiftFlat = Number(s.noLiftCharge) || 0
  const yesLiftPerEnd = Number(s.yesLiftChargePerEnd) || 0

  /** @type {object[]} */
  const accessChargeDetail = []

  function pushAccess(type, side, reason, amount) {
    if (amount <= 0) return
    accessChargeDetail.push({
      type,
      side,
      reason,
      amount: money(amount),
      crewMultiplied: false,
    })
  }

  if (pickupFloor > 0 && perFloor > 0) {
    pushAccess(
      'floor',
      'pickup',
      `${pickupFloor} floor level(s) × £${perFloor.toFixed(2)} per floor (per job, not × crew)`,
      pickupFloor * perFloor,
    )
  }
  if (deliveryFloor > 0 && perFloor > 0) {
    pushAccess(
      'floor',
      'delivery',
      `${deliveryFloor} floor level(s) × £${perFloor.toFixed(2)} per floor (per job, not × crew)`,
      deliveryFloor * perFloor,
    )
  }
  const pickupLiftExplicit = access.pickupLift !== undefined && access.pickupLift !== null
  const deliveryLiftExplicit = access.deliveryLift !== undefined && access.deliveryLift !== null
  const pickupLift = pickupLiftExplicit ? Boolean(access.pickupLift) : Boolean(access.hasLift)
  const deliveryLift = deliveryLiftExplicit ? Boolean(access.deliveryLift) : Boolean(access.hasLift)

  if (pickupFloor > 0 && pickupLiftExplicit && !pickupLift && noLiftFlat > 0) {
    pushAccess('no_lift', 'pickup', 'Above ground + lift = No (flat supplement per job)', noLiftFlat)
  }
  if (deliveryFloor > 0 && deliveryLiftExplicit && !deliveryLift && noLiftFlat > 0) {
    pushAccess('no_lift', 'delivery', 'Above ground + lift = No (flat supplement per job)', noLiftFlat)
  }
  if (yesLiftPerEnd > 0) {
    if (pickupFloor > 0 && pickupLiftExplicit && pickupLift) {
      pushAccess('lift', 'pickup', 'Lift Yes above ground (per end, per job)', yesLiftPerEnd)
    }
    if (deliveryFloor > 0 && deliveryLiftExplicit && deliveryLift) {
      pushAccess('lift', 'delivery', 'Lift Yes above ground (per end, per job)', yesLiftPerEnd)
    }
  }
  if (access.longWalk && Number(s.longWalkingDistanceCharge) > 0) {
    pushAccess('long_walk', 'job', 'Long walking distance selected', Number(s.longWalkingDistanceCharge))
  }
  if (access.parking && Number(s.parkingCharge) > 0) {
    pushAccess('parking', 'job', 'Parking / access difficulty', Number(s.parkingCharge))
  }
  const stairs = Math.max(0, Number(access.stairsFlights) || 0)
  if (stairs > 0 && Number(s.stairsChargePerFlight) > 0) {
    pushAccess(
      'stairs',
      'job',
      `${stairs} flight(s) × £${Number(s.stairsChargePerFlight).toFixed(2)}`,
      stairs * Number(s.stairsChargePerFlight),
    )
  }
  const heavy = Math.max(0, Number(access.heavyItemCount) || 0)
  if (heavy > 0 && Number(s.heavyItemHandlingCharge) > 0) {
    pushAccess(
      'heavy',
      'job',
      `${heavy} heavy item(s) × £${Number(s.heavyItemHandlingCharge).toFixed(2)}`,
      heavy * Number(s.heavyItemHandlingCharge),
    )
  }

  const extras = ctx.extrasInput || {}
  const fuelPerMile = Number(s.fuelSurchargePerMile) || 0
  const fuelEnabled = Boolean(s.fuelSurchargeEnabled)

  return {
    routeDuration: {
      mapboxDistanceMiles: money(ctx.distanceMiles),
      mapboxDurationMinutes: mapboxMinutes,
      driveHoursUsed: money(driveHours),
      fallbackSpeedMph: getFallbackSpeedMph(s),
      usedFallbackSpeed: travelResolve ? !travelResolve.usedMapboxDuration : false,
      durationSource: travelResolve?.source ?? 'n/a',
    },
    volume: {
      totalVolumeM3: money(totalM3),
      pricePerCubicMetre: pricePerM3,
      volumeMultiplier: breakdown.volumeMultiplier ?? 1,
      volumeMultiplierBand: breakdown.volumeMultiplierBand ?? '0–3 m³',
      volumeMultiplierSource: breakdown.volumeMultiplierSource ?? 'defaults',
      multipliersConfigured: breakdown.volumeMultiplierSources ?? null,
      formula: `${totalM3.toFixed(2)} m³ × £${pricePerM3.toFixed(2)}`,
      finalVolumePrice: money(breakdown.volumePrice),
      calculatedSubtotalBeforeMultiplier: money(breakdown.calculatedSubtotalBeforeMultiplier ?? 0),
      scaledSubtotalAfterMultiplier: money(breakdown.scaledSubtotal ?? 0),
      volumeScalingAmount: money(breakdown.volumeScalingAmount ?? 0),
    },
    minimumBase: {
      serviceBaseThreshold: money(ctx.serviceBasePrice),
      firstManBaseThreshold: money(crewBase.firstManBase),
      secondManBaseThreshold: money(crewBase.secondManBase),
      thirdManBaseThreshold: money(crewBase.thirdManBase),
      fourthManBaseThreshold: money(crewBase.fourthManBase),
      minimumBaseThreshold: money(ctx.minimumBaseThreshold ?? breakdown.minimumBaseThreshold ?? 0),
      minimumBaseAdjustment: money(breakdown.minimumBaseAdjustment ?? 0),
      baseThresholdApplied: Boolean(breakdown.baseThresholdApplied),
      note: 'Threshold only — applied when calculated quote subtotal (after volume scaling) is below this floor. Not hard-added when subtotal is higher.',
    },
    labour: {
      loadingHours: null,
      unloadingHours: null,
      driveHoursUsedForLabour: ctx.distanceCrewLabour ? money(driveHours) : null,
      accessAdjustmentHours: null,
      totalOperationalHours: ctx.distanceCrewLabour ? money(driveHours) : null,
      hourlySubtotals,
      totalCrewLabour: money(breakdown.crewLabourTotal ?? 0),
      note: ctx.distanceCrewLabour
        ? 'Hourly labour uses drive/travel hours only; base fees are separate.'
        : 'Legacy flat crew labour fees (not hourly).',
    },
    crewLogic: {
      selectedCrewSize: ctx.selectedCrew,
      effectiveCrewSize: ctx.effectiveCrewSize,
      autoAdjusted: ctx.selectedCrew !== ctx.effectiveCrewSize,
      largeMoveThresholdM3: ctx.largeMoveThreshold,
      largeMoveTriggered: ctx.largeMoveTriggered,
      minCrewForService: ctx.minCrewForService,
      minCrewForLargeMoves: ctx.minCrewForLargeMoves,
      finalCrewUsedForPricing: ctx.effectiveCrewSize,
    },
    accessCharges: {
      items: accessChargeDetail,
      accessTotal: money(breakdown.accessTotal),
      crewMultiplierApplied: false,
    },
    mileageFuel: {
      pricePerMile: ctx.pricePerMile,
      mileageFormula: `${ctx.distanceMiles.toFixed(1)} mi × £${ctx.pricePerMile.toFixed(2)}`,
      mileagePrice: money(breakdown.distancePrice),
      fuelSurchargeEnabled: fuelEnabled,
      fuelPerMile,
      fuelFormula:
        fuelEnabled && fuelPerMile > 0
          ? `${ctx.distanceMiles.toFixed(1)} mi × £${fuelPerMile.toFixed(2)}`
          : null,
      fuelSurchargeAmount: money(breakdown.fuelSurchargeAmount ?? 0),
    },
    extras: (breakdown.extrasLines || [])
      .filter((l) => !/crew member \(labour\)/i.test(l.label) && !/^Fuel surcharge/i.test(l.label))
      .map((l) => ({ label: l.label, amount: money(l.amount) })),
    surcharges: (breakdown.surchargeLines || []).map((l) => ({
      label: l.label,
      amount: money(l.amount),
    })),
    discounts: (breakdown.discountLines || []).map((l) => ({
      label: l.label,
      amount: money(l.amount),
    })),
    totals: {
      calculatedSubtotalBeforeMultiplier: money(breakdown.calculatedSubtotalBeforeMultiplier ?? 0),
      volumeMultiplier: breakdown.volumeMultiplier ?? 1,
      scaledSubtotal: money(breakdown.scaledSubtotal ?? 0),
      minimumBaseThreshold: money(breakdown.minimumBaseThreshold ?? breakdown.basePrice ?? 0),
      minimumBaseAdjustment: money(breakdown.minimumBaseAdjustment ?? 0),
      subtotalBeforeSurcharges: money(breakdown.subtotalBeforeSurcharges),
      subtotalAfterSurcharges: money(breakdown.subtotalAfterSurchargesBeforeMinimum),
      minimumJobPrice: money(breakdown.minimumJobPrice),
      minimumJobAdjustment: money(breakdown.minimumJobAdjustment ?? 0),
      minimumApplied: money(breakdown.minimumApplied),
      discountTotal: money(breakdown.discountTotal ?? 0),
      finalEstimatedTotal: money(breakdown.estimatedTotal),
    },
    metadata: {
      pricingMode: ctx.distanceCrewLabour ? 'distance_hourly_crew' : 'legacy_flat_crew',
      hourlyMode: ctx.distanceCrewLabour,
      legacyMode: !ctx.distanceCrewLabour,
      fallbackLogicUsed: travelResolve ? !travelResolve.usedMapboxDuration : false,
      crewMultiplierOnAccess: false,
      basePricePerMan: ctx.basePricePerMan,
      serviceType: ctx.serviceType,
      sameDay: Boolean(extras.sameDay),
      weekend: extras.weekend,
    },
  }
}
