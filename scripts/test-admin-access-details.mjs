/**
 * Access details mapping: website summary text, phone-booking snapshot, and the older quote form.
 * Floor 0 and lift false are saved values. Missing keys stay "Not provided".
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { buildWizardFullSummaryText } = await import('../src/lib/emailQuotePayload.js')
const { appendWizardSnapshotToDetails } = await import('../src/lib/adminPhoneBookingWizardSnapshot.js')
const { ACCESS_NOT_PROVIDED, buildAdminJobQuoteDetailsViewModel, liftReadable } = await import(
  '../src/lib/adminJobQuoteDetailsViewModel.js'
)
const { adminEditBookingFormStateFromQuoteRow } = await import('../src/lib/adminEditBooking.js')

const missing = ACCESS_NOT_PROVIDED

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL', message)
    process.exitCode = 1
  }
}

function side(vm, which) {
  return vm.access[which]
}

const websiteDetails = buildWizardFullSummaryText({
  wizard: {
    fullName: 'Website Customer',
    email: 'web@example.com',
    phone: '07000000000',
    pickupAddress: '1 High Street, Leeds',
    deliveryAddress: '9 Park Lane, York',
    pickupPropertyType: 'Flat / apartment',
    deliveryPropertyType: '',
    pickupFloor: 0,
    deliveryFloor: 2,
    pickupLift: false,
    deliveryLift: false,
    parkingDistance: 'long',
    walkingDistance: 'short',
    stairsFlights: 0,
    stairsNotes: '',
    heavyNotes: 'Piano',
    specialInstructions: '',
    pickupFlatDetails: 'Code 1234',
    deliveryFlatDetails: '',
    inventoryLines: [],
  },
  serviceType: 'House Removals',
  quoteRef: 'SMH-TEST',
  breakdown: null,
})

const website = buildAdminJobQuoteDetailsViewModel({
  details: websiteDetails,
  pickup_address: '1 High Street, Leeds',
  delivery_address: '9 Park Lane, York',
})

assert(websiteDetails.includes('Floor: 0'), 'website summary keeps floor 0')
assert(!/Pickup property[\s\S]*Lift:/.test(websiteDetails.split('Delivery property')[0]), 'ground floor omits lift line')
assert(websiteDetails.includes('Lift: No'), 'delivery lift false is stored as No')

assert(side(website, 'pickup').propertyType === 'Flat / apartment', 'pickup property from website text')
assert(side(website, 'pickup').floor === 'Ground floor', 'floor 0 displays Ground floor')
assert(side(website, 'pickup').lift === missing, 'omitted ground-floor lift is Not provided')
assert(side(website, 'delivery').propertyType === missing, 'blank property is Not provided, not House')
assert(side(website, 'delivery').floor === '2nd Floor', 'numeric floor label')
assert(side(website, 'delivery').lift === 'No lift', 'saved lift No displays No lift')
assert(side(website, 'pickup').parking === 'Extended carry / awkward parking', 'parking label')
assert(side(website, 'delivery').parking === side(website, 'pickup').parking, 'shared parking on both cards')
assert(side(website, 'pickup').carryDistance === 'Short', 'carry distance')
assert(side(website, 'pickup').stairs === '0 flights', 'zero flights is saved')
assert(side(website, 'pickup').accessNotes === 'Code 1234\nPiano', 'access notes plus heavy notes')
assert(side(website, 'delivery').accessNotes === 'Piano', 'heavy notes still shown on delivery')
assert(side(website, 'pickup').specialInstructions === missing, 'empty special instructions are Not provided')
assert(website.access.allMissing === false, 'website booking is not the empty state')
assert(website.pickupFloor === 'Ground floor', 'legacy floor label')
assert(website.pickupLiftRaw === '—', 'omitted lift stays blank for overview chips')
assert(liftReadable(website.deliveryLiftRaw) === 'No', 'chip contract still maps saved No')

const phoneDetails = appendWizardSnapshotToDetails('Created by admin (phone)', {
  wizard: {
    pickupFloor: 0,
    pickupLift: false,
    deliveryFloor: 3,
    deliveryLift: true,
    parkingDistance: 'easy',
    stairsFlights: 2,
    stairsNotes: 'Narrow stairwell',
    specialInstructions: 'Call on arrival',
    pickupFlatDetails: 'Flat 4',
  },
  serviceType: 'House Removals',
})

const phone = buildAdminJobQuoteDetailsViewModel({ details: phoneDetails })
assert(side(phone, 'pickup').propertyType === missing, 'snapshot without property does not invent House')
assert(side(phone, 'pickup').floor === 'Ground floor', 'snapshot floor 0')
assert(side(phone, 'pickup').lift === 'No lift', 'snapshot lift false')
assert(side(phone, 'delivery').floor === '3rd Floor', 'snapshot delivery floor')
assert(side(phone, 'delivery').lift === 'Lift available', 'snapshot lift true')
assert(side(phone, 'pickup').parking === 'Easy — close to door', 'snapshot parking')
assert(side(phone, 'delivery').carryDistance === missing, 'missing carry distance is Not provided')
assert(side(phone, 'pickup').stairs === '2 flights\nNarrow stairwell', 'flights and stairs notes')
assert(side(phone, 'pickup').accessNotes === 'Flat 4', 'pickup access notes from snapshot')
assert(side(phone, 'delivery').accessNotes === missing, 'delivery notes absent')
assert(side(phone, 'pickup').specialInstructions === 'Call on arrival', 'special instructions from snapshot')
assert(!JSON.stringify(phone.access).includes('House'), 'hydrated House default is not displayed')
assert(!JSON.stringify(phone.access).includes('Standard street parking'), 'hydrated standard parking is not displayed')

const legacy = buildAdminJobQuoteDetailsViewModel({
  details: [
    '— Property / access —',
    'Pickup floor: 0',
    'Delivery floor: 1',
    'Lift available (pricing uses same value at both ends in this form): No',
    'Long walk / carry: No',
    'Awkward parking / extended carry: No',
    'Stairs flights (estimate): 0',
  ].join('\n'),
})
assert(side(legacy, 'pickup').floor === 'Ground floor', 'legacy floor 0')
assert(side(legacy, 'delivery').floor === '1st Floor', 'legacy delivery floor')
assert(side(legacy, 'pickup').lift === 'No lift', 'shared saved lift No')
assert(side(legacy, 'delivery').lift === 'No lift', 'shared lift applies to both ends')
assert(side(legacy, 'pickup').parking === 'No extended carry', 'awkward parking No is not shown as awkward')
assert(side(legacy, 'pickup').carryDistance === 'No long carry', 'long walk No is not dropped')
assert(side(legacy, 'pickup').stairs === '0 flights', 'legacy zero flights')
assert(side(legacy, 'pickup').propertyType === missing, 'legacy form has no property type')

const empty = buildAdminJobQuoteDetailsViewModel({ details: 'Created by admin from customer lead' })
assert(empty.access.allMissing === true, 'lead row without access fields is the compact empty state')
assert(side(empty, 'pickup').floor === missing, 'empty floor is Not provided')
assert(empty.pickupFloor === '—', 'legacy empty floor stays a dash for other screens')

const edited = adminEditBookingFormStateFromQuoteRow({
  details: websiteDetails,
  full_name: 'Website Customer',
  email: 'web@example.com',
  phone: '07000000000',
  pickup_address: '1 High Street, Leeds',
  delivery_address: '9 Park Lane, York',
  service: 'House Removals',
})
assert(edited.wizard.pickupFloor === 0, 'edit booking keeps ground floor')
assert(edited.wizard.deliveryFloor === 2, 'edit booking keeps delivery floor')
assert(edited.wizard.deliveryLift === false, 'edit booking keeps lift false')
assert(edited.wizard.pickupLift == null, 'omitted ground-floor lift is not invented as false')
assert(edited.wizard.parkingDistance === 'long', 'edit booking reads the parking label')
assert(edited.wizard.walkingDistance === 'short', 'edit booking reads carry distance')
assert(edited.wizard.stairsFlights === 0, 'edit booking keeps zero flights')
assert(edited.wizard.pickupPropertyType === 'Flat / apartment', 'edit booking reads property type')
assert(edited.wizard.heavyNotes === 'Piano', 'edit booking reads heavy notes')
assert(edited.wizard.pickupFlatDetails === 'Code 1234', 'edit booking reads pickup access notes')

if (process.exitCode) {
  console.error('Access details mapping checks failed')
} else {
  console.log('Access details mapping checks passed')
}
