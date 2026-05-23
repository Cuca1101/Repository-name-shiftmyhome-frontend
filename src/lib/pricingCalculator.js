import {
  appendCrewLabourFeeLines,
  getMinimumCrewForQuote,
  isLabourAccessLine,
  resolveMinimumJobPriceForCrew,
  resolveTravelHoursForCrewLabour,
  usesDistanceBasedCrewLabour,
} from './crewPricingRules'
import { getEffectiveReassemblyItemCount } from './quoteWizardReassembly'
import {
  PACKING_MATERIALS_CATALOG,
  resolvePackingMaterialUnitPrices,
} from './packingMaterialsCatalog'

/**
 * @typedef {Object} CustomSizeM3
 * @property {number} small
 * @property {number} medium
 * @property {number} large
 * @property {number} heavy
 */

/**
 * @typedef {Object} PricingSettings
 * @property {Record<string, number>} basePriceByService
 * @property {Record<string, number>} [displayPriceByService] — homepage card "From £..." only; not used in quotes
 * @property {number} pricePerMile
 * @property {number} pricePerCubicMetre
 * @property {number} minimumJobPrice
 * @property {number} [minimumJobPriceOneMan]
 * @property {number} [minimumJobPriceTwoMen]
 * @property {number} [minimumJobPriceThreeMen]
 * @property {number} [secondManLabourFee]
 * @property {number} [thirdManLabourFee]
 * @property {number} [fourthManLabourFee]
 * @property {number} [fallbackSpeedMph] — miles ÷ speed when live Mapbox duration unavailable
 * @property {number} [averageSpeedMph] — legacy alias for fallbackSpeedMph
 * @property {number} [secondManBaseFee]
 * @property {number} [secondManHourlyRate]
 * @property {number} [thirdManBaseFee]
 * @property {number} [thirdManHourlyRate]
 * @property {number} [crewSurchargePerExtraMember] — legacy fallback for tiered crew fees
 * @property {number} floorChargePerFloor
 * @property {number} noLiftCharge
 * @property {number} longWalkingDistanceCharge
 * @property {number} parkingCharge
 * @property {number} waitingTimePricePerHour
 * @property {number} sameDaySurchargePercent
 * @property {number} weekendSurchargePercent
 * @property {number} extraHelperPrice
 * @property {number} [packingServicePrice] — legacy flat fee key
 * @property {number} packingPricePerBoxOrItem
 * @property {number} [dismantlingPrice] — legacy
 * @property {number} dismantlingPricePerItem
 * @property {number} [reassemblyPrice] — legacy
 * @property {number} reassemblyPricePerItem
 * @property {number} fragilePackingSurcharge
 * @property {number} packingMaterialsFee
 * @property {number} stairsChargePerFlight
 * @property {number} heavyItemHandlingCharge
 * @property {number} exactArrivalPremiumGbp — fixed fee for exact arrival time option
 * @property {CustomSizeM3} customSizeM3
 * @property {boolean} [basePricePerMan] — when true, `basePriceByService` is **per man** and multiplied by crew size
 * @property {number} [oneManLabourDiscountPercent] — flat-base: % off labour when 1 man selected (default 20)
 * @property {boolean} [fuelSurchargeEnabled]
 * @property {number} [fuelSurchargePerMile]
 * @property {number} [yesLiftChargePerEnd] — per end when lift explicitly Yes and floor above ground
 * @property {boolean} [packingMaterialPerItemEnabled]
 * @property {number} [packingMaterialPriceBoxes] — legacy; maps to medium when per-size unset
 * @property {number} [packingMaterialPriceSmallBoxes]
 * @property {number} [packingMaterialPriceMediumBoxes]
 * @property {number} [packingMaterialPriceLargeBoxes]
 * @property {number} [packingMaterialPriceExtraLargeBoxes]
 * @property {number} [packingMaterialPriceBubble]
 * @property {number} [packingMaterialPricePaper]
 * @property {number} [packingMaterialPriceTape]
 * @property {number} [packingMaterialPriceMattress]
 * @property {number} [depositAmount]
 * @property {boolean} [promoCodesEnabled]
 * @property {{ code: string, discountType: 'percentage'|'fixed', discountValue: number }[]} [promoCodes]
 */

