/**
 * Customer lead session rotation + status reopen rules.
 * Run: node scripts/test-customer-lead-session.mjs
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { maxCustomerLeadStatus } = await import('../src/lib/customerLeadStatus.js')
const { buildCustomerLeadUpsertPayload } = await import('../src/lib/customerLeadCapture.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

console.log('=== maxCustomerLeadStatus reopen ===')

assert(
  maxCustomerLeadStatus('abandoned', 'quote_started') === 'quote_started',
  'abandoned reopens to quote_started',
)
assert(
  maxCustomerLeadStatus('payment_failed', 'quote_viewed') === 'quote_viewed',
  'payment_failed reopens to quote_viewed',
)
assert(
  maxCustomerLeadStatus('abandoned', 'payment_failed') === 'payment_failed',
  'abandoned + payment_failed stays payment_failed',
)
assert(
  maxCustomerLeadStatus('converted_to_booking', 'quote_started') === 'converted_to_booking',
  'converted stays locked',
)
assert(
  maxCustomerLeadStatus('quote_started', 'quote_viewed') === 'quote_viewed',
  'normal funnel progress',
)

console.log('=== payload status for continue vs new ===')

const abandonedPayload = buildCustomerLeadUpsertPayload({
  step: 3,
  quoteRef: 'SMH-TEST-1',
  serviceType: 'House Removals',
  wizard: {
    pickupAddress: '1 Test St, Dundee',
    deliveryAddress: '2 High St, Aberdeen',
    fullName: 'Test User',
    email: 'test@example.com',
    phone: '07123456789',
    moveDate: '2026-09-01',
  },
  sourcePageUrl: 'https://www.shiftmyhome.co.uk/quote',
  currentStatus: 'abandoned',
  paymentPhase: 'none',
})

assert(
  abandonedPayload.status === 'quote_viewed',
  `resume from abandoned should derive quote_viewed, got ${abandonedPayload.status}`,
)

const sameStepPayload = buildCustomerLeadUpsertPayload({
  step: 2,
  quoteRef: 'SMH-TEST-1',
  serviceType: 'House Removals',
  wizard: {
    pickupAddress: '1 Test St, Dundee',
    deliveryAddress: '2 High St, Aberdeen',
    fullName: 'Test User',
    email: 'test@example.com',
    phone: '07123456789',
  },
  sourcePageUrl: 'https://www.shiftmyhome.co.uk/quote',
  currentStatus: 'quote_started',
  paymentPhase: 'none',
})

assert(
  sameStepPayload.status === 'quote_started',
  'continuing same quote keeps progressive status',
)

console.log('PASS: customer lead session / status rules')
