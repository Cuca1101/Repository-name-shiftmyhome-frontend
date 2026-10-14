// Run: node --experimental-strip-types --no-warnings --test scripts/test-payment-processing.mjs
// Exercises the real edge-function payment helpers against an in-memory Supabase double.
import test from 'node:test'
import assert from 'node:assert/strict'
import { updateQuoteFromCheckoutSession } from '../supabase/functions/_shared/updateQuoteFromCheckoutSession.ts'
import { updateQuoteFromPaymentIntent } from '../supabase/functions/_shared/updateQuoteFromPaymentIntent.ts'

function fakeSupabase(seed) {
  const db = {
    quotes: [],
    customer_leads: [],
    quote_inventory_items: [],
    admin_activity_logs: [],
    jobs: [],
    ...structuredClone(seed),
  }
  const rpcCalls = []

  function builder(table) {
    const state = { op: 'select', filters: [], patch: null, rows: null, returning: false, head: false }
    const matches = (row) =>
      state.filters.every(([kind, col, val]) => {
        if (kind === 'is') return row[col] == null
        if (val === '[]') return JSON.stringify(row[col]) === '[]'
        return row[col] === val
      })
    const exec = () => {
      const rows = db[table]
      if (state.op === 'insert') {
        const list = Array.isArray(state.rows) ? state.rows : [state.rows]
        for (const r of list) rows.push({ id: `${table}-${rows.length + 1}`, ...r })
        return { data: null, error: null }
      }
      const hit = rows.filter(matches)
      if (state.op === 'update') {
        for (const r of hit) Object.assign(r, structuredClone(state.patch))
        return { data: state.returning ? hit.map((r) => ({ id: r.id })) : null, error: null }
      }
      return { data: state.head ? null : hit.map((r) => ({ ...r })), count: hit.length, error: null }
    }
    const api = {
      select(_cols, opts) {
        if (state.op === 'select') state.head = Boolean(opts?.head)
        else state.returning = true
        return api
      },
      update(patch) {
        state.op = 'update'
        state.patch = patch
        return api
      },
      insert(rows) {
        state.op = 'insert'
        state.rows = rows
        return api
      },
      eq(col, val) {
        state.filters.push(['eq', col, val])
        return api
      },
      is(col) {
        state.filters.push(['is', col])
        return api
      },
      async maybeSingle() {
        const res = exec()
        const data = Array.isArray(res.data) ? res.data[0] ?? null : res.data
        return { data, error: null }
      },
      then(resolve, reject) {
        return Promise.resolve(exec()).then(resolve, reject)
      },
    }
    return api
  }

  return {
    db,
    rpcCalls,
    from: (table) => builder(table),
    rpc: async (name, args) => {
      rpcCalls.push({ name, args })
      return { data: 1, error: null }
    },
  }
}

const QUOTE_ID = '67341d65-e3d9-4468-876a-c2117a8366ab'
const LEAD_ID = '2f3d7bef-5214-43c5-ab2e-d004da029d9e'
const leadRow = {
  id: LEAD_ID,
  quote_id: QUOTE_ID,
  total_volume_m3: 10.05,
  wizard_data: {
    step2: {
      inventoryLines: [
        { name: '2-seater sofa', categoryLabel: 'Living areas', quantity: 1, m3: 1.2, mult: 1, weightType: 'large' },
        { name: 'Armchair', categoryLabel: 'Living areas', quantity: 2, m3: 0.5, mult: 1, weightType: 'medium' },
      ],
    },
  },
}
const recoveryQuote = (over = {}) => ({
  id: QUOTE_ID,
  quote_ref: 'SMH-2026-196769',
  status: 'New',
  payment_status: 'unpaid',
  amount_paid: 0,
  agreed_price: 400,
  estimated_total: 400,
  remaining_balance: 400,
  inventory: [],
  pricing: null,
  paid_at: null,
  stripe_payment_intent_id: null,
  ...over,
})
// Old recovery session: metadata on the session only, none on the PaymentIntent.
const oldRecoverySession = {
  id: 'cs_live_old',
  payment_status: 'paid',
  amount_total: 40000,
  currency: 'gbp',
  payment_intent: 'pi_3UQRQgFpvXQ3Kbbr0G21uOWD',
  metadata: {
    quote_ref: 'SMH-2026-196769',
    quote_id: QUOTE_ID,
    customer_lead_id: LEAD_ID,
    payment_type: 'full',
    recovery: '1',
  },
}
const PAID_AT = '2026-10-14T12:37:00.000Z'

