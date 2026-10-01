/**
 * In-memory checks only. Does not insert quotes, call Resend, or email customers.
 * Run: node scripts/test-booking-volume-and-delivery.mjs
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

globalThis.__SMH_IMPORT_META_ENV = {
  DEV: false,
  PROD: true,
  MODE: 'test',
  VITE_MAPBOX_TOKEN: '',
  VITE_GOOGLE_MAPS_API_KEY: '',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_SHOW_DEMO_ADMIN_UI: 'false',
}

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { DAILY_JOB_SLOT_MAX, normalizeDailyJobSlots, resolveDaySlotAvailability } = await import(
  '../src/lib/calendarDayPricing.js'
)
const { quotePassesAvailableJobsStrict } = await import('../src/lib/adminJobListRules.js')
const { filterProductionAdminQuotes } = await import('../src/lib/adminProductionFilters.js')
const {
  alreadySentStage,
  kindForAbandonedCount,
  leadIsDueForRecovery,
  nextRecoveryAtAfterSend,
  recoveryKindForDueLead,
} = await import('../supabase/functions/_shared/recoverySchedule.js')
const {
  notificationClaimDecision,
  queueProcessingIsTerminal,
} = await import('../supabase/functions/_shared/deliveryRetryPolicy.js')

const PAGE_SIZE = Number(
  readFileSync(new URL('../src/components/AvailableJobsAdmin.jsx', import.meta.url), 'utf8').match(
    /const PAGE_SIZE = (\d+)/,
  )?.[1],
)

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const customerMessagesSent = []

function allowTestRecipient(email) {
  const to = String(email || '').trim().toLowerCase()
  if (!to.endsWith('@example.com')) {
    throw new Error(`Refusing non-test recipient: ${to || '(empty)'}`)
  }
  return to
}

/** Same day-count rule as public.public_quote_day_slot_counts. */
function countsAsConfirmedBooking(quote) {
  if (!quote.move_date || quote.cancelled_at) return false
  const payment = String(quote.payment_status || '').toLowerCase()
  return payment === 'paid' || payment === 'deposit_paid'
}

/** Same Available Jobs query as fetchQuotesForAdmin({ availableInbox, filter all_paid }). */
function matchesAvailableJobsSql(quote) {
  if (quote.bundled_journey_id != null && String(quote.bundled_journey_id).trim() !== '') return false
  if (quote.completed_at || quote.cancelled_at) return false
  if (quote.assigned_driver_id != null && String(quote.assigned_driver_id).trim() !== '') return false
  if (quote.assigned_partner_id != null && String(quote.assigned_partner_id).trim() !== '') return false
  const payment = String(quote.payment_status || '').toLowerCase()
  if (payment === 'paid' || payment === 'deposit_paid') return true
  const source = String(quote.source || '')
  if (source !== 'phone_booking' && source !== 'admin_phone_booking') return false
  if (payment !== 'unpaid') return false
  const operational = String(quote.operational_status || '').trim().toLowerCase()
  return operational === '' || operational !== 'phone_booking_pending'
}

function eligibleOnPage(rows) {
  return filterProductionAdminQuotes(rows).filter(quotePassesAvailableJobsStrict)
}

console.log('=== 100 confirmed bookings on one day ===')

const moveDate = '2026-10-05'
assert(DAILY_JOB_SLOT_MAX >= 100, 'weekday slot cap must allow at least 100')

const dayBookings = Array.from({ length: 100 }, (_, index) => ({
  id: `day-${index + 1}`,
  quote_ref: `SMH-2026-${200000 + index}`,
  full_name: `Volume Customer ${index + 1}`,
  email: `volume${index + 1}@example.com`,
  move_date: moveDate,
  payment_status: index % 10 === 0 ? 'deposit_paid' : 'paid',
  cancelled_at: null,
  is_test: false,
}))

assert(dayBookings.filter(countsAsConfirmedBooking).length === 100, '100 paid bookings count on the day')
assert(
  normalizeDailyJobSlots({ 1: 100 })['1'] === 100,
  'a Monday limit of 100 is stored',
)
assert(normalizeDailyJobSlots({ 1: 500 })['1'] === DAILY_JOB_SLOT_MAX, 'values above the cap clamp')

