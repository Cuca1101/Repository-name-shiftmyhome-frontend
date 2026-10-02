import { buildAdminBookingEmailPreview } from '../src/lib/adminBookingEmailPreview.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const preview = buildAdminBookingEmailPreview({
  id: 'job-1',
  quote_ref: 'SMH-TEST',
  full_name: 'Alex Example',
  phone: '07123456789',
  email: 'alex@example.com',
  pickup_address: '1 High Street, Glasgow',
  delivery_address: '2 High Street, Edinburgh',
  move_date: '2026-10-09',
  amount_paid: 50,
  estimated_total: 279.9,
  crew_size: 2,
  pricing: 'Volume: total 4.50 m³',
  inventory_text: 'Sofa ×1',
})

assert(preview.subject === 'New Booking Confirmed – SMH-TEST', 'subject matches the admin booking email')
assert(preview.html.includes('New booking confirmed'), 'title is the booking email')
assert(preview.html.includes('£50.00'), 'quoted price is the confirmed payment')
assert(preview.html.includes('Sofa'), 'inventory is in the preview')
assert(preview.html.includes('/admin/available-jobs/job-1'), 'admin link points at the job')
assert(!preview.html.includes('<script'), 'preview html has no script')

console.log('admin booking email preview ok')
