/** Customer quote wizard: Address → Items & contact → Review → Pay */
export const QUOTE_WIZARD_MAX_STEP = 4

/** Canonical booking / quote reference: SMH-YYYY-NNNNNN */
export function isCanonicalQuoteRef(ref) {
  return /^SMH-\d{4}-\d{6}$/i.test(String(ref || '').trim())
}

export function makeQuoteRef() {
  const y = new Date().getFullYear()
  const n = Math.floor(100000 + Math.random() * 900000)
  return `SMH-${y}-${n}`
}

/**
 * Prefer an existing SMH-YYYY-NNNNNN; never reuse RESUME-*, SMH-LEAD-*, or SMH-REC-*.
 * @param {unknown} existing
 */
export function resolveBookingQuoteRef(existing) {
  const raw = String(existing || '').trim()
  if (isCanonicalQuoteRef(raw)) return raw
  return makeQuoteRef()
}

export function initialWizardState() {
  return {
    pickupAddress: '',
    deliveryAddress: '',
    pickupAddressConfirmed: false,
    deliveryAddressConfirmed: false,
    pickupLng: null,
    pickupLat: null,
    deliveryLng: null,
    deliveryLat: null,
    pickupPlaceId: '',
    pickupHouseNumber: '',
    pickupStreet: '',
    pickupTown: '',
    pickupPostcode: '',
    pickupCountry: '',
    deliveryPlaceId: '',
    deliveryHouseNumber: '',
    deliveryStreet: '',
    deliveryTown: '',
    deliveryPostcode: '',
    deliveryCountry: '',
    pickupPropertyType: 'House',
    deliveryPropertyType: 'House',
    pickupFloor: null,
    deliveryFloor: null,
    pickupLift: null,
    deliveryLift: null,
    /** Confirmed lift fit for special-stair items (e.g. piano); lift Yes alone is not enough. */
    pickupLiftSuitableForSpecialItems: null,
    deliveryLiftSuitableForSpecialItems: null,
    distanceMiles: 0,
    /** Mapbox Directions API `route.duration` (seconds) for crew labour pricing. */
    mapboxRouteDurationSeconds: null,
    moveDate: '',
    arrivalWindow: '',
    exactArrivalTime: '',
    flexibleArrivalFrom: '',
    flexibleArrivalUntil: '',
    inventoryLines: [],
    packing: false,
    packingWhat: '',
    /** Mobile/desktop materials stepper lines (separate from packing service notes). */
    packingMaterialsDetail: '',
    packingApproxBoxes: 0,
    packingFragile: false,
    packingMaterials: false,
    dismantling: false,
    dismantlingWhat: '',
    dismantlingItemCount: 0,
    reassembly: false,
    reassemblyWhat: '',
    reassemblyItemCount: 0,
    reassemblySameAsDismantling: false,
    parkingDistance: 'standard',
    walkingDistance: 'standard',
    stairsFlights: 0,
    stairsNotes: '',
    heavyNotes: '',
    specialInstructions: '',
    crewSize: null,
    vehicleSize: '',
    fullName: '',
    phone: '',
    email: '',
    pickupContactSameAsCustomer: true,
    deliveryContactSameAsCustomer: true,
    dropoffSameAsPickup: true,
    pickupContactName: '',
    pickupContactPhone: '',
    deliveryContactName: '',
    deliveryContactPhone: '',
    pickupFlatDetails: '',
    deliveryFlatDetails: '',
    pickupApartment: '',
    deliveryApartment: '',
    pickupReviewStamp: '',
    deliveryReviewStamp: '',
    promoCode: '',
    packageTier: 'standard',
  }
}