/**
 * @typedef {Object} PackingMaterialQuantities
 * @property {number} [smallBoxes]
 * @property {number} [mediumBoxes]
 * @property {number} [largeBoxes]
 * @property {number} [extraLargeBoxes]
 * @property {number} [boxes] — legacy total / medium fallback
 * @property {number} [bubble]
 * @property {number} [paper]
 * @property {number} [tape]
 * @property {number} [mattress]
 */

/**
 * @typedef {Object} QuoteLineItem
 * @property {string} name
 * @property {number} quantity
 * @property {number} volumePerUnitM3
 * @property {number} [handlingMultiplier]
 * @property {'small'|'medium'|'large'|'heavy'|string} [weightType]
 * @property {boolean} [isCustom]
 */

/**
 * @typedef {Object} AccessInput
 * @property {number} [pickupFloor]
 * @property {number} [deliveryFloor]
 * @property {boolean} [hasLift] — legacy single flag; used for **both** ends when `pickupLift` / `deliveryLift` are omitted
 * @property {boolean} [pickupLift] — lift available at collection (waives no-lift supplement only; floor charges still apply above ground)
 * @property {boolean} [deliveryLift] — lift available at delivery
 * @property {boolean} [longWalk]
 * @property {boolean} [parking]
 * @property {number} [stairsFlights]
 * @property {number} [heavyItemCount]
 */

/**
 * @typedef {Object} ExtrasInput
 * @property {boolean} [packing]
 * @property {number} [packingApproxBoxes]
 * @property {boolean} [packingFragile]
 * @property {boolean} [packingMaterials]
 * @property {boolean} [dismantling]
 * @property {number} [dismantlingItemCount]
 * @property {boolean} [reassembly]
 * @property {number} [reassemblyItemCount]
 * @property {boolean} [reassemblySameAsDismantling]
 * @property {number} [waitingHours]
 * @property {number} [extraHelpers]
 * @property {boolean} [sameDay]
 * @property {boolean} [weekend] — if true, apply weekend % (usually derived from move date)
 * @property {boolean} [exactArrivalPremium] — exact arrival hour (premium)
 * @property {PackingMaterialQuantities} [packingMaterialQuantities]
 * @property {string} [promoCode]
 */

/**
 * @typedef {Object} BreakdownLine
 * @property {string} label
 * @property {number} amount
 */

/**
 * @typedef {Object} PriceBreakdown
 * @property {number} basePrice
 * @property {number} distancePrice
 * @property {number} volumePrice
 * @property {number} totalCubicMetres
 * @property {BreakdownLine[]} accessLines
 * @property {number} accessTotal
 * @property {BreakdownLine[]} extrasLines
 * @property {number} extrasTotal
 * @property {BreakdownLine[]} surchargeLines
 * @property {number} surchargesTotal
 * @property {BreakdownLine[]} [discountLines]
 * @property {number} [discountTotal]
 * @property {number} subtotalBeforeSurcharges
 * @property {number} subtotalAfterSurchargesBeforeMinimum
 * @property {number} minimumJobPrice
 * @property {number} minimumApplied
 * @property {number} estimatedTotal
 * @property {boolean} [basePriceUsesPerManPricing]
 * @property {number} [crewSizeUsedInPricing] — effective crew (minimums + large-move rules applied)
 * @property {number} [crewSizeSelected] — crew size from the customer quote step
 * @property {number} [basePricePerManUnit] — per-man rate before multiplication (when per-man pricing)
 * @property {number} [estimatedTravelHours] — travel hours used for crew labour pricing
 * @property {boolean} [usesDistanceBasedCrewLabour]
 * @property {boolean} [crewTravelHoursFromMapbox]
 * @property {'mapbox'|'fallback_distance'} [crewTravelHoursSource]
 * @property {number} [mapboxRouteDurationSeconds]
 */

const money = (n) => Math.round(n * 100) / 100

/**
 * Deposit taken at payment (admin); falls back to £50 when unset.
 * @param {PricingSettings | null | undefined} settings
 */
