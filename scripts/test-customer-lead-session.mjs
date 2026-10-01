/**
 * Customer lead session rules, then a real database save.
 * The database check uses example.com only and stops recovery before any email is due.
 * Run: node scripts/test-customer-lead-session.mjs
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

globalThis.__SMH_IMPORT_META_ENV = {
  DEV: false,
  PROD: true,
  MODE: 'test',
  VITE_MAPBOX_TOKEN: '',
  VITE_GOOGLE_MAPS_API_KEY: '',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
}

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { effectiveCustomerLeadStatus, maxCustomerLeadStatus } = await import('../src/lib/customerLeadStatus.js')
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

function readEnv(name) {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find((row) => row.startsWith(`${name}=`))
  return String(line || '')
    .slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function runSql(sql) {
  const dir = mkdtempSync(join(tmpdir(), 'smh-lead-'))
  const file = join(dir, 'query.sql')
  writeFileSync(file, sql)
  const result = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--yes', '--output', 'json', '--file', file],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', shell: true },
  )
  rmSync(dir, { recursive: true, force: true })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    throw new Error('database query failed')
  }
  const text = result.stdout || ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  return JSON.parse(text.slice(start, end + 1))
}

function firstRow(payload) {
  const rows = payload?.rows || payload?.result || payload
  if (Array.isArray(rows)) return rows[0] || null
  if (Array.isArray(rows?.rows)) return rows.rows[0] || null
  return null
}

async function upsertLead(url, key, sessionId, payload) {
  const response = await fetch(`${url}/rest/v1/rpc/upsert_customer_lead`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_session_id: sessionId, p_payload: payload }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`upsert_customer_lead HTTP ${response.status}`)
  }
  if (!text || text === 'null') return null
  return JSON.parse(text)
}

console.log('=== database: completed form is saved and listed, including abandon ===')

const supabaseUrl = readEnv('VITE_SUPABASE_URL')
const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')
assert(supabaseUrl.startsWith('https://') && anonKey.startsWith('eyJ'), 'public Supabase settings are available')

const sessionId = crypto.randomUUID()
const email = `lead-verify-${sessionId.slice(0, 8)}@example.com`
const quoteRef = `SMH-VERIFY-${sessionId.slice(0, 8)}`
const wizard = {
  pickupAddress: '1 Verify Street, Dundee',
  deliveryAddress: '2 Verify Road, Aberdeen',
  fullName: 'Lead Verify Test',
  email,
  phone: '07000900123',
  moveDate: '2026-11-02',
}
const savedPayload = buildCustomerLeadUpsertPayload({
  step: 3,
  quoteRef,
  serviceType: 'House Removals',
  wizard,
  sourcePageUrl: 'https://www.shiftmyhome.co.uk/quote',
  currentStatus: 'new_lead',
  paymentPhase: 'none',
  estimatedTotal: 93.08,
})
assert(savedPayload.status === 'quote_viewed', 'completed step 3 is quote_viewed before save')
assert(!String(email).endsWith('@shiftmyhome.co.uk'), 'verification email is not a company inbox')

const incomplete = await upsertLead(supabaseUrl, anonKey, `${sessionId}-incomplete`, {
  ...savedPayload,
  customer_email: '',
})
assert(incomplete == null, 'a form without an email is not saved')

let saved
try {
  saved = await upsertLead(supabaseUrl, anonKey, sessionId, savedPayload)
  assert(saved?.id && saved.lead_ref, 'completed form returned a lead id')
  assert(saved.status === 'quote_viewed', `saved status is quote_viewed, got ${saved.status}`)
  assert(saved.quote_ref === quoteRef, 'saved quote reference matches the form')

  const stored = firstRow(
    runSql(`
      select id::text, lead_ref, status, customer_name, customer_email, customer_phone,
             quote_id::text, converted_at, recovery_stopped_at, next_recovery_email_at,
             wizard_step, last_activity_at
      from public.customer_leads
      where session_id = ${sqlLiteral(sessionId)}
        and customer_email = ${sqlLiteral(email)};
    `),
  )
  assert(stored?.id === saved.id, 'the lead row exists in customer_leads')
  assert(stored.customer_name === 'Lead Verify Test', 'customer name is stored')
  assert(stored.customer_phone === '07000900123', 'customer phone is stored')
  assert(stored.customer_email === email, 'customer email is stored')
  assert(stored.converted_at == null && stored.quote_id == null, 'the lead is not a booking')
  const listed = Boolean(
    String(stored.customer_name || '').trim() ||
      String(stored.customer_phone || '').trim() ||
      String(stored.customer_email || '').trim(),
  )
  assert(listed, 'Customer Leads includes a row that has a name, phone, or email')
  assert(
    effectiveCustomerLeadStatus(stored) === 'quote_viewed',
    'Customer Leads shows Quote Viewed before the quote is abandoned',
  )

  runSql(`
    update public.customer_leads
    set last_activity_at = now() - interval '20 minutes'
    where session_id = ${sqlLiteral(sessionId)}
      and customer_email = ${sqlLiteral(email)};
  `)
  const abandoned = firstRow(
    runSql(`
      update public.customer_leads
      set
        status = 'abandoned',
        abandoned_at = coalesce(abandoned_at, now()),
        next_recovery_email_at = coalesce(
          next_recovery_email_at,
          coalesce(abandoned_at, now()) + interval '15 minutes'
        ),
        updated_at = now()
      where session_id = ${sqlLiteral(sessionId)}
        and customer_email = ${sqlLiteral(email)}
        and status in ('new_lead', 'quote_started', 'quote_viewed', 'payment_started')
        and recovery_stopped_at is null
        and converted_at is null
        and coalesce(nullif(trim(customer_email), ''), '') <> ''
        and last_activity_at < now() - interval '15 minutes'
        and (wizard_step >= 3 or status in ('quote_viewed', 'payment_started'))
      returning id::text, lead_ref, status, converted_at, quote_id::text, wizard_step,
                next_recovery_email_at, recovery_stopped_at, customer_name, customer_email, customer_phone,
                last_activity_at;
    `),
  )
  assert(abandoned?.status === 'abandoned', 'an unfinished quote is marked abandoned')
  assert(abandoned.converted_at == null && abandoned.quote_id == null, 'abandon does not create a booking')
  assert(Number(abandoned.wizard_step) >= 3, 'abandon applies to a quote the customer reached')
  assert(
    effectiveCustomerLeadStatus(abandoned) === 'abandoned',
    'Customer Leads Abandoned filter includes this lead',
  )

  const stopped = firstRow(
    runSql(`
      update public.customer_leads
      set recovery_stopped_at = now(),
          next_recovery_email_at = null,
          updated_at = now()
      where session_id = ${sqlLiteral(sessionId)}
        and customer_email = ${sqlLiteral(email)}
      returning id::text, lead_ref, status, recovery_stopped_at, next_recovery_email_at;
    `),
  )
  assert(stopped?.recovery_stopped_at, 'recovery is stopped for the test lead')
  assert(stopped.next_recovery_email_at == null, 'no recovery email is scheduled')

  const due = firstRow(
    runSql(`
      select
        (select count(*)::int from public.customer_leads
          where session_id = ${sqlLiteral(sessionId)}
            and recovery_stopped_at is null
            and customer_email = ${sqlLiteral(email)}) as open_recovery,
        (select count(*)::int from public.list_admin_abandoned_notification_candidates(30, 100) c
          where c.session_id = ${sqlLiteral(sessionId)}) as admin_notices;
    `),
  )
  assert(Number(due?.open_recovery) === 0, 'the test lead is not waiting on a customer email')
  assert(Number(due?.admin_notices) === 0, 'the test lead does not notify staff')

  console.log(
    `SAVED ${saved.lead_ref} (${saved.id}) as quote_viewed, then abandoned without a booking.`,
  )
  console.log('Customer Leads would show Lead Verify Test under Abandoned.')
  console.log('No customer email and no staff abandoned notice were queued.')
} catch (error) {
  runSql(`
    update public.customer_leads
    set recovery_stopped_at = coalesce(recovery_stopped_at, now()),
        next_recovery_email_at = null
    where session_id = ${sqlLiteral(sessionId)}
      and customer_email = ${sqlLiteral(email)};
  `)
  throw error
}

console.log('PASS: completed form is stored and an abandoned quote stays in Customer Leads')
