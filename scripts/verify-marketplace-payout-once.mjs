import { computeMarketplacePayoutFromCustomerTotal } from '../src/lib/marketplacePayoutMath.js'

const customerTotal = 150.78
const once = computeMarketplacePayoutFromCustomerTotal(customerTotal, 'percentage', 25)
const twice = computeMarketplacePayoutFromCustomerTotal(once.marketplacePayout, 'percentage', 25)

if (!once || Math.abs(once.marketplacePayout - 113.09) > 0.02) {
  console.error('FAIL: single 25% deduction expected driver payout ~£113.09, got', once?.marketplacePayout)
  process.exit(1)
}
if (twice?.marketplacePayout === 84.82) {
  console.error('FAIL: double deduction reproduces £84.82 — display must never deduct from saved payout')
  process.exit(1)
}
console.log('OK: £150.78 @ 25% once → £' + once.marketplacePayout.toFixed(2) + ' (not £84.82)')
