export function makeQuoteRef() {
  const y = new Date().getFullYear()
  const n = Math.floor(100000 + Math.random() * 900000)
  return `SMH-${y}-${n}`
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
    pickupPropertyType: 'House',
    deliveryPropertyType: 'House',
    pickupFloor: null,
    deliveryFloor: null,
    pickupLift: null,
    deliveryLift: null,
    distanceMiles: 0,
    moveDate: '',
    arrivalWindow: '',
    exactArrivalTime: '',
    flexibleArrivalFrom: '',
    flexibleArrivalUntil: '',
    inventoryLines: [],
    packing: false,
    packingWhat: '',
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
  }
}
