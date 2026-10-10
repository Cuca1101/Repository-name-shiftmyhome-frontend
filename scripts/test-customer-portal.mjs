/**
 * Customer portal rules: identity, expiry, price difference, failed payment, tracking, completed jobs.
 * Run: npm run test:customer-portal
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
async function load(rel) {
  return import(pathToFileURL(join(root, rel)).href)
}

const model = await load('src/lib/customerPortalModel.js')
const tracking = await load('src/lib/jobCustomerTracking.js')
const quote = await load('src/lib/customerPortalQuote.js')
const pricing = await load('src/lib/customerPortalPricing.js')
const defaults = await load('src/lib/defaultPricingSettings.js')
const wizardDefaults = await load('src/lib/quoteWizardDefaults.js')

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  }
}

const today = '2026-10-09'
const quoteA = { email: 'ada@example.com', status: 'Booked', payment_status: 'paid', amount_paid: 50, remaining_balance: 150 }
const quoteB = { email: 'ben@example.com', status: 'Booked' }

assert(model.customerOwnsBooking('Ada@Example.com', quoteA.email), 'same customer email matches')
assert(!model.customerOwnsBooking(quoteB.email, quoteA.email), 'another customer cannot open this booking')
assert(!model.customerOwnsBooking('', quoteA.email), 'missing session is not access')
assert(model.safePortalNext('https://evil.example/portal/bookings/1') === '/portal/bookings', 'external next url is rejected')
assert(model.safePortalNext('/portal/bookings/abc') === '/portal/bookings/abc', 'portal path is kept')

assert(model.classifyMagicLinkError('Email link is invalid or has expired') === 'expired', 'expired magic link')
assert(model.classifyMagicLinkError('otp_expired') === 'expired', 'otp expiry')
assert(model.classifyMagicLinkError('Token is invalid') === 'invalid', 'invalid magic link')

const started = model.jobModificationLock({ operational_status: 'On way' })
assert(started.locked && started.reason === 'started', 'started job cannot be edited')
const completed = model.jobModificationLock({ status: 'Completed', completed_at: '2026-10-01T12:00:00Z' })
assert(completed.locked && completed.reason === 'completed', 'completed job cannot be edited')
assert(!model.jobModificationLock({ status: 'Booked', operational_status: 'Assigned' }).locked, 'assigned job can still be edited')

const companyTel = '441414614813'
const storedDriver = {
  assigned_driver_id: 'driver-a',
  assigned_driver_name: 'Ann',
  assigned_driver_phone: '07111 111111',
}
const ann = model.resolveDriverContact(storedDriver)
assert(ann.state === 'ready' && ann.tel === '07111111111', 'driver call uses the assigned number')
assert(!ann.tel.includes(companyTel), 'driver call is not the company number')
const ben = model.resolveDriverContact(storedDriver, { ok: true, driver: { full_name: 'Ben', phone: '07222 222222' } })
assert(ben.tel === '07222222222' && ben.name === 'Ben', 'reassignment uses the new driver number')
const cleared = model.resolveDriverContact(storedDriver, { ok: true, driver: null })
assert(cleared.state === 'unassigned' && cleared.tel == null, 'removing the driver does not keep the old number')
const noPhone = model.resolveDriverContact({ assigned_driver_id: 'driver-a', assigned_driver_name: 'Ann' })
assert(noPhone.state === 'no_phone' && noPhone.tel == null, 'missing driver phone is not replaced with the company number')
assert(model.resolveDriverContact({}).state === 'unassigned', 'no assignment explains that no driver is assigned')

const increase = model.decideCustomerAmendment({
  quote: quoteA,
  previousTotal: 200,
  nextTotal: 230,
  inventoryChanged: true,
  dateAvailable: true,
})
assert(increase.outcome === 'pending_payment', 'price increase waits for payment')
assert(increase.chargeGbp === 30, 'only the difference is charged')
assert(increase.existingBalance === 150, 'existing balance stays separate')

const decrease = model.decideCustomerAmendment({
  quote: quoteA,
  previousTotal: 200,
  nextTotal: 170,
  inventoryChanged: true,
  dateAvailable: true,
})
assert(decrease.outcome === 'pending_approval' && decrease.reason === 'price_decrease', 'price drop needs approval')

const busy = model.decideCustomerAmendment({
  quote: { ...quoteA, assigned_driver_id: 'driver-1' },
  previousTotal: 200,
  nextTotal: 200,
  dateChanged: true,
  driverAssigned: true,
  driverBusy: true,
  dateAvailable: true,
})
assert(busy.outcome === 'pending_approval' && busy.reason === 'driver_busy', 'busy driver is not confirmed')

const full = model.decideCustomerAmendment({
  quote: quoteA,
  previousTotal: 200,
  nextTotal: 210,
  dateChanged: true,
  dateAvailable: false,
})
assert(full.outcome === 'unavailable', 'full day is not bookable')

const lockedChange = model.decideCustomerAmendment({
  quote: { status: 'completed', completed_at: '2026-10-01' },
  previousTotal: 200,
  nextTotal: 250,
  inventoryChanged: true,
})
assert(lockedChange.outcome === 'blocked' && lockedChange.reason === 'completed', 'completed change is blocked')

const patch = model.buildAppliedQuotePatch({
  proposed: {
    moveDate: '2026-10-20',
    arrivalWindow: 'Flexible window · 08:00–12:00',
    arrivalType: 'window',
    arrivalTime: '08:00–12:00',
    inventory: [{ name: 'Sofa', quantity: 2 }],
    inventoryText: 'Sofa × 2',
    crewSize: 2,
    total: 230,
  },
  amountPaid: 50,
  paymentDelta: 30,
  hadAgreedPrice: true,
})
assert(patch.amount_paid === 80, 'paid total adds only the difference')
assert(patch.remaining_balance === 150, 'unpaid balance is not collected again')
assert(patch.agreed_price === 230, 'agreed price follows the new total')
assert(!model.quotePatchTouchesCompletion(patch), 'completed status is not rewritten')
assert(patch.move_date === '2026-10-20' && patch.crew_size === 2, 'date and crew sync to admin and driver')

const addressBase = {
  moveDate: '2026-10-16',
  arrivalWindow: 'flex_window',
  flexibleArrivalFrom: '08:00',
  flexibleArrivalUntil: '10:00',
  inventoryLines: [{ name: 'Boxes', quantity: 8, m3: 0.15, mult: 1, weightType: 'light' }],
  pickupAddress: '12 Buchanan Street, Glasgow, G1 2FF',
  pickupHouseNumber: '12',
  pickupStreet: 'Buchanan Street',
  pickupTown: 'Glasgow',
  pickupPostcode: 'G1 2FF',
  pickupFlatDetails: '',
  deliveryAddress: '44 Byres Road, Glasgow, G12 8AE',
  deliveryHouseNumber: '44',
  deliveryStreet: 'Byres Road',
  deliveryTown: 'Glasgow',
  deliveryPostcode: 'G12 8AE',
  deliveryFlatDetails: '',
  distanceMiles: 2.4,
  pickupLng: -4.25,
  pickupLat: 55.86,
}
const addressEdit = quote.applyCustomerEdits(addressBase, {
  ...addressBase,
  addressEdit: true,
  distanceMiles: 0.1,
  pickupLng: 0,
  pickupLat: 0,
  deliveryHouseNumber: '10',
  deliveryStreet: 'Queen Street',
  deliveryTown: 'Glasgow',
  deliveryPostcode: 'G1 3DX',
  deliveryAddress: '10 Queen Street, Glasgow, G1 3DX',
}, '2026-10-09')
assert(addressEdit.ok && addressEdit.addressChanged, 'an address edit is a real change')
assert(addressEdit.wizard.distanceMiles === 2.4, 'client distance is ignored')
assert(addressEdit.wizard.pickupLng === -4.25, 'client coordinates are ignored')
assert(String(addressEdit.wizard.deliveryAddress).includes('10 Queen Street'), 'delivery address is updated')
const badPostcode = quote.applyCustomerEdits(addressBase, {
  ...addressBase,
  addressEdit: true,
  pickupPostcode: 'NOTAPOSTCODE',
}, '2026-10-09')
assert(!badPostcode.ok, 'an invalid postcode is rejected')
const startedAddress = model.decideCustomerAmendment({
  quote: { operational_status: 'on_way', payment_status: 'deposit_paid' },
  previousTotal: 480,
  nextTotal: 510,
  addressChanged: true,
  distanceChanged: true,
  driverAssigned: true,
})
assert(startedAddress.outcome === 'blocked', 'a started job cannot change address')
const routeApproval = model.decideCustomerAmendment({
  quote: { status: 'Booked', assigned_driver_id: 'driver-1', payment_status: 'deposit_paid' },
  previousTotal: 480,
  nextTotal: 510,
  addressChanged: true,
  distanceChanged: true,
  driverAssigned: true,
})
assert(routeApproval.outcome === 'pending_approval', 'a longer route with a driver waits for approval')
const addressPay = model.decideCustomerAmendment({
  quote: { status: 'Booked', payment_status: 'deposit_paid', amount_paid: 150, remaining_balance: 330, estimated_total: 480 },
  previousTotal: 480,
  nextTotal: 510,
  addressChanged: true,
  distanceChanged: true,
  driverAssigned: false,
})
assert(addressPay.outcome === 'pending_payment' && addressPay.chargeGbp === 30, 'an address price increase charges only the difference')
assert(addressPay.existingBalance === 330, 'the existing balance stays separate from the address charge')
const addressPatch = model.buildAppliedQuotePatch({
  proposed: {
    moveDate: '2026-10-16',
    arrivalWindow: 'Flexible window · 08:00–10:00',
    arrivalType: 'window',
    arrivalTime: '08:00–10:00',
    inventory: [],
    crewSize: 2,
    total: 510,
    addressChanged: true,
    pickupAddress: '12 Buchanan Street, Glasgow, G1 2FF',
    deliveryAddress: '10 Queen Street, Glasgow, G1 3DX',
    distanceMiles: 4.1,
  },
  amountPaid: 150,
  paymentDelta: 30,
  hadAgreedPrice: false,
})
assert(String(addressPatch.pickup_address).includes('Buchanan'), 'collection address is stored for admin, driver and tracking')
assert(String(addressPatch.delivery_address).includes('Queen Street'), 'delivery address is stored')
assert(addressPatch.distance_miles === 4.1, 'the server route distance is stored')
assert(addressPatch.amount_paid === 180, 'address payment adds only the difference')
assert(!model.quotePatchTouchesCompletion(addressPatch), 'an address update does not complete the job')
assert(!('status' in addressPatch), 'address update does not rewrite booking status')
const flatPatch = model.buildAppliedQuotePatch({
  proposed: {
    ...addressPatch && {
      moveDate: '2026-10-16',
      arrivalWindow: 'Flexible window · 08:00–10:00',
      arrivalType: 'window',
      arrivalTime: '08:00–10:00',
      inventory: [],
      crewSize: 2,
      total: 480,
      addressChanged: true,
      priceUnchanged: true,
      pickupAddress: '12 Buchanan Street, Flat 2, Glasgow, G1 2FF',
      deliveryAddress: '44 Byres Road, Glasgow, G12 8AE',
    },
  },
  amountPaid: 150,
  paymentDelta: 0,
  hadAgreedPrice: false,
})
assert(String(flatPatch.pickup_address).includes('Flat 2'), 'a flat correction is saved on the booking')
assert(!('estimated_total' in flatPatch) && !('amount_paid' in flatPatch), 'a flat correction does not reprice the booking')

const paidOk = model.resolvePaidAmendment({ locked: false, dateAvailable: true, driverNeedsReview: false })
assert(paidOk.applyToQuote && paidOk.status === 'applied', 'successful payment applies once availability is rechecked')
const paidLost = model.resolvePaidAmendment({ locked: false, dateAvailable: false, driverNeedsReview: false })
assert(!paidLost.applyToQuote && paidLost.quoteUnchanged, 'lost availability leaves the booking unchanged')
const paidStarted = model.resolvePaidAmendment({ locked: true, dateAvailable: true, driverNeedsReview: false })
assert(!paidStarted.applyToQuote && paidStarted.quoteUnchanged, 'a started job is not overwritten after payment')
const failedPay = model.resolveUnpaidOutcome('failed')
const abandonedPay = model.resolveUnpaidOutcome('abandoned')
assert(failedPay.quoteUnchanged && failedPay.status === 'payment_failed', 'failed payment does not change the booking')
assert(abandonedPay.quoteUnchanged && abandonedPay.status === 'abandoned', 'abandoned payment does not change the booking')
assert(model.amendmentAlreadySettled('applied'), 'an applied change is not charged again')

assert(model.dateSlotOpen({ dailyJobSlots: { 1: 1 } }, '2026-10-12', 1, '2026-10-12'), 'the booking already holding the slot can stay')
assert(!model.dateSlotOpen({ dailyJobSlots: { 1: 1 } }, '2026-10-12', 1, '2026-10-20'), 'a full day cannot take another booking')

assert(
  model.portalTrackingPresentation({ stage: 'awaiting_departure', gpsFresh: true, hasCoords: true }).awaitingStart,
  'before start the driver has not left for collection',
)
const staleGps = model.portalTrackingPresentation({ stage: 'en_route_collection', gpsFresh: false, hasCoords: true })
assert(staleGps.showLivePosition && !staleGps.live, 'a saved position still shows when GPS is delayed')
assert(
  !model.portalTrackingPresentation({ stage: 'en_route_collection', gpsFresh: false, hasCoords: false }).showLivePosition,
  'without coordinates the map stays hidden',
)
assert(
  model.portalTrackingPresentation({ stage: 'en_route_collection', gpsFresh: true, hasCoords: true }).showLivePosition,
  'fresh GPS can be shown after start',
)

const settings = defaults.getDefaultPricingSettings()
const pricedWizard = {
  ...wizardDefaults.initialWizardState(),
  moveDate: '2026-10-12',
  arrivalWindow: 'flex_window',
  flexibleArrivalFrom: '08:00',
  flexibleArrivalUntil: '12:00',
  distanceMiles: 12,
  crewSize: 2,
  pickupFloor: 0,
  deliveryFloor: 0,
  inventoryLines: [{ name: '3-seater sofa', quantity: 1, m3: 1.8, weightType: 'large', mult: 1 }],
}
const oneItem = pricing.pricePortalBooking({ settings, serviceType: 'House Removals', wizard: pricedWizard })
const manyItems = pricing.pricePortalBooking({
  settings,
  serviceType: 'House Removals',
  wizard: {
    ...pricedWizard,
    inventoryLines: [{ ...pricedWizard.inventoryLines[0], quantity: 20 }],
  },
})
assert(
  Number.isFinite(oneItem.total) && manyItems.total > oneItem.total,
  `same pricing engine charges more for more items (${oneItem.total} -> ${manyItems.total})`,
)

const monday = pricing.pricePortalBooking({ settings, serviceType: 'House Removals', wizard: pricedWizard })
const saturday = pricing.pricePortalBooking({
  settings,
  serviceType: 'House Removals',
  wizard: { ...pricedWizard, moveDate: '2026-10-10' },
})
assert(monday.total !== saturday.total, 'changing the date recalculates the price')

const edited = quote.applyCustomerEdits(
  {
    ...wizardDefaults.initialWizardState(),
    moveDate: '2026-10-20',
    arrivalWindow: 'flex_window',
    flexibleArrivalFrom: '09:00',
    flexibleArrivalUntil: '12:00',
    inventoryLines: [{ name: 'Armchair', quantity: 1, m3: 0.5, weightType: 'medium' }],
  },
  {
    moveDate: '2026-10-21',
    arrivalWindow: 'flex_window',
    flexibleArrivalFrom: '09:00',
    flexibleArrivalUntil: '12:00',
    inventoryLines: [
      { name: 'Armchair', quantity: 1, m3: 0.01 },
      { catalogId: 'sofa-3', name: '3-seater sofa', quantity: 1, m3: 0.01 },
    ],
  },
  today,
)
assert(edited.ok, 'a valid date and catalog item is accepted')
const sofa = edited.wizard.inventoryLines.find((line) => line.name === '3-seater sofa')
const chair = edited.wizard.inventoryLines.find((line) => line.name === 'Armchair')
assert(sofa && sofa.m3 > 1, 'new items use the catalog volume, not a client price')
assert(chair && chair.m3 === 0.5, 'existing item volume is kept')

const unknown = quote.applyCustomerEdits(edited.wizard, {
  ...edited.wizard,
  inventoryLines: [{ name: 'Not a real item', quantity: 1, m3: 0.1 }],
}, today)
assert(!unknown.ok, 'unknown items are rejected')

const past = quote.applyCustomerEdits(edited.wizard, { ...edited.wizard, moveDate: '2020-01-01' }, today)
assert(!past.ok, 'past dates are rejected')

assert(model.portalBookingGroup({ status: 'Booked' }) === 'upcoming', 'future booked job stays upcoming')
assert(model.portalBookingGroup({ operational_status: 'on_way' }) === 'in_progress', 'started job is in progress')
assert(model.portalBookingGroup({ status: 'completed' }) === 'history', 'completed job is history')
assert(
  model.jobModificationLock({ status: 'on_way', operational_status: 'On way', assignment_status: 'completed' }).reason === 'completed',
  'admin completed assignment is completed in the portal',
)
assert(
  model.portalBookingGroup({ status: 'on_way', operational_status: 'On way', assignment_status: 'Completed' }) === 'history',
  'completed assignment leaves the in-progress list',
)
assert(tracking.photoSectionForType('proof', 'DROPOFF') === 'delivery', 'dropoff proof photos show with delivery')
assert(tracking.photoSectionForType('proof', 'PICKUP') === 'pickup', 'pickup proof photos show with collection')
assert(tracking.photoSectionForType('pod_signature', 'DROPOFF') === 'waiver', 'delivery signature stays with the waiver')
assert(tracking.photoSectionForType('proof', '') === 'proof', 'proof photos without a stop stay visible')
assert(tracking.photoSectionForType('collection', 'PICKUP') === 'pickup', 'collection photos show as pickup')
assert(model.portalBookingGroup({ status: 'cancelled' }) === 'history', 'cancelled job is history')

const prefilled = model.portalContactPrefill(
  { fullName: 'Typed Name', phone: '', email: '' },
  { fullName: 'Saved Name', phone: '07000000000', email: 'ada@example.com' },
)
assert(prefilled.fullName === 'Typed Name', 'a typed name is kept for the customer to check')
assert(prefilled.phone === '07000000000' && prefilled.email === 'ada@example.com', 'blank contact fields are filled from the account')
const withAddress = model.portalContactPrefill(
  { pickupAddress: '', deliveryAddress: 'Keep this delivery' },
  { savedAddress: '10 Saved Street, Glasgow' },
)
assert(withAddress.pickupAddress === '10 Saved Street, Glasgow', 'a saved profile address can start a new booking')
assert(withAddress.deliveryAddress === 'Keep this delivery', 'a saved profile address does not replace the delivery address')
const keptAddress = model.portalContactPrefill(
  { pickupAddress: 'Already typed' },
  { savedAddress: '10 Saved Street, Glasgow' },
)
assert(keptAddress.pickupAddress === 'Already typed', 'a typed collection address is kept')
const passwordBody = model.passwordUpdateBody('secret-pass')
assert(Object.keys(passwordBody).join(',') === 'password', 'password updates do not send a role')

const sql = readFileSync(join(root, 'supabase/migrations/118_customer_portal.sql'), 'utf8')
assert(sql.includes("lower(trim(coalesce(q.email, ''))) = v_email"), 'booking reads are limited to the signed-in email')
assert(sql.includes('customer_portal_email'), 'portal identity comes from the auth token')
assert(!/grant update on public\.quotes to anon/i.test(sql), 'portal migration does not open quote updates to anonymous users')
assert(sql.includes('customer_booking_amendments_one_open'), 'one open change per booking')

const realBookingsSql = readFileSync(join(root, 'supabase/migrations/120_customer_portal_real_bookings.sql'), 'utf8')
assert(realBookingsSql.includes('coalesce(q.is_test, false) = false'), 'portal bookings are the real admin rows')
assert(realBookingsSql.includes('q.quote_ref'), 'the portal keeps the stored booking reference')

const customersSql = readFileSync(join(root, 'supabase/migrations/119_customers.sql'), 'utf8')
assert(customersSql.includes('customers_email_key'), 'one customer file per email')
assert(customersSql.includes('auth_is_admin_session()'), 'customer files are admin-only')
assert(!/insert into public\.customer_leads/i.test(customersSql), 'customer files do not write leads')
assert(!/update public\.customer_leads/i.test(customersSql), 'customer files do not change leads')
assert(customersSql.includes('sync_customer_from_booking'), 'a booking creates or updates the customer file')

const authSource = readFileSync(join(root, 'supabase/functions/_shared/customerPortalMagicLink.ts'), 'utf8')
assert(!authSource.includes('user_metadata'), 'magic link and password reset do not assign a role')
assert(authSource.includes("'recovery'"), 'password reset uses the same auth user as the email link')

const quoteInsert = readFileSync(join(root, 'src/lib/data/quotesRepository.js'), 'utf8')
assert(
  quoteInsert.includes('isSupabasePublicConfigured && supabasePublic'),
  'a new booking from an account still uses the public quote insert',
)

if (failed) {
  console.error(`\n${failed} customer portal test(s) failed`)
  process.exit(1)
}
console.log('Customer portal tests passed')