test('old recovery session links by session metadata and fills inventory, volume, Stripe ids', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote()], customer_leads: [leadRow] })
  const res = await updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', { paidAtIso: PAID_AT })
  assert.equal(res.ok, true)
  assert.equal(res.quote_id, QUOTE_ID)
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'paid')
  assert.equal(q.status, 'Booked')
  assert.equal(q.amount_paid, 400)
  assert.equal(q.remaining_balance, 0)
  assert.equal(q.paid_at, PAID_AT)
  assert.equal(q.stripe_payment_intent_id, 'pi_3UQRQgFpvXQ3Kbbr0G21uOWD')
  assert.equal(q.stripe_session_id, 'cs_live_old')
  assert.equal(sb.db.quote_inventory_items.length, 2)
  assert.deepEqual(
    sb.db.quote_inventory_items.map((i) => [i.item_name, i.quantity, i.volume_m3]),
    [
      ['2-seater sofa [Living areas]', 1, 1.2],
      ['Armchair [Living areas]', 2, 1],
    ],
  )
  assert.match(q.pricing, /total 10\.05 m³/)
  assert.equal(sb.db.admin_activity_logs.length, 1)
})

test('manually marked Paid in full still gets missing Stripe data, keeps original paid_at', async () => {
  const manual = recoveryQuote({
    status: 'Booked',
    payment_status: 'paid',
    payment_type: 'full',
    amount_paid: 400,
    remaining_balance: 0,
    paid_at: PAID_AT,
    stripe_session_id: null,
  })
  const sb = fakeSupabase({ quotes: [manual], customer_leads: [leadRow] })
  const res = await updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', {
    paidAtIso: '2026-10-14T16:35:00.000Z',
  })
  assert.equal(res.ok, true)
  const q = sb.db.quotes[0]
  assert.equal(q.paid_at, PAID_AT)
  assert.equal(q.stripe_payment_intent_id, 'pi_3UQRQgFpvXQ3Kbbr0G21uOWD')
  assert.equal(q.amount_paid, 400)
  assert.equal(sb.db.quote_inventory_items.length, 2)
})

test('re-delivering the same event three times: no duplicate items, amount or log rows', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote()], customer_leads: [leadRow] })
  for (let i = 0; i < 3; i++) {
    await updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', { paidAtIso: PAID_AT })
  }
  const q = sb.db.quotes[0]
  assert.equal(sb.db.quotes.length, 1)
  assert.equal(q.amount_paid, 400)
  assert.equal(q.remaining_balance, 0)
  assert.equal(q.paid_at, PAID_AT)
  assert.equal(sb.db.quote_inventory_items.length, 2)
  assert.equal(sb.db.admin_activity_logs.length, 1)
})

test('concurrent webhook + verify processing inserts inventory once', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote()], customer_leads: [leadRow] })
  await Promise.all([
    updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', { paidAtIso: PAID_AT }),
    updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', { paidAtIso: PAID_AT }),
  ])
  assert.equal(sb.db.quote_inventory_items.length, 2)
  assert.equal(sb.db.quotes[0].amount_paid, 400)
})

test('existing inventory is never overwritten', async () => {
  const sb = fakeSupabase({
    quotes: [recoveryQuote({ inventory: [{ summary: 'Admin list' }] })],
    customer_leads: [leadRow],
    quote_inventory_items: [{ id: 'x', quote_id: QUOTE_ID, item_name: 'Piano', quantity: 1 }],
  })
  await updateQuoteFromCheckoutSession(sb, oldRecoverySession, 'paid', { paidAtIso: PAID_AT })
  assert.deepEqual(sb.db.quotes[0].inventory, [{ summary: 'Admin list' }])
  assert.equal(sb.db.quote_inventory_items.length, 1)
})

