/**
 * Browser check for the single sitewide Google tag.
 *
 * Usage:
 *   node scripts/verify-google-tag-browser.mjs http://127.0.0.1:5173
 *   node scripts/verify-google-tag-browser.mjs http://127.0.0.1:5173 --expect-conversion
 *   node scripts/verify-google-tag-browser.mjs https://www.shiftmyhome.co.uk
 */
import { chromium } from 'playwright'

const origin = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const expectConversion = process.argv.includes('--expect-conversion')
const conversionSendTo = 'AW-18251721917/testPurchaseLabel'

const GOOGLE_TAG = 'G-Z2G1NH5YRB'
const ADS = 'AW-18251721917'
const ANALYTICS = 'G-JHFQTSQRTL'
const RETIRED_ADS = 'AW-18190966910'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const failures = []

function fail(message) {
  failures.push(message)
  console.error('FAIL:', message)
}

page.on('pageerror', (error) => {
  console.error('PAGEERROR:', error.message)
})

await page.addInitScript(() => {
  localStorage.setItem(
    'smh_cookie_consent',
    JSON.stringify({
      essential: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    }),
  )
})

/** @param {import('playwright').Page} target */
async function gtagCalls(target) {
  return target.evaluate(() => {
    const layer = window.dataLayer || []
    return layer
      .map((item) => {
        if (!item || typeof item !== 'object' || typeof item.length !== 'number' || !item[0]) return null
        return Array.from(item).map((part) => {
          if (part && typeof part === 'object') {
            try {
              return JSON.parse(JSON.stringify(part))
            } catch {
              return String(part)
            }
          }
          return part
        })
      })
      .filter(Boolean)
  })
}

function configs(calls) {
  return calls.filter((call) => call[0] === 'config').map((call) => call[1])
}

function events(calls, name) {
  return calls.filter((call) => call[0] === 'event' && call[1] === name)
}

const gtagScriptRequests = []
page.on('request', (request) => {
  const url = request.url()
  if (url.includes('googletagmanager.com/gtag/js')) gtagScriptRequests.push(url)
})

await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const homeCalls = await gtagCalls(page)
const homeConfigs = configs(homeCalls)
const primaryLoaderCount = await page
  .locator(`script[src*="googletagmanager.com/gtag/js?id=${GOOGLE_TAG}"]`)
  .count()
const retiredLoaderCount = await page.locator(`script[src*="${RETIRED_ADS}"]`).count()
const homepageGtagRequests = [...gtagScriptRequests]
const primaryRequests = homepageGtagRequests.filter(
  (url) => url.includes(`id=${GOOGLE_TAG}`) && !url.includes('cx='),
)

if (primaryLoaderCount !== 1) fail(`expected 1 official gtag.js loader, found ${primaryLoaderCount}`)
if (primaryRequests.length !== 1) {
  fail(`expected 1 official gtag.js request, found ${primaryRequests.length}`)
}
if (retiredLoaderCount) fail('retired Ads account loaded its own gtag.js')
for (const id of [GOOGLE_TAG, ADS, ANALYTICS]) {
  if (!homeConfigs.includes(id)) fail(`homepage missing gtag config ${id}`)
}
if (homeConfigs.includes(RETIRED_ADS)) fail(`homepage still configs retired ${RETIRED_ADS}`)
if (homeConfigs.filter((id) => id === ADS).length !== 1) fail('Ads destination was configured more than once')

await page.goto(`${origin}/admin`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
const adminConfigs = configs(await gtagCalls(page))
if (adminConfigs.length) fail(`admin page configured tags: ${adminConfigs.join(', ')}`)

await page.goto(`${origin}/payment-success`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const bareCalls = await gtagCalls(page)
if (events(bareCalls, 'conversion').length) fail('bare /payment-success fired a conversion')
if (events(bareCalls, 'purchase').length) fail('bare /payment-success fired a purchase')
if (!configs(bareCalls).includes(GOOGLE_TAG) || !configs(bareCalls).includes(ADS)) {
  fail('payment-success did not load the Google tag and Ads destination')
}

await page.route('**/*verify-checkout-session*', (route) => {
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not paid' }),
  })
})
await page.goto(`${origin}/payment-success?session_id=cs_test_unpaid`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const unpaidCalls = await gtagCalls(page)
if (events(unpaidCalls, 'conversion').length || events(unpaidCalls, 'purchase').length) {
  fail('unverified payment fired purchase or conversion')
}
await page.unroute('**/*verify-checkout-session*')

await page.route('**/*verify-checkout-session*', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      quote_ref: 'SMH1001',
      quote_id: 'quote-test',
      amount_gbp: 149,
      currency: 'gbp',
      service_package: 'standard',
    }),
  })
})

await page.goto(`${origin}/payment-success?session_id=cs_test_paid`, { waitUntil: 'domcontentloaded' })
await page.getByText('SMH1001').waitFor({ timeout: 15000 })
const paidCalls = await gtagCalls(page)
const purchases = events(paidCalls, 'purchase')
const conversions = events(paidCalls, 'conversion')

if (purchases.length !== 1) fail(`expected 1 purchase after confirmed payment, found ${purchases.length}`)
const purchasePayload = purchases[0]?.[2] || {}
if (purchasePayload.transaction_id !== 'cs_test_paid') fail('purchase transaction_id was not the checkout session')
const purchaseTargets = [].concat(purchasePayload.send_to || [])
if (!purchaseTargets.includes(GOOGLE_TAG) || !purchaseTargets.includes(ANALYTICS)) {
  fail(`purchase was not sent to both analytics tags: ${purchaseTargets.join(', ')}`)
}
if (purchaseTargets.some((id) => String(id).startsWith('AW-'))) fail('purchase event was also sent to Google Ads')

if (expectConversion) {
  if (conversions.length !== 1) fail(`expected 1 ads conversion, found ${conversions.length}`)
  if (conversions[0]?.[2]?.send_to !== conversionSendTo) {
    fail(`conversion send_to was ${conversions[0]?.[2]?.send_to}`)
  }
  if (conversions[0]?.[2]?.transaction_id !== 'cs_test_paid') fail('conversion transaction_id missing')
} else if (conversions.length) {
  fail(`conversion fired without a label for ${ADS}: ${JSON.stringify(conversions)}`)
}

await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByText('SMH1001').waitFor({ timeout: 15000 })
const repeatCalls = await gtagCalls(page)
if (events(repeatCalls, 'purchase').length) fail('reloading a confirmed payment sent a second purchase')
if (events(repeatCalls, 'conversion').length) fail('reloading a confirmed payment sent a second conversion')

console.log(
  JSON.stringify(
    {
      origin,
      expectConversion,
      primaryLoaderCount,
      homepageGtagRequests,
      homeConfigs,
      purchaseCount: purchases.length,
      conversionCount: conversions.length,
      ok: failures.length === 0,
      failures,
    },
    null,
    2,
  ),
)

await browser.close()
process.exit(failures.length ? 1 : 0)