const atLimit = resolveDaySlotAvailability({ dailyJobSlots: { 1: 100 } }, moveDate, 100)
assert(atLimit.capacity === 100 && atLimit.remaining === 0 && atLimit.full, '100 of 100 fills the day')
const oneLeft = resolveDaySlotAvailability({ dailyJobSlots: { 1: 100 } }, moveDate, 99)
assert(oneLeft.remaining === 1 && !oneLeft.full, '99 of 100 leaves one slot')
const unlimited = resolveDaySlotAvailability({ dailyJobSlots: {} }, moveDate, 100)
assert(!unlimited.limited && !unlimited.full, 'a blank weekday stays open at 100 bookings')
assert(customerMessagesSent.length === 0, 'day-capacity check sent no customer messages')

console.log('=== Available Jobs pagination keeps every eligible job ===')

assert(PAGE_SIZE > 0 && PAGE_SIZE < 100, 'page size must paginate a 100-job inbox')

const eligibleJobs = Array.from({ length: 100 }, (_, index) => ({
  id: `eligible-${index + 1}`,
  quote_ref: `SMH-2026-${300000 + index}`,
  full_name: `Volume Customer ${index + 1}`,
  email: `inbox${index + 1}@example.com`,
  payment_status: 'paid',
  status: 'Booked',
  move_date: moveDate,
  bundled_journey_id: null,
  completed_at: null,
  cancelled_at: null,
  assigned_driver_id: index === 7 ? '' : null,
  assigned_partner_id: null,
  marketplace_visibility: 'hidden_from_partners',
  operational_status: null,
  is_test: false,
  source: 'website',
}))

const hiddenJobs = [
  {
    id: 'hidden-assigned',
    quote_ref: 'SMH-2026-310001',
    full_name: 'Assigned Customer',
    email: 'assigned@example.com',
    payment_status: 'paid',
    assigned_driver_id: 'driver-1',
    marketplace_visibility: 'hidden_from_partners',
  },
  {
    id: 'hidden-cancelled',
    quote_ref: 'SMH-2026-310002',
    full_name: 'Cancelled Customer',
    email: 'cancelled@example.com',
    payment_status: 'paid',
    cancelled_at: '2026-10-01T00:00:00.000Z',
    marketplace_visibility: 'hidden_from_partners',
  },
  {
    id: 'hidden-test',
    quote_ref: 'SMH-2026-310003',
    full_name: 'Archive Row',
    email: 'archive@example.com',
    payment_status: 'paid',
    is_test: true,
    marketplace_visibility: 'hidden_from_partners',
  },
  {
    id: 'hidden-bundled',
    quote_ref: 'SMH-2026-310004',
    full_name: 'Bundled Customer',
    email: 'bundled@example.com',
    payment_status: 'paid',
    bundled_journey_id: 'journey-1',
    marketplace_visibility: 'hidden_from_partners',
  },
  {
    id: 'hidden-marketplace',
    quote_ref: 'SMH-2026-310005',
    full_name: 'Marketplace Customer',
    email: 'market@example.com',
    payment_status: 'paid',
    marketplace_visibility: 'visible_in_marketplace',
  },
  {
    id: 'shown-phone',
    quote_ref: 'SMH-2026-310006',
    full_name: 'Phone Customer',
    email: 'phone@example.com',
    payment_status: 'unpaid',
    source: 'phone_booking',
    operational_status: null,
    marketplace_visibility: 'hidden_from_partners',
    is_test: false,
  },
]

const mixed = []
eligibleJobs.forEach((job, index) => {
  mixed.push(job)
  if (hiddenJobs[index]) mixed.push(hiddenJobs[index])
})
for (const job of hiddenJobs.slice(eligibleJobs.length)) mixed.push(job)

const expectedIds = eligibleOnPage(mixed).map((row) => row.id)
assert(expectedIds.length >= 100, `expected at least 100 eligible jobs, got ${expectedIds.length}`)
assert(expectedIds.includes('eligible-8'), 'blank assignee id stays eligible')
assert(expectedIds.includes('shown-phone'), 'released phone booking stays eligible')
assert(!expectedIds.includes('hidden-test'), 'test rows stay out of Available Jobs')
assert(!expectedIds.includes('hidden-assigned'), 'assigned jobs stay out of Available Jobs')

