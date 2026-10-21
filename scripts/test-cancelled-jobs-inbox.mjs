/**
 * Cancelled Jobs inbox must match the customer portal.
 * Run: node scripts/test-cancelled-jobs-inbox.mjs
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { filterActiveQuotes, filterCancelledQuotes } = await import('../src/lib/adminWorkflowFilters.js')
const { cancelledJobDisplayFields } = await import('../src/lib/adminTerminalJobsDisplay.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const cancelledWithJourneyStatus = {
  id: 'q-128411',
  quote_ref: 'SMH-2026-128411',
  full_name: 'Customer',
  email: 'customer@example.com',
  status: 'on_way',
  operational_status: 'Left for collection',
  marketplace_visibility: 'assigned',
  cancelled_at: '2026-10-20T10:00:00.000Z',
  assigned_driver_id: 'driver-1',
  assigned_driver_name: 'Driver',
  payment_status: 'paid',
}

const lowercaseStatus = {
  id: 'q-lower',
  quote_ref: 'SMH-2026-200001',
  full_name: 'Customer Two',
  status: 'cancelled',
  operational_status: 'Loading',
  marketplace_visibility: 'assigned',
  cancelled_at: null,
  payment_status: 'paid',
}

const stillActive = {
  id: 'q-active',
  quote_ref: 'SMH-2026-300001',
  full_name: 'Active Customer',
  status: 'Booked',
  operational_status: 'Assigned',
  marketplace_visibility: 'assigned',
  cancelled_at: null,
  assigned_driver_id: 'driver-1',
  assigned_driver_name: 'Driver',
  payment_status: 'paid',
}

const quotes = [cancelledWithJourneyStatus, lowercaseStatus, stillActive]
const cancelled = filterCancelledQuotes(quotes, [])
const active = filterActiveQuotes(quotes, [])

assert(cancelled.some((q) => q.quote_ref === 'SMH-2026-128411'), 'cancelled_at stays in Cancelled Jobs when the journey status is left behind')
assert(cancelled.some((q) => q.quote_ref === 'SMH-2026-200001'), 'lowercase cancelled status stays in Cancelled Jobs')
assert(!cancelled.some((q) => q.quote_ref === 'SMH-2026-300001'), 'an assigned booking stays out of Cancelled Jobs')
assert(!active.some((q) => q.quote_ref === 'SMH-2026-128411'), 'a cancelled booking does not stay in Job Accepted')
assert(active.some((q) => q.quote_ref === 'SMH-2026-300001'), 'an assigned booking stays in Job Accepted')
assert(
  cancelledJobDisplayFields(cancelledWithJourneyStatus).quoteRef === 'SMH-2026-128411',
  'the cancelled list shows the full job reference',
)

console.log('cancelled jobs inbox ok')