export function resolveDepositAmountGbp(settings) {
  const n = Number(settings?.depositAmount)
  if (Number.isFinite(n) && n > 0) return money(n)
  return 50
}

/**
 * @param {{ code?: string, discountType?: string, discountValue?: number }[]} promoCodes
 * @param {string} rawCode
 */
function findPromoMatch(promoCodes, rawCode) {
  const normalized = String(rawCode || '')
    .trim()
    .toUpperCase()
  if (!normalized || !Array.isArray(promoCodes)) return null
  for (const row of promoCodes) {
    const code = String(row?.code || '')
      .trim()
      .toUpperCase()
    if (code && code === normalized) return row
  }
  return null
}

/** @param {Record<string, number>} prices */
function hasAnyPackingMaterialPerItemRate(prices) {
  return Object.values(prices).some((v) => v > 0)
}

/**
 * @param {string|undefined} isoDate
 */
export function isWeekendDate(isoDate) {
  if (!isoDate) return false
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * @param {QuoteLineItem[]} lineItems
 */
export function sumInventoryVolume(lineItems) {
  let total = 0
  for (const row of lineItems) {
    const q = Number(row.quantity) || 0
    const v = Number(row.volumePerUnitM3) || 0
    const mult = Number(row.handlingMultiplier) > 0 ? Number(row.handlingMultiplier) : 1
    total += q * v * mult
  }
  return money(total)
}

/**
 * @param {PricingSettings} settings
 * @param {{
 *   serviceType: string
 *   distanceMiles: number
 *   lineItems: QuoteLineItem[]
 *   access: AccessInput
 *   extras: ExtrasInput
 *   moveDate?: string
 *   crewSize?: number
 *   mapboxRouteDurationSeconds?: number | null
 * }} input
 * @returns {PriceBreakdown}
 */
export function calculateQuote(settings, input) {
  const s = settings
  const distanceMiles = Math.max(0, Number(input.distanceMiles) || 0)
  const mapboxRouteDurationSeconds =
    input.mapboxRouteDurationSeconds != null && input.mapboxRouteDurationSeconds !== ''
      ? Number(input.mapboxRouteDurationSeconds)
      : undefined
  const distancePrice = money(distanceMiles * (Number(s.pricePerMile) || 0))

  const lineItems = input.lineItems || []
  const totalCubicMetres = sumInventoryVolume(lineItems)
  const volumePrice = money(totalCubicMetres * (Number(s.pricePerCubicMetre) || 0))

  const crewRaw = Number(input.crewSize)
  const selectedCrew =
    Number.isFinite(crewRaw) && crewRaw >= 1 && crewRaw <= 4 ? Math.round(crewRaw) : 2

  const stairsFlightsEarly = Math.max(0, Number(input.access?.stairsFlights) || 0)
  const heavyItemCountEarly = Math.max(0, Number(input.access?.heavyItemCount) || 0)

  const largeMoveThreshold = Math.max(0, Number(s.largeMoveVolumeThresholdM3) || 0)
  const minCrewForLargeMoves = Math.max(1, Math.min(4, Number(s.minimumCrewForLargeMoves) || 1))
  const minCrewForService = getMinimumCrewForQuote(input.serviceType, heavyItemCountEarly)
  let effectiveCrewSize = Math.max(selectedCrew, minCrewForService)
  if (largeMoveThreshold > 0 && totalCubicMetres >= largeMoveThreshold) {
    effectiveCrewSize = Math.max(effectiveCrewSize, minCrewForLargeMoves)
  }
  effectiveCrewSize = Math.max(1, Math.min(4, effectiveCrewSize))

  const basePriceRaw = Number(s.basePriceByService?.[input.serviceType]) || 0
  const basePricePerMan = Boolean(s.basePricePerMan)
  const distanceCrewLabour = usesDistanceBasedCrewLabour(s)
  const travelResolve = distanceCrewLabour
    ? resolveTravelHoursForCrewLabour(s, distanceMiles, mapboxRouteDurationSeconds)
    : null
  const estimatedTravelHoursVal = travelResolve ? money(travelResolve.travelHours) : undefined
  let basePriceUsesPerManPricing = false
  let basePrice = money(basePriceRaw)
  if (distanceCrewLabour && basePriceRaw > 0) {
    /** Service base covers the first crew member; 2nd/3rd labour is distance/time-based. */
    basePrice = money(basePriceRaw)
    basePriceUsesPerManPricing = false
  } else if (basePricePerMan && basePriceRaw > 0) {
    basePrice = money(basePriceRaw * effectiveCrewSize)
    basePriceUsesPerManPricing = true
  } else {
    basePrice = money(basePriceRaw)
  }

  const access = input.access || {}
  const pickupFloor = Math.max(0, Number(access.pickupFloor) || 0)
  const deliveryFloor = Math.max(0, Number(access.deliveryFloor) || 0)

  /** When omitted, matches prior behaviour: `Boolean(undefined)` → false (no lift). */
  const legacyHasLift = Boolean(access.hasLift)

  const pickupLiftExplicit = access.pickupLift !== undefined && access.pickupLift !== null
  const deliveryLiftExplicit = access.deliveryLift !== undefined && access.deliveryLift !== null

  const pickupLift = pickupLiftExplicit ? Boolean(access.pickupLift) : legacyHasLift
  const deliveryLift = deliveryLiftExplicit ? Boolean(access.deliveryLift) : legacyHasLift

  const stairsFlights = Math.max(0, Number(access.stairsFlights) || 0)
  const heavyItemCount = Math.max(0, Number(access.heavyItemCount) || 0)

  /** @type {BreakdownLine[]} */
  const accessLines = []

  const perFloorRate = Number(s.floorChargePerFloor) || 0
  const noLiftFlat = Number(s.noLiftCharge) || 0
  /** Scale floor/no-lift access with crew when multiple movers are priced. */
  const accessCrewMult =
    basePriceUsesPerManPricing || (distanceCrewLabour && effectiveCrewSize > 1)
      ? effectiveCrewSize
      : 1

  // Per-floor charge: applies whenever above ground, whether or not there is a lift (lift does not waive this).
  // Ground floor (0) adds £0.
  if (pickupFloor > 0 && perFloorRate > 0) {
    const amt = money(pickupFloor * perFloorRate * accessCrewMult)
    if (amt > 0) {
      const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
      accessLines.push({
        label: `Floor/access (collection): ${pickupFloor} floor level(s)${crewHint}`,
        amount: amt,
      })
    }
  }
  if (deliveryFloor > 0 && perFloorRate > 0) {
    const amt = money(deliveryFloor * perFloorRate * accessCrewMult)
    if (amt > 0) {
      const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
      accessLines.push({
        label: `Floor/access (delivery): ${deliveryFloor} floor level(s)${crewHint}`,
        amount: amt,
      })
    }
  }

  // No-lift supplement: above ground + customer chose lift No (not ground floor; not when lift Yes).
  if (pickupFloor > 0 && pickupLiftExplicit && !pickupLift && noLiftFlat > 0) {
    const amt = money(noLiftFlat * accessCrewMult)
    if (amt > 0) {
      const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
      accessLines.push({
        label: `No lift supplement (collection)${crewHint}`,
        amount: amt,
      })
    }
  }
  if (deliveryFloor > 0 && deliveryLiftExplicit && !deliveryLift && noLiftFlat > 0) {
    const amt = money(noLiftFlat * accessCrewMult)
    if (amt > 0) {
      const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
      accessLines.push({
        label: `No lift supplement (delivery)${crewHint}`,
        amount: amt,
      })
    }
  }

  const yesLiftPerEnd = Number(s.yesLiftChargePerEnd) || 0
  if (yesLiftPerEnd > 0) {
    if (pickupFloor > 0 && pickupLiftExplicit && pickupLift) {
      const amt = money(yesLiftPerEnd * accessCrewMult)
      if (amt > 0) {
        const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
        accessLines.push({
          label: `Lift access charge (collection)${crewHint}`,
          amount: amt,
        })
      }
    }
    if (deliveryFloor > 0 && deliveryLiftExplicit && deliveryLift) {
      const amt = money(yesLiftPerEnd * accessCrewMult)
      if (amt > 0) {
        const crewHint = accessCrewMult > 1 ? ` × ${accessCrewMult} crew` : ''
        accessLines.push({
          label: `Lift access charge (delivery)${crewHint}`,
          amount: amt,
        })
      }
    }
  }

  if (access.longWalk) {
    const w = Number(s.longWalkingDistanceCharge) || 0
    if (w > 0) accessLines.push({ label: 'Long walking distance', amount: money(w) })
  }

  if (access.parking) {
    const p = Number(s.parkingCharge) || 0
    if (p > 0) accessLines.push({ label: 'Parking / access', amount: money(p) })
  }

  if (stairsFlights > 0) {
    const per = Number(s.stairsChargePerFlight) || 0
    const stairsAmt = money(stairsFlights * per)
    if (stairsAmt > 0) {
      accessLines.push({
        label: `Stairs (${stairsFlights} flight${stairsFlights === 1 ? '' : 's'})`,
        amount: stairsAmt,
      })
    }
  }

  if (heavyItemCount > 0) {
    const perH = Number(s.heavyItemHandlingCharge) || 0
    const hAmt = money(heavyItemCount * perH)
    if (hAmt > 0) {
      accessLines.push({
        label: `Heavy item handling (${heavyItemCount})`,
        amount: hAmt,
      })
    }
  }

  const accessTotal = money(accessLines.reduce((sum, l) => sum + l.amount, 0))

  const fuelEnabled = Boolean(s.fuelSurchargeEnabled)
  const fuelPerMile = Number(s.fuelSurchargePerMile) || 0
  let fuelSurchargeAmount = 0
  if (fuelEnabled && fuelPerMile > 0 && distanceMiles > 0) {
    fuelSurchargeAmount = money(distanceMiles * fuelPerMile)
  }

  const extras = input.extras || {}
  /** @type {BreakdownLine[]} */
  const extrasLines = []

  const packRate = Number(s.packingPricePerBoxOrItem ?? s.packingServicePrice) || 0
  const dismantleRate = Number(s.dismantlingPricePerItem ?? s.dismantlingPrice) || 0
  const reassembleRate = Number(s.reassemblyPricePerItem ?? s.reassemblyPrice) || 0
  const fragileFee = Number(s.fragilePackingSurcharge) || 0
  const materialsFee = Number(s.packingMaterialsFee) || 0

  if (extras.packing) {
    const n = Math.max(0, Number(extras.packingApproxBoxes) || 0)
    if (n > 0 && packRate > 0) {
      extrasLines.push({
        label: `Packing (${n} boxes/items × £${packRate.toFixed(2)})`,
        amount: money(n * packRate),
      })
    }
    if (extras.packingFragile && fragileFee > 0) {
      extrasLines.push({
        label: 'Fragile packing surcharge',
        amount: money(fragileFee),
      })
    }
  }

  if (extras.packingMaterials) {
    const matQty = extras.packingMaterialQuantities || {}
    const unitPrices = resolvePackingMaterialUnitPrices(s)
    const perItemActive =
      Boolean(s.packingMaterialPerItemEnabled) && hasAnyPackingMaterialPerItemRate(unitPrices)
    if (perItemActive) {
      for (const def of PACKING_MATERIALS_CATALOG) {
        const q = Math.max(0, Number(matQty[def.id]) || 0)
        const rate = unitPrices[def.id] || 0
        if (q > 0 && rate > 0) {
          const lineAmt = money(q * rate)
          const unitLabel = q === 1 ? def.unit : def.unitPlural
          extrasLines.push({
            label: `${def.label} (${q} ${unitLabel} × £${rate.toFixed(2)})`,
            amount: lineAmt,
          })
        }
      }
    } else if (materialsFee > 0) {
      extrasLines.push({
        label: 'Packing materials',
        amount: money(materialsFee),
      })
    }
  }

  if (extras.dismantling) {
    const n = Math.max(0, Number(extras.dismantlingItemCount) || 0)
    if (n > 0 && dismantleRate > 0) {
      extrasLines.push({
        label: `Dismantling (${n} items × £${dismantleRate.toFixed(2)})`,
        amount: money(n * dismantleRate),
      })
    }
  }

  if (extras.reassembly) {
    const n = getEffectiveReassemblyItemCount(extras)
    if (n > 0 && reassembleRate > 0) {
      extrasLines.push({
        label: `Reassembly (${n} items × £${reassembleRate.toFixed(2)})`,
        amount: money(n * reassembleRate),
      })
    }
  }

  if (extras.exactArrivalPremium) {
    const v = Number(s.exactArrivalPremiumGbp) || 0
    if (v > 0) {
      extrasLines.push({
        label: 'Exact arrival time (premium)',
        amount: money(v),
      })
    }
  }

  const waitingHours = Math.max(0, Number(extras.waitingHours) || 0)
  if (waitingHours > 0) {
    const rate = Number(s.waitingTimePricePerHour) || 0
    const wAmt = money(waitingHours * rate)
    if (wAmt > 0) {
      extrasLines.push({
        label: `Waiting time (${waitingHours} hr${waitingHours === 1 ? '' : 's'})`,
        amount: wAmt,
      })
    }
  }

  const extraHelpers = Math.max(0, Number(extras.extraHelpers) || 0)
  if (extraHelpers > 0) {
    const rate = Number(s.extraHelperPrice) || 0
    const hAmt = money(extraHelpers * rate)
    if (hAmt > 0) {
      extrasLines.push({
        label: `Extra helper${extraHelpers === 1 ? '' : 's'} (${extraHelpers})`,
        amount: hAmt,
      })
    }
  }

  if (distanceCrewLabour || !basePriceUsesPerManPricing) {
    appendCrewLabourFeeLines(
      extrasLines,
      s,
      effectiveCrewSize,
      distanceMiles,
      mapboxRouteDurationSeconds,
      money,
    )
  }

  if (fuelSurchargeAmount > 0) {
    extrasLines.push({
      label: `Fuel surcharge (${distanceMiles.toFixed(1)} mi × £${fuelPerMile.toFixed(2)})`,
      amount: fuelSurchargeAmount,
    })
  }

  const extrasTotal = money(extrasLines.reduce((sum, l) => sum + l.amount, 0))

  const subtotalBeforeSurcharges = money(
    basePrice + distancePrice + volumePrice + accessTotal + extrasTotal,
  )

  /** @type {BreakdownLine[]} */
  const surchargeLines = []
  const sameDayPct = Number(s.sameDaySurchargePercent) || 0
  const weekendPct = Number(s.weekendSurchargePercent) || 0

  if (extras.sameDay && sameDayPct > 0) {
    const amt = money((subtotalBeforeSurcharges * sameDayPct) / 100)
    if (amt > 0) {
      surchargeLines.push({
        label: `Same-day booking (${sameDayPct}%)`,
        amount: amt,
      })
    }
  }

  const applyWeekend =
    extras.weekend !== undefined && extras.weekend !== null
      ? Boolean(extras.weekend)
      : isWeekendDate(input.moveDate)

  if (applyWeekend && weekendPct > 0) {
    const amt = money((subtotalBeforeSurcharges * weekendPct) / 100)
    if (amt > 0) {
      surchargeLines.push({
        label: `Weekend (${weekendPct}%)`,
        amount: amt,
      })
    }
  }

  const surchargesTotal = money(surchargeLines.reduce((sum, l) => sum + l.amount, 0))
  const subtotalAfterSurchargesBeforeMinimum = money(subtotalBeforeSurcharges + surchargesTotal)

  /** @type {BreakdownLine[]} */
  const discountLines = []
  let discountTotal = 0

  const oneManPct = Math.min(100, Math.max(0, Number(s.oneManLabourDiscountPercent) ?? 20))
  const applyOneManLabourDiscount =
    !basePriceUsesPerManPricing &&
    selectedCrew === 1 &&
    effectiveCrewSize === 1 &&
    oneManPct > 0

  if (applyOneManLabourDiscount) {
    let labourSubtotal = money(basePrice + volumePrice)
    for (const line of accessLines) {
      if (isLabourAccessLine(line.label)) labourSubtotal = money(labourSubtotal + line.amount)
    }
    const oneManDiscountAmt = money((labourSubtotal * oneManPct) / 100)
    if (oneManDiscountAmt > 0) {
      discountTotal = money(discountTotal + oneManDiscountAmt)
      discountLines.push({
        label: `One-man labour discount (${oneManPct}%)`,
        amount: oneManDiscountAmt,
      })
    }
  }

  if (Boolean(s.promoCodesEnabled) && extras.promoCode) {
    const match = findPromoMatch(s.promoCodes, extras.promoCode)
    if (match) {
      const val = Number(match.discountValue) || 0
      if (val > 0) {
        let discountAmt = 0
        if (match.discountType === 'fixed') {
          discountAmt = money(Math.min(subtotalAfterSurchargesBeforeMinimum, val))
        } else {
          const pct = Math.min(100, Math.max(0, val))
          discountAmt = money((subtotalAfterSurchargesBeforeMinimum * pct) / 100)
        }
        if (discountAmt > 0) {
          discountTotal = money(discountTotal + discountAmt)
          discountLines.push({
            label: `Promo code (${String(match.code).trim().toUpperCase()})`,
            amount: discountAmt,
          })
        }
      }
    }
  }

  const subtotalAfterDiscount = money(
    Math.max(0, subtotalAfterSurchargesBeforeMinimum - discountTotal),
  )

  const minimumJobPrice = resolveMinimumJobPriceForCrew(s, effectiveCrewSize)
  const estimatedTotal = money(Math.max(subtotalAfterDiscount, minimumJobPrice))
  const minimumApplied = money(estimatedTotal - subtotalAfterDiscount)

  return {
    basePrice: money(basePrice),
    distancePrice: money(distancePrice),
    volumePrice: money(volumePrice),
    totalCubicMetres,
    accessLines,
    accessTotal,
    extrasLines,
    extrasTotal,
    surchargeLines,
    surchargesTotal,
    discountLines,
    discountTotal,
    subtotalBeforeSurcharges,
    subtotalAfterSurchargesBeforeMinimum,
    minimumJobPrice: money(minimumJobPrice),
    minimumApplied: minimumApplied > 0 ? minimumApplied : 0,
    estimatedTotal,
    basePriceUsesPerManPricing,
    crewSizeUsedInPricing: effectiveCrewSize,
    crewSizeSelected: selectedCrew,
    basePricePerManUnit: basePriceUsesPerManPricing ? money(basePriceRaw) : undefined,
    estimatedTravelHours: estimatedTravelHoursVal,
    usesDistanceBasedCrewLabour: distanceCrewLabour,
    crewTravelHoursFromMapbox: travelResolve?.usedMapboxDuration ?? false,
    crewTravelHoursSource: travelResolve?.source,
    mapboxRouteDurationSeconds:
      travelResolve?.usedMapboxDuration && Number.isFinite(mapboxRouteDurationSeconds)
        ? money(mapboxRouteDurationSeconds)
        : undefined,
  }
}

/**
 * @param {PriceBreakdown} b
 */
export function breakdownToFlatRows(b) {
  const baseLabel =
    b.basePriceUsesPerManPricing &&
    b.crewSizeUsedInPricing != null &&
    b.basePricePerManUnit != null
      ? `Base price (${b.crewSizeUsedInPricing} × £${b.basePricePerManUnit.toFixed(2)} per man)`
      : 'Base price'
  const rows = [
    { label: baseLabel, amount: b.basePrice },
    { label: 'Distance', amount: b.distancePrice },
    { label: 'Inventory (volume)', amount: b.volumePrice },
  ]
  for (const l of b.accessLines) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.extrasLines) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.surchargeLines) rows.push({ label: l.label, amount: l.amount })
  for (const l of b.discountLines || []) {
    rows.push({ label: l.label, amount: -Math.abs(l.amount) })
  }
  if (b.minimumApplied > 0) {
    rows.push({ label: 'Minimum job price adjustment', amount: b.minimumApplied })
  }
  return rows
}
