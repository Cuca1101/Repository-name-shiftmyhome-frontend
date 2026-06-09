/**
 * Step 3 review — build calendar-style price cards using the shared pricing engine only.
 * Display/selection helpers; does not alter calculateQuote logic.
 */
import { formatWizardArrivalSummary } from './emailQuotePayload'
import { getLocalDateYYYYMMDD, isMoveDateOnOrAfterToday } from './moveDateLocal'
import { buildQuoteEngineInput } from './buildQuoteEngineInput'
import { calculateQuote } from './pricingCalculator'

const FLEX_WINDOW = 'flex_window'
const FLEX_DEFAULT_FROM = '08:00'
const FLEX_DEFAULT_UNTIL = '20:00'
const EXACT_DEFAULT_TIME = '10:00'

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} deltaDays
 * @returns {string}
 */
export function addDaysToIsoDate(isoDate, deltaDays) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
export function formatReviewDayName(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(dt)
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
/**
 * @param {string} isoDate
 * @returns {{ weekdayShort: string, dayNum: string, monthShort: string }}
 */
export function formatReviewCalendarParts(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return { weekdayShort: '', dayNum: '', monthShort: '' }
  const [, y, mo, d] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  return {
    weekdayShort: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(dt),
    dayNum: String(dt.getDate()),
    monthShort: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(dt),
  }
}

/** Short window label for compact calendar cards. */
export function formatReviewShortTimeLabel(wizard, { compact = false } = {}) {
  const w = wizard || {}
  if (w.arrivalWindow === 'exact' && w.exactArrivalTime) {
    return compact ? w.exactArrivalTime : `Exact ${w.exactArrivalTime}`
  }
  if (w.arrivalWindow === 'flex_window' && w.flexibleArrivalFrom && w.flexibleArrivalUntil) {
    return compact
      ? `${w.flexibleArrivalFrom}–${w.flexibleArrivalUntil}`
      : `${w.flexibleArrivalFrom} – ${w.flexibleArrivalUntil}`
  }
  return compact ? 'Flexible' : 'Flexible window'
}

export function formatReviewCalendarDate(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return '—'
  const [, y, mo, d] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

/** @param {string} isoDate */
export function parseIsoDateParts(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

/** @param {number} year @param {number} month 0–11 */
export function startOfMonthDate(year, month) {
  return new Date(year, month, 1)
}

/** @param {Date} date @param {number} deltaMonths */
export function addMonthsToDate(date, deltaMonths) {
  const d = new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1)
  return d
}

/** @param {number} year @param {number} month 0–11 */
export function formatReviewCalendarYear(year) {
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric' }).format(new Date(year, 0, 1))
}

/** @param {number} year @param {number} month 0–11 */
export function formatReviewCalendarMonthLabel(year, month) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(year, month, 1))
}

/**
 * Future bookable days in a calendar month (local), on or after today.
 * @param {number} year
 * @param {number} month 0–11
 * @returns {string[]}
 */
export function listBookableIsoDatesInMonth(year, month) {
  const today = getLocalDateYYYYMMDD()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dates = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const iso = `${year}-${mm}-${dd}`
    if (iso >= today) dates.push(iso)
  }
  return dates
}

/** Rolling bookable days from today (for compact horizontal scroll). */
export function listBookableIsoDatesAhead(maxDays = 42) {
  const today = getLocalDateYYYYMMDD()
  const dates = []
  let cursor = today
  for (let i = 0; i < maxDays; i += 1) {
    dates.push(cursor)
    const next = addDaysToIsoDate(cursor, 1)
    if (!next) break
    cursor = next
  }
  return dates
}

/**
 * @param {Record<string, unknown>} slice
 * @returns {string}
 */