const sqlRows = mixed.filter(matchesAvailableJobsSql)
const seen = []
let page = 0
while (page * PAGE_SIZE < sqlRows.length) {
  const slice = sqlRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  seen.push(...eligibleOnPage(slice))
  page += 1
}
assert(page > 1, '100 jobs span more than one page')

const seenIds = seen.map((row) => row.id)
assert(seenIds.length === new Set(seenIds).size, 'pagination produced a duplicate job')
assert(
  seenIds.length === expectedIds.length && expectedIds.every((id) => seenIds.includes(id)),
  `pagination missed eligible jobs: expected ${expectedIds.length}, saw ${seenIds.length}`,
)

console.log('=== recovery does not drop a due stage or send it twice ===')

const nowIso = '2026-10-01T12:00:00.000Z'
const dueLead = {
  id: 'lead-due',
  status: 'abandoned',
  customer_email: 'lead-due@example.com',
  recovery_stopped_at: null,
  next_recovery_email_at: '2026-10-01T11:00:00.000Z',
  recovery_emails_sent_count: 0,
  last_recovery_email_kind: '',
  abandoned_at: '2026-10-01T10:00:00.000Z',
}
assert(leadIsDueForRecovery(dueLead, nowIso), 'due abandoned lead is selected')
assert(recoveryKindForDueLead(dueLead) === 'abandoned', 'first stage is abandoned')
assert(!alreadySentStage(dueLead, 'abandoned'), 'first stage is not treated as already sent')

const leads = [
  dueLead,
  { ...dueLead, id: 'future', next_recovery_email_at: '2026-10-02T12:00:00.000Z' },
  { ...dueLead, id: 'stopped', recovery_stopped_at: nowIso },
  { ...dueLead, id: 'no-email', customer_email: '' },
  { ...dueLead, id: 'fresh', status: 'quote_viewed' },
]
assert(leads.filter((lead) => leadIsDueForRecovery(lead, nowIso)).map((lead) => lead.id).join() === 'lead-due')

const afterFirst = {
  ...dueLead,
  recovery_emails_sent_count: 1,
  last_recovery_email_kind: 'abandoned',
  next_recovery_email_at: nextRecoveryAtAfterSend('abandoned', dueLead),
}
assert(alreadySentStage(afterFirst, 'abandoned'), 'abandoned is not sent twice')
assert(recoveryKindForDueLead(afterFirst) === 'abandoned_reminder', 'reminder is not dropped')
assert(
  nextRecoveryAtAfterSend('abandoned', dueLead) === '2026-10-02T10:00:00.000Z',
  'reminder is scheduled 24h after the anchor',
)
const afterReminder = {
  ...afterFirst,
  recovery_emails_sent_count: 2,
  last_recovery_email_kind: 'abandoned_reminder',
}
assert(recoveryKindForDueLead(afterReminder) === 'abandoned_final', 'final email is not dropped')
assert(
  nextRecoveryAtAfterSend('abandoned_reminder', afterReminder) === '2026-10-04T10:00:00.000Z',
  'final email is scheduled 72h after the anchor',
)
assert(kindForAbandonedCount(3) == null, 'cadence stops after the third email')
assert(recoveryKindForDueLead({ ...afterReminder, recovery_emails_sent_count: 3, last_recovery_email_kind: 'abandoned_final' }) == null)

const paymentFailed = {
  ...afterFirst,
  status: 'payment_failed',
  payment_failed_at: '2026-10-01T11:30:00.000Z',
}
assert(recoveryKindForDueLead(paymentFailed) === 'payment_failed', 'payment-failed email is not dropped')
assert(!alreadySentStage(paymentFailed, 'payment_failed'), 'payment-failed email has not been sent')
assert(
  alreadySentStage({ ...paymentFailed, last_recovery_email_kind: 'payment_failed' }, 'payment_failed'),
  'payment-failed email is not sent twice',
)
assert(nextRecoveryAtAfterSend('payment_failed', paymentFailed) == null, 'payment-failed has no further stage')