const pi = (over = {}) => ({
  id: 'pi_test_1',
  amount: 40000,
  amount_received: 40000,
  created: 1792000000,
  metadata: {},
  ...over,
})

test('website full payment (PaymentIntent metadata)', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote({ quote_ref: 'SMH-WEB-1', agreed_price: null })] })
  const res = await updateQuoteFromPaymentIntent(
    sb,
    pi({ metadata: { quote_id: QUOTE_ID, quote_ref: 'SMH-WEB-1', payment_type: 'full' } }),
    'paid',
  )
  assert.equal(res.ok, true)
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'paid')
  assert.equal(q.amount_paid, 400)
})

test('website £50 deposit keeps the balance set at checkout', async () => {
  const sb = fakeSupabase({
    quotes: [recoveryQuote({ quote_ref: 'SMH-WEB-2', agreed_price: null, estimated_total: 350.9, remaining_balance: 300.9 })],
  })
  await updateQuoteFromPaymentIntent(
    sb,
    pi({ amount: 5000, amount_received: 5000, metadata: { quote_id: QUOTE_ID, payment_type: 'deposit' } }),
    'paid',
  )
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'deposit_paid')
  assert.equal(q.amount_paid, 50)
  assert.equal(q.remaining_balance, 300.9)
})

test('admin phone quote £50 deposit: balance = final − 50, released to Available Jobs', async () => {
  const sb = fakeSupabase({
    quotes: [
      recoveryQuote({
        quote_ref: 'SMH-PQ-1',
        agreed_price: 400,
        estimated_total: 368.34,
        operational_status: 'phone_booking_pending',
        marketplace_visibility: 'hidden',
      }),
    ],
  })
  const deposit = pi({
    amount: 5000,
    amount_received: 5000,
    metadata: { quote_id: QUOTE_ID, payment_type: 'deposit', phone_quote: '1', quote_total_gbp: '400.00' },
  })
  await updateQuoteFromPaymentIntent(sb, deposit, 'paid')
  await updateQuoteFromPaymentIntent(sb, deposit, 'paid')
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'deposit_paid')
  assert.equal(q.amount_paid, 50)
  assert.equal(q.remaining_balance, 350)
  assert.equal(q.operational_status, null)
  assert.equal(q.marketplace_visibility, 'hidden_from_partners')
  assert.equal(sb.db.admin_activity_logs.length, 1)
})

test('admin phone quote full payment: balance 0', async () => {
  const sb = fakeSupabase({
    quotes: [recoveryQuote({ quote_ref: 'SMH-PQ-2', operational_status: 'phone_booking_pending' })],
  })
  await updateQuoteFromPaymentIntent(
    sb,
    pi({ metadata: { quote_id: QUOTE_ID, payment_type: 'full', phone_quote: '1', quote_total_gbp: '400.00' } }),
    'paid',
  )
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'paid')
  assert.equal(q.remaining_balance, 0)
  assert.equal(q.operational_status, null)
})

test('new recovery payment (metadata on PaymentIntent) fills inventory before admin notify', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote()], customer_leads: [leadRow] })
  await updateQuoteFromPaymentIntent(
    sb,
    pi({
      metadata: {
        quote_id: QUOTE_ID,
        quote_ref: 'SMH-2026-196769',
        payment_type: 'full',
        recovery: '1',
        customer_lead_id: LEAD_ID,
      },
    }),
    'paid',
  )
  const q = sb.db.quotes[0]
  assert.equal(q.payment_status, 'paid')
  assert.equal(q.remaining_balance, 0)
  assert.equal(sb.db.quote_inventory_items.length, 2)
})

test('PaymentIntent without any quote metadata changes nothing', async () => {
  const sb = fakeSupabase({ quotes: [recoveryQuote()] })
  const res = await updateQuoteFromPaymentIntent(sb, pi(), 'paid')
  assert.equal(res.ok, false)
  assert.equal(sb.db.quotes[0].payment_status, 'unpaid')
})
