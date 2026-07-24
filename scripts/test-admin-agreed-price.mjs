/**
 * Admin agreed price helpers — unit checks.
 * Run: node scripts/test-admin-agreed-price.mjs
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const {
  resolveCalculatedTotal,
  resolveChargeableTotal,
  parseAdminAgreedPriceInput,
  buildPriceOverrideConfirmMessage,
} = await import('../src/lib/adminAgreedPrice.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const lead = {
  estimated_total: 485.98,
  calculated_total: 485.98,
  agreed_price: 250,
}

assert(resolveCalculatedTotal(lead) === 485.98, 'calculated preserved')
assert(resolveChargeableTotal(lead) === 250, 'agreed overrides for charge')
assert(resolveChargeableTotal({ estimated_total: 232 }) === 232, 'no override → estimated')

const bad = parseAdminAgreedPriceInput('abc')
assert(!bad.ok, 'invalid price rejected')
const good = parseAdminAgreedPriceInput('250')
assert(good.ok && good.amount === 250, 'valid price parsed')

const msg = buildPriceOverrideConfirmMessage({
  calculated: 485.98,
  agreed: 250,
  reason: 'Phone agreement',
})
assert(msg.includes('£485.98') && msg.includes('£250.00'), 'confirm message shows both prices')
assert(msg.includes('Pricing Engine'), 'confirm notes engine unchanged')

console.log('Admin agreed price helpers: OK')