console.log('=== job notifications retry a failure and do not duplicate a send ===')

function deliver(row, claims, now) {
  const key = `${row.quote_id}|${row.event_key}`
  const decision = notificationClaimDecision(claims.get(key), now)
  if (decision === 'already_sent') return { ok: false, error: 'already_sent', skipped: true }
  if (decision === 'in_flight') return { ok: false, error: 'in_flight', skipped: false }
  const createdAt = claims.get(key)?.created_at || new Date(now).toISOString()
  claims.set(key, { delivery_status: 'pending', created_at: createdAt })
  allowTestRecipient(row.email)
  if (row.failOnce && !row.failedAlready) {
    row.failedAlready = true
    claims.set(key, { delivery_status: 'failed', created_at: createdAt })
    return { ok: false, error: 'resend_failed' }
  }
  claims.set(key, { delivery_status: 'sent', created_at: createdAt })
  customerMessagesSent.push(key)
  return { ok: true }
}

function drain(queue, claims, now) {
  let sentNow = 0
  for (const row of queue) {
    if (row.processed_at) continue
    const result = deliver(row, claims, now)
    row.processed_at = queueProcessingIsTerminal(result) ? new Date(now).toISOString() : null
    row.error = result.ok ? null : result.error
    if (result.ok) sentNow += 1
  }
  return sentNow
}

const claims = new Map()
const queue = Array.from({ length: 100 }, (_, index) => ({
  id: `queue-${index + 1}`,
  quote_id: `quote-${index + 1}`,
  event_key: 'driver_assigned',
  email: `notify${index + 1}@example.com`,
  processed_at: null,
  failOnce: index === 0,
}))

const firstPass = drain(queue, claims, Date.parse('2026-10-01T12:00:00.000Z'))
assert(firstPass === 99, `first pass should send 99 and hold 1 failure, sent ${firstPass}`)
assert(queue[0].processed_at == null, 'failed provider send stays queued')
assert(queue[1].processed_at, 'successful send is marked processed')

const secondPass = drain(queue, claims, Date.parse('2026-10-01T12:02:00.000Z'))
assert(secondPass === 1, `retry should send the failed job once, sent ${secondPass}`)
assert(customerMessagesSent.length === 100, '100 notifications sent across both passes')

const thirdPass = drain(queue, claims, Date.parse('2026-10-01T12:04:00.000Z'))
assert(thirdPass === 0, 'a later pass does not send duplicates')
assert(customerMessagesSent.length === 100, 'duplicate pass did not add sends')
assert(new Set(customerMessagesSent).size === 100, 'each quote event was sent once')

assert(notificationClaimDecision({ delivery_status: 'sent' }) === 'already_sent')
assert(notificationClaimDecision({ delivery_status: 'failed' }) === 'reclaim')
assert(
  notificationClaimDecision({
    delivery_status: 'pending',
    created_at: '2026-10-01T12:00:00.000Z',
  }, Date.parse('2026-10-01T12:01:00.000Z')) === 'in_flight',
)
assert(queueProcessingIsTerminal({ ok: false, error: 'resend_failed' }) === false)
assert(queueProcessingIsTerminal({ ok: false, error: 'missing_email' }) === true)
assert(queueProcessingIsTerminal({ ok: false, error: 'already_sent', skipped: true }) === true)

const notifySource = readFileSync(
  new URL('../supabase/functions/process-job-customer-notify/index.ts', import.meta.url),
  'utf8',
)
assert(notifySource.includes('notificationClaimDecision'), 'notify function uses the claim policy')
assert(notifySource.includes('queueProcessingIsTerminal'), 'notify queue uses the retry policy')
const recoverySource = readFileSync(
  new URL('../supabase/functions/process-quote-recovery/index.ts', import.meta.url),
  'utf8',
)
assert(recoverySource.includes('recoveryKindForDueLead'), 'recovery cron uses the shared cadence')

console.log('PASS: 100-booking day, Available Jobs pagination, recovery and notification guards')
console.log(`Simulated customer sends: ${customerMessagesSent.length} (example.com only, no provider call)`)
