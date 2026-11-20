import {
  CASH_PAID_MARK,
  cashInvoiceEligibility,
  cashInvoiceFigures,
  deliverCashPaidInvoice,
} from '../supabase/functions/_shared/cashPaidInvoicePolicy.js'
import { cashInvoiceSendAvailable } from '../src/lib/customerEmailArchive.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const settledCash = {
  email: 'customer@example.com',
  payment_type: 'cash',
  payment_status: 'unpaid',
  remaining_balance: 0,
  agreed_price: 180,
  estimated_total: 220,
  amount_paid: 180,
  pricing: 'Labour: £220\nDiscount: -£40\nEstimated total: £180',
}

const figures = cashInvoiceFigures(settledCash, [
  { method: 'card', amount: 50, collected_at: '2026-11-01T09:00:00Z' },
  { method: 'cash', amount: 130, collected_at: '2026-11-01T12:00:00Z' },
])
assert(figures.total === 180, 'invoice uses the saved final price, not the higher calculator total')
assert(figures.paid === 180, 'amount paid is the saved booking total')
assert(figures.cash === 130, 'cash line is the cash collected')
assert(figures.advance === 50, 'advance is the amount paid before the cash')
assert(figures.remaining === 0, 'a settled cash invoice has no balance')
assert(figures.discounts.length === 1 && /Discount/.test(figures.discounts[0]), 'saved discount line is kept')
assert(figures.paidAt === '2026-11-01T12:00:00Z', 'paid date follows the cash collection when paid_at is empty')
assert(CASH_PAID_MARK === 'PAID - Cash', 'invoice mark is PAID - Cash')

assert(cashInvoiceEligibility(settledCash, [{ method: 'cash', amount: 180 }]).ok, 'cash with a zero balance can be invoiced')
assert(
  cashInvoiceEligibility({ ...settledCash, remaining_balance: 40 }, [{ method: 'cash', amount: 10 }]).reason ===
    'balance_remaining',
  'a remaining balance does not invoice',
)
assert(
  cashInvoiceEligibility(
    { remaining_balance: 0, payment_type: 'card', payment_status: 'paid', stripe_payment_intent_id: 'pi_123' },
    [],
  ).reason === 'not_cash',
  'a Stripe payment does not take the cash invoice path',
)
assert(
  cashInvoiceEligibility({ remaining_balance: 0, payment_type: 'deposit' }, [{ method: 'cash', amount: 80 }]).ok,
  'cash that clears a deposit still invoices without a new Stripe payment',
)

assert(cashInvoiceSendAvailable(settledCash, null), 'admin can send when the cash invoice file is missing')
assert(
  !cashInvoiceSendAvailable(settledCash, { invoice_path: 'booking/cash-paid.pdf' }),
  'a saved cash invoice is not generated again from admin',
)
assert(
  !cashInvoiceSendAvailable({ ...settledCash, remaining_balance: 20 }, null),
  'admin cannot invoice an outstanding balance',
)
assert(
  !cashInvoiceSendAvailable({ remaining_balance: 0, payment_type: 'card', payment_status: 'paid' }, null),
  'admin does not offer a cash invoice for a card booking',
)

function harness(sendImpl) {
  const pdf = new Uint8Array([37, 80, 68, 70])
  const state = {
    status: '',
    stored: null,
    builds: 0,
    sends: [],
    archived: 0,
    repaired: 0,
    lastFigures: null,
  }
  const ctx = {
    loadQuote: async () => settledCash,
    loadCollections: async () => [{ method: 'cash', amount: 180, collected_at: '2026-11-01T12:00:00Z' }],
    loadNotification: async () => (state.status ? { delivery_status: state.status } : null),
    repairArchive: async () => {
      state.repaired += 1
    },
    readStoredPdf: async () => state.stored,
    buildPdf: async ({ figures: next }) => {
      state.builds += 1
      state.lastFigures = next
      return pdf
    },
    storePdf: async (bytes) => {
      state.stored = bytes
      return true
    },
    claim: async () => {
      if (state.status === 'sent') return { claimed: false, reason: 'already_sent' }
      state.status = 'pending'
      return { claimed: true }
    },
    sendEmail: async (input) => {
      state.sends.push(input.pdf)
      return sendImpl(state)
    },
    markFailed: async () => {
      state.status = 'failed'
    },
    markSent: async () => {
      state.status = 'sent'
    },
    archive: async () => {
      state.archived += 1
    },
  }
  return { state, ctx }
}

const failed = harness(() => ({ ok: false, error: 'email_failed' }))
const first = await deliverCashPaidInvoice(failed.ctx)
assert(first.ok === false && first.error === 'email_failed', 'a failed email stays retryable')
assert(failed.state.builds === 1 && failed.state.stored === failed.state.sends[0], 'the PDF is saved before the email')
assert(failed.state.status === 'failed' && failed.state.archived === 0, 'a failed email is not logged as sent')

failed.ctx.sendEmail = async (input) => {
  failed.state.sends.push(input.pdf)
  return { ok: true, resendId: 're_1' }
}
const second = await deliverCashPaidInvoice(failed.ctx)
assert(second.ok === true && second.resendId === 're_1', 'the same invoice can be sent after an email failure')
assert(failed.state.builds === 1, 'the retry uses the saved PDF')
assert(failed.state.sends[1] === failed.state.stored, 'the resent attachment is the original file')
assert(failed.state.status === 'sent' && failed.state.archived === 1, 'a successful send is logged once')

const third = await deliverCashPaidInvoice(failed.ctx)
assert(third.skipped === true && third.error === 'already_sent', 'a sent cash invoice is not emailed again')
assert(failed.state.builds === 1 && failed.state.sends.length === 2, 'a duplicate confirmation does not build or send')
assert(failed.state.repaired === 1, 'a missing archive pointer can be repaired without a new email')

const outstanding = harness(() => ({ ok: true }))
outstanding.ctx.loadQuote = async () => ({ ...settledCash, remaining_balance: 15 })
const held = await deliverCashPaidInvoice(outstanding.ctx)
assert(held.skipped === true && held.error === 'balance_remaining', 'confirmation with a balance does not invoice')
assert(outstanding.state.builds === 0 && outstanding.state.sends.length === 0, 'nothing is generated while money is outstanding')

console.log('cash invoice checks passed')
