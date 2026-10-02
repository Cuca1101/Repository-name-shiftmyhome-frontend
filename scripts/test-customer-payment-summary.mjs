import { resolveCustomerPaymentSummary } from '../src/lib/customerPaymentSummary.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const deposit = resolveCustomerPaymentSummary({
  id: 'deposit-job',
  quote_ref: 'SMH-2026-109651',
  payment_status: 'deposit_paid',
  payment_type: 'deposit',
  amount_paid: '50',
  estimated_total: '279.9',
  remaining_balance: '0',
  stripe_payment_intent_id: 'pi_deposit',
})
assert(deposit.label === 'Deposit paid', 'deposit is not paid in full')
assert(deposit.tone === 'orange', 'deposit is orange')
assert(deposit.total === 279.9, 'deposit total is the quote total')
assert(deposit.paid === 50, 'deposit paid is 50')
assert(deposit.remaining === 229.9, 'deposit balance is 229.90')

const doubled = resolveCustomerPaymentSummary(
  {
    id: 'deposit-job',
    payment_status: 'deposit_paid',
    payment_type: 'deposit',
    amount_paid: 50,
    estimated_total: 279.9,
    remaining_balance: 0,
    stripe_payment_intent_id: 'pi_deposit',
  },
  {
    payments: [
      { id: 'pi_deposit', amountGbp: 50 },
      { id: 'pi_deposit', amountGbp: 50 },
    ],
  },
)
assert(doubled.paid === 50, 'the same Stripe payment is counted once')
assert(doubled.label === 'Deposit paid', 'duplicate logs stay deposit paid')

const full = resolveCustomerPaymentSummary({
  payment_status: 'paid',
  payment_type: 'full',
  amount_paid: '99.89',
  estimated_total: '99.89',
  remaining_balance: '0',
  stripe_payment_intent_id: 'pi_full',
})
assert(full.label === 'Paid in full', 'matching receipt is paid in full')
assert(full.tone === 'emerald', 'paid in full is green')
assert(full.paid === 99.89, 'full amount paid')
assert(full.remaining === 0, 'full payment has no balance')

const manual = resolveCustomerPaymentSummary({
  id: 'phone-1',
  payment_status: 'unpaid',
  amount_paid: 40,
  estimated_total: 120,
  stripe_payment_intent_id: '',
})
assert(manual.label === 'Partially paid', 'a manual amount below the total is partial')
assert(manual.paid === 40, 'manual amount is included')
assert(manual.remaining === 80, 'manual balance is the rest')

const refunded = resolveCustomerPaymentSummary(
  {
    payment_status: 'paid',
    payment_type: 'full',
    amount_paid: 100,
    estimated_total: 100,
    stripe_payment_intent_id: 'pi_full',
  },
  { refunds: [{ id: 're_1', amountGbp: 20 }, { id: 're_1', amountGbp: 20 }] },
)
assert(refunded.paid === 80, 'a refund is subtracted once')
assert(refunded.label === 'Partially paid', 'a refunded full payment is partial')

const alreadyNet = resolveCustomerPaymentSummary(
  {
    payment_status: 'paid',
    payment_type: 'full',
    amount_paid: 80,
    estimated_total: 100,
    stripe_payment_intent_id: 'pi_full',
  },
  {
    payments: [{ id: 'pi_full', amountGbp: 100 }],
    refunds: [{ id: 're_1', amountGbp: 20 }],
  },
)
assert(alreadyNet.paid === 80, 'a refund already inside amount_paid is not subtracted twice')

const none = resolveCustomerPaymentSummary({
  payment_status: 'unpaid',
  amount_paid: 0,
  estimated_total: 150,
  remaining_balance: 0,
})
assert(none.label === 'Unpaid', 'no confirmed payment is unpaid')
assert(none.paid === 0, 'unpaid has no receipt')
assert(none.remaining === 150, 'unpaid balance is the total')

const fullJob = resolveCustomerPaymentSummary({
  agreed_price: null,
  payment_status: 'paid',
  payment_type: 'full',
  amount_paid: '99.89',
  estimated_total: '99.89',
  remaining_balance: '0',
})
assert(fullJob.total === 99.89, 'empty agreed price is not a zero total')
assert(fullJob.paid === 99.89, 'full job paid amount')
assert(fullJob.remaining === 0, 'full job balance is zero')
assert(fullJob.label === 'Paid in full', 'full job label')

const depositJob = resolveCustomerPaymentSummary({
  agreed_price: null,
  payment_status: 'deposit_paid',
  payment_type: 'deposit',
  amount_paid: '50',
  estimated_total: '279.9',
  remaining_balance: '0',
})
assert(depositJob.total === 279.9, 'deposit job total stays the quote price')
assert(depositJob.paid === 50, 'deposit job paid amount')
assert(depositJob.remaining === 229.9, 'deposit job balance is the remainder')
assert(depositJob.label === 'Deposit paid', 'deposit job label')

const storedNullTotals = resolveCustomerPaymentSummary({
  agreed_price: null,
  calculated_total: null,
  payment_status: 'deposit_paid',
  payment_type: 'deposit',
  amount_paid: '50',
  estimated_total: '279.9',
  remaining_balance: '0',
  quote_ref: 'SMH-2026-109651',
})
assert(storedNullTotals.total === 279.9, 'null calculated total does not become zero')
assert(storedNullTotals.paid === 50, 'deposit receipt stays 50')
assert(storedNullTotals.remaining === 229.9, 'SMH-2026-109651 balance is 229.90')

console.log('customer payment summary ok')