function formatTimeLabel(slice) {
  return formatWizardArrivalSummary(slice)
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {Record<string, unknown>} arrivalSlice
 * @returns {string}
 */
/**
 * Stable key for Step 3 calendar pricing — excludes contact-only wizard fields so
 * typing in Step 3 does not re-run calculateQuote for every day in the month.
 * @param {Record<string, unknown>} wizard
 * @param {Array<Record<string, unknown>>} lineItems
 * @param {number} heavyItemCount
 * @param {string} serviceType
 */
export function getQuoteCalendarPricingKey(wizard, lineItems, heavyItemCount, serviceType) {
  const w = wizard || {}
  return JSON.stringify({
    serviceType,
    heavyItemCount,
    lineItems,
    moveDate: w.moveDate,
    arrivalWindow: w.arrivalWindow,
    exactArrivalTime: w.exactArrivalTime,
    flexibleArrivalFrom: w.flexibleArrivalFrom,
    flexibleArrivalUntil: w.flexibleArrivalUntil,
    distanceMiles: w.distanceMiles,
    mapboxRouteDurationSeconds: w.mapboxRouteDurationSeconds,
    pickupFloor: w.pickupFloor,
    deliveryFloor: w.deliveryFloor,
    pickupLift: w.pickupLift,
    deliveryLift: w.deliveryLift,
    walkingDistance: w.walkingDistance,
    parkingDistance: w.parkingDistance,
    stairsFlights: w.stairsFlights,
    packing: w.packing,
    packingApproxBoxes: w.packingApproxBoxes,
    packingFragile: w.packingFragile,
    packingMaterials: w.packingMaterials,
    dismantling: w.dismantling,
    dismantlingItemCount: w.dismantlingItemCount,
    reassembly: w.reassembly,
    reassemblyItemCount: w.reassemblyItemCount,
    reassemblySameAsDismantling: w.reassemblySameAsDismantling,
    promoCode: w.promoCode,
    packageTier: w.packageTier,
    crewSize: w.crewSize,
  })
}

/** @param {Record<string, unknown>} wizard */
export function getQuoteReviewSelectedOptionId(wizard) {
  const moveDate = String(wizard?.moveDate || '').trim()
  if (!moveDate) return ''
  return optionKey(moveDate, currentArrivalSlice(wizard))
}

function optionKey(moveDate, arrivalSlice) {
  const aw = arrivalSlice.arrivalWindow
  if (aw === 'exact') {
    return `${moveDate}|exact|${arrivalSlice.exactArrivalTime || ''}`
  }
  return `${moveDate}|flex|${arrivalSlice.flexibleArrivalFrom || ''}|${arrivalSlice.flexibleArrivalUntil || ''}`
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {Record<string, unknown>} arrivalSlice
 * @returns {Record<string, unknown>}
 */
function mergeWizardArrival(wizard, arrivalSlice) {
  return { ...wizard, ...arrivalSlice }
}

/**
 * @param {{
 *   settings: import('./pricingCalculator.js').PricingSettings,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   lineItems: Array<Record<string, unknown>>,
 *   heavyItemCount: number,
 *   moveDate: string,
 *   arrivalSlice: Record<string, unknown>,
 * }} params
 */
function priceForSlice({ settings, serviceType, wizard, lineItems, heavyItemCount, moveDate, arrivalSlice }) {
  const sliceWizard = mergeWizardArrival(wizard, { ...arrivalSlice, moveDate })
  const withPromoBreakdown = calculateQuote(
    settings,
    buildQuoteEngineInput({ serviceType, wizard: sliceWizard, lineItems, heavyItemCount }),
  )
  const estimatedTotal = Number.isFinite(withPromoBreakdown?.estimatedTotal)
    ? withPromoBreakdown.estimatedTotal
    : null

  let estimatedTotalWithoutPromo = null
  if (String(wizard.promoCode || '').trim()) {
    const withoutPromoBreakdown = calculateQuote(
      settings,
      buildQuoteEngineInput({
        serviceType,
        wizard: sliceWizard,
        lineItems,
        heavyItemCount,
        promoCode: '',
      }),
    )
    estimatedTotalWithoutPromo = Number.isFinite(withoutPromoBreakdown?.estimatedTotal)
      ? withoutPromoBreakdown.estimatedTotal
      : null
  }

  return { estimatedTotal, estimatedTotalWithoutPromo }
}

/**
 * @param {Record<string, unknown>} wizard
 * @returns {Record<string, unknown>}
 */
function currentArrivalSlice(wizard) {
  if (wizard.arrivalWindow === 'exact') {
    return {
      arrivalWindow: 'exact',
      exactArrivalTime: wizard.exactArrivalTime || EXACT_DEFAULT_TIME,
      flexibleArrivalFrom: '',
      flexibleArrivalUntil: '',
    }
  }
  return {
    arrivalWindow: FLEX_WINDOW,
    exactArrivalTime: '',
    flexibleArrivalFrom: wizard.flexibleArrivalFrom || FLEX_DEFAULT_FROM,
    flexibleArrivalUntil: wizard.flexibleArrivalUntil || FLEX_DEFAULT_UNTIL,
  }
}

/**
 * @param {{
 *   settings: import('./pricingCalculator.js').PricingSettings,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   lineItems: Array<Record<string, unknown>>,
 *   heavyItemCount: number,
 * }} params
 * @returns {Array<{
 *   id: string,
 *   moveDate: string,
 *   dayName: string,
 *   dateLabel: string,
 *   timeLabel: string,
 *   estimatedTotal: number | null,
 *   estimatedTotalWithoutPromo: number | null,
 *   arrivalPatch: Record<string, unknown>,
 *   isSelected: boolean,
 * }>}
 */
export function buildQuoteReviewPriceOptions({
  settings,
  serviceType,
  wizard,
  lineItems,
  heavyItemCount,
}) {
  if (!settings || !wizard?.moveDate || !isMoveDateOnOrAfterToday(wizard.moveDate)) {
    return []
  }

  const baseDate = String(wizard.moveDate).trim()
  const parts = parseIsoDateParts(baseDate)
  const today = getLocalDateYYYYMMDD()
  const dates = parts
    ? listBookableIsoDatesInMonth(parts.year, parts.month)
    : [baseDate].filter((d) => d >= today)

  return buildQuoteReviewPriceOptionsForDates({
    settings,
    serviceType,
    wizard,
    lineItems,
    heavyItemCount,
    dates,
  })
}

/**
 * @param {{
 *   settings: import('./pricingCalculator.js').PricingSettings,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   lineItems: Array<Record<string, unknown>>,
 *   heavyItemCount: number,
 *   year: number,
 *   month: number,
 * }} params month is 0–11
 */
export function buildQuoteReviewPriceOptionsForMonth({
  settings,
  serviceType,
  wizard,
  lineItems,
  heavyItemCount,
  year,
  month,
}) {
  if (!settings || !wizard?.moveDate || !isMoveDateOnOrAfterToday(wizard.moveDate)) {
    return []
  }

  const monthDates = listBookableIsoDatesInMonth(year, month)
  if (monthDates.length === 0) return []

  return buildQuoteReviewPriceOptionsForDates({
    settings,
    serviceType,
    wizard,
    lineItems,
    heavyItemCount,
    dates: monthDates,
  })
}

/** Compact Step 3 — scrollable day strip without month paging. */
export function buildQuoteReviewPriceOptionsForCompact({
  settings,
  serviceType,
  wizard,
  lineItems,
  heavyItemCount,
  daysAhead = 42,
}) {
  if (!settings || !wizard?.moveDate || !isMoveDateOnOrAfterToday(wizard.moveDate)) {
    return []
  }

  return buildQuoteReviewPriceOptionsForDates({
    settings,
    serviceType,
    wizard,
    lineItems,
    heavyItemCount,
    dates: listBookableIsoDatesAhead(daysAhead),
  })
}

/**
 * @param {{
 *   settings: import('./pricingCalculator.js').PricingSettings,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   lineItems: Array<Record<string, unknown>>,
 *   heavyItemCount: number,
 *   dates: string[],
 * }} params
 */
function buildQuoteReviewPriceOptionsForDates({
  settings,
  serviceType,
  wizard,
  lineItems,
  heavyItemCount,
  dates,
}) {
  const arrivalSlice = currentArrivalSlice(wizard)
  const options = []

  for (const moveDate of dates) {
    try {
      const id = optionKey(moveDate, arrivalSlice)
      const sliceWizard = mergeWizardArrival(wizard, { ...arrivalSlice, moveDate })
      const { estimatedTotal, estimatedTotalWithoutPromo } = priceForSlice({
        settings,
        serviceType,
        wizard,
        lineItems,
        heavyItemCount,
        moveDate,
        arrivalSlice,
      })

      options.push({
        id,
        moveDate,
        dayName: formatReviewDayName(moveDate),
        dateLabel: formatReviewCalendarDate(moveDate),
        timeLabel: formatTimeLabel(sliceWizard),
        estimatedTotal,
        estimatedTotalWithoutPromo,
        arrivalPatch: { moveDate },
      })
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[quoteReviewPriceOptions] skip date', moveDate, err)
      }
    }
  }

  options.sort((a, b) => {
    if (a.moveDate !== b.moveDate) return a.moveDate.localeCompare(b.moveDate)
    return (a.estimatedTotal ?? 0) - (b.estimatedTotal ?? 0)
  })

  return options
}

/**
 * Apply a Step 3 calendar card selection — updates move date only; keeps Step 1 arrival choice.
 * @param {Record<string, unknown>} wizard
 * @param {{ moveDate?: string }} arrivalPatch
 * @returns {Record<string, unknown>}
 */
export function applyQuoteReviewPriceSelection(wizard, arrivalPatch) {
  const moveDate = String(arrivalPatch?.moveDate || '').trim()
  if (!moveDate) return wizard
  return { ...wizard, moveDate }
}
