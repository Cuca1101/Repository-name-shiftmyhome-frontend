import {
  CASH_PAID_MARK,
  balanceSettledInvoiceEligibility,
  cardSettledInvoiceEligibility,
  cashInvoiceEligibility,
  cashInvoiceFigures,
  completionInvoiceEligibility,
  deliverCashPaidInvoice,
  invoiceSummaryLines,
  manualInvoiceEligibility,
  settledInvoiceFigures,
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
  'a card booking with no recorded amount is not offered an invoice',
)
const paidOneSeventy = {
  remaining_balance: 0,
  payment_type: 'card',
  payment_status: 'unpaid',
  amount_paid: 170,
  agreed_price: 170,
  quote_ref: 'SMH-2026-304234',
  email: 'customer@example.com',
}
assert(
  cashInvoiceSendAvailable(paidOneSeventy, null),
  'a settled card payment with no saved invoice can be sent from the button',
)
const bankPaid = {
  remaining_balance: 0,
  payment_type: 'bank_transfer',
  payment_status: 'unpaid',
  amount_paid: 170,
  agreed_price: 170,
  email: 'customer@example.com',
  quote_ref: 'SMH-2026-304234',
}
const bankRows = [{ method: 'bank_transfer', amount: 170, collected_at: '2026-11-16T21:28:24.338Z' }]
assert(cashInvoiceSendAvailable(bankPaid, null, bankRows), 'the £170 bank transfer shows the send button')
assert(
  !cashInvoiceSendAvailable(bankPaid, { invoice_path: 'booking/paid.pdf' }, bankRows),
  'a saved bank invoice is not sent again',
)
const bankFigures = settledInvoiceFigures(bankPaid, bankRows)
assert(bankFigures.kind === 'bank_transfer' && bankFigures.paid === 170 && bankFigures.total === 170, 'the invoice is for the £170 bank transfer')
assert(bankFigures.paidAt === '2026-11-16T21:28:24.338Z', 'the invoice date follows the bank collection')
assert(invoiceSummaryLines(bankFigures)[0] === 'Amount paid: GBP 170.00', 'the invoice line is the amount paid')
assert(manualInvoiceEligibility(bankPaid, bankRows).ok, 'the admin button can email the bank transfer invoice')
const cardFigures = settledInvoiceFigures(paidOneSeventy, [{ method: 'card', amount: 170 }])
assert(cardFigures.kind === 'card' && cardFigures.paid === 170 && cardFigures.total === 170, 'card figures still record the amount paid')
assert(invoiceSummaryLines(cardFigures)[0] === 'Amount paid: GBP 170.00', 'a card figure is not labelled as cash received')
assert(manualInvoiceEligibility(paidOneSeventy, [{ method: 'card', amount: 170 }]).ok, 'the admin button can email a settled card payment')
assert(
  cashInvoiceEligibility(paidOneSeventy, [{ method: 'card', amount: 170 }]).reason === 'not_cash',
  'an automatic cash run still ignores a card payment',
)
assert(
  cashInvoiceSendAvailable(
    { remaining_balance: 0, payment_type: 'deposit', payment_status: 'paid' },
    null,
    [{ method: 'cash', amount: 80 }],
  ),
  'cash that clears a deposit can still be sent from admin',
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

const blocked = harness(() => ({ ok: true }))
blocked.ctx.loadQuote = async () => paidOneSeventy
blocked.ctx.loadCollections = async () => [{ method: 'card', amount: 170 }]
const refused = await deliverCashPaidInvoice(blocked.ctx)
assert(refused.error === 'not_cash' && blocked.state.sends.length === 0, 'a card payment is not emailed by the automatic cash run')

const card = harness(() => ({ ok: true, resendId: 're_170' }))
card.ctx.manual = true
card.ctx.loadQuote = async () => paidOneSeventy
card.ctx.loadCollections = async () => [{ method: 'card', amount: 170 }]
const cardSent = await deliverCashPaidInvoice(card.ctx)
assert(cardSent.ok === true && cardSent.resendId === 're_170', 'pressing send emails a settled card invoice')
assert(card.state.sends.length === 1 && card.state.lastFigures.paid === 170, 'the emailed invoice is for 170')

const bank = harness(() => ({ ok: true, resendId: 're_bank' }))
bank.ctx.manual = true
bank.ctx.loadQuote = async () => bankPaid
bank.ctx.loadCollections = async () => bankRows
const bankSent = await deliverCashPaidInvoice(bank.ctx)
assert(bankSent.ok === true && bank.state.lastFigures.kind === 'bank_transfer', 'pressing send emails the £170 bank transfer invoice')
assert(bank.state.sends.length === 1, 'the bank transfer email is sent once')

const completedCash = {
  ...settledCash,
  status: 'completed',
  completed_at: '2026-11-16T21:28:43.647Z',
  remaining_balance: 0,
}
assert(completionInvoiceEligibility(completedCash, [{ method: 'cash', amount: 180 }]).ok, 'a completed cash job with a zero balance is invoiced')
assert(
  completionInvoiceEligibility({ ...completedCash, completed_at: null, status: 'accepted' }, [{ method: 'cash', amount: 180 }]).reason ===
    'not_completed',
  'cash is not invoiced before the driver marks the job completed',
)
assert(
  completionInvoiceEligibility({ ...completedCash, remaining_balance: 20 }, [{ method: 'cash', amount: 10 }]).reason ===
    'balance_remaining',
  'a completed cash job with a balance is not invoiced',
)
assert(
  completionInvoiceEligibility({ ...paidOneSeventy, completed_at: '2026-11-16T16:12:25Z', status: 'completed' }, [
    { method: 'card', amount: 170 },
  ]).reason === 'not_cash',
  'completing a card job does not use the cash completion invoice',
)

const cardQuote = {
  ...paidOneSeventy,
  payment_type: 'card',
  stripe_payment_intent_id: 'pi_card',
  remaining_balance: 0,
  amount_paid: 170,
}
assert(cardSettledInvoiceEligibility(cardQuote, [{ method: 'card', amount: 170 }]).ok, 'a card payment with a zero balance is invoiced')
assert(
  cardSettledInvoiceEligibility({ ...cardQuote, remaining_balance: 40 }, []).reason === 'balance_remaining',
  'a card booking with a balance is not invoiced',
)
assert(
  cardSettledInvoiceEligibility({ ...cardQuote, payment_confirmation_email_sent_at: '2026-11-16T12:00:00Z' }, []).reason ===
    'already_sent',
  'a Stripe receipt is not emailed a second time',
)
assert(cardSettledInvoiceEligibility(completedCash, [{ method: 'cash', amount: 180 }]).reason === 'not_card', 'cash is not treated as a card invoice')

const depositSettled = {
  email: 'customer@example.com',
  payment_type: 'deposit',
  payment_status: 'paid',
  remaining_balance: 0,
  agreed_price: 320,
  amount_paid: 320,
  payment_confirmation_email_sent_at: '2026-11-20T14:05:00Z',
  stripe_payment_intent_id: 'pi_deposit',
}
assert(
  balanceSettledInvoiceEligibility(depositSettled, []).ok,
  'paying the balance after the reservation fee sends the second invoice',
)
assert(
  balanceSettledInvoiceEligibility({ ...depositSettled, remaining_balance: 270, amount_paid: 50 }, []).reason ===
    'balance_remaining',
  'the reservation fee alone does not send the paid-in-full invoice',
)
assert(
  balanceSettledInvoiceEligibility({ ...depositSettled, payment_type: 'full' }, []).reason === 'not_deposit',
  'a booking paid in full at the start does not get this second invoice',
)

const balancePaid = harness(() => ({ ok: true, resendId: 're_balance' }))
balancePaid.ctx.onBalanceSettled = true
balancePaid.ctx.loadQuote = async () => depositSettled
const balanceSent = await deliverCashPaidInvoice(balancePaid.ctx)
assert(balanceSent.ok === true && balanceSent.resendId === 're_balance', 'the balance payment emails the paid invoice')
assert(balancePaid.state.lastFigures.kind === 'card' && balancePaid.state.lastFigures.paid === 320, 'the second invoice is the full card amount')

const onComplete = harness(() => ({ ok: true, resendId: 're_done' }))
onComplete.ctx.onCompleted = true
onComplete.ctx.loadQuote = async () => completedCash
onComplete.ctx.loadCollections = async () => [{ method: 'cash', amount: 180, collected_at: '2026-11-16T21:28:24Z' }]
const completedSend = await deliverCashPaidInvoice(onComplete.ctx)
assert(completedSend.ok === true && completedSend.resendId === 're_done', 'marking a settled cash job completed sends the invoice')

console.log('cash invoice checks passed')
