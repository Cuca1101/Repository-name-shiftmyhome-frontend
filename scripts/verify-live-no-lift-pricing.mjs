/**
 * Live verification: per-floor no-lift supplement (website bundle + estimate-extra-charge).
 * Run: node scripts/verify-live-no-lift-pricing.mjs
 */
import { createClient } from '@supabase/supabase-js'

const ORIGIN = process.env.SITE_ORIGIN || 'https://www.shiftmyhome.co.uk'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://msjhkfdqogymkartariq.supabase.co'
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zamhrZmRxb2d5bWthcnRhcmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTYzODgsImV4cCI6MjA5MzQ5MjM4OH0.Fwz-jKSxzMIEzB4ovB-5hUQM9ERXo9sIVARIm-I-XVQ'

let failed = 0

async function checkWebsiteBundle() {
  const html = await fetch(`${ORIGIN}/quote/`).then((r) => r.text())
  const bundle = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1]
  if (!bundle) {
    console.error('FAIL: could not find production JS bundle on /quote/')
    failed++
    return
  }
  const js = await fetch(`${ORIGIN}/assets/${bundle}`).then((r) => r.text())
  const hasPerFloorLabel = js.includes('No lift supplement (delivery):') && js.includes('floors =')
  const hasPerFloorMath = js.includes('deliveryFloor * noLiftFlat') || js.includes('pickupFloor * noLiftFlat')
  console.log(`\n--- Website bundle (${bundle}) ---`)
  console.log(`per-floor label in bundle: ${hasPerFloorLabel}`)
  console.log(`per-floor math in bundle: ${hasPerFloorMath}`)
  if (!hasPerFloorLabel || !hasPerFloorMath) {
    console.error('FAIL: production bundle does not include per-floor no-lift logic yet')
    failed++
  } else {
    console.log('OK: quote / admin / checkout / job breakdown use updated pricingCalculator')
  }
}

async function checkEdgeFunction() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await supabase.functions.invoke('estimate-extra-charge', {
    body: {
      items: [],
      operational: { extra_floors: 3, lift_available: 'no' },
    },
  })
  console.log('\n--- estimate-extra-charge (live) ---')
  if (error) {
    console.error('FAIL: invoke error', error.message)
    failed++
    return
  }
  const lines = data?.breakdown || []
  const noLiftLine = lines.find((l) => /no lift supplement/i.test(String(l.label)))
  const opTotal = Number(data?.operational_subtotal_gbp) || 0
  console.log('operational_subtotal_gbp:', opTotal)
  console.log('no-lift line:', noLiftLine?.label, noLiftLine?.amount)
  const amt = Number(noLiftLine?.amount) || 0
  if (Math.abs(amt - 90) > 0.01) {
    console.error(`FAIL: expected no-lift £90 for 3 floors @ £30, got £${amt.toFixed(2)}`)
    failed++
  } else if (!String(noLiftLine?.label || '').includes('× 3 floors')) {
    console.error('FAIL: breakdown label missing "× 3 floors"')
    failed++
  } else {
    console.log('OK: driver on-site extra charge — £90 for floor 3, no lift')
  }
}

console.log(`Verifying live no-lift pricing at ${ORIGIN}`)
await checkWebsiteBundle()
await checkEdgeFunction()

if (failed > 0) {
  console.error(`\n${failed} live check(s) failed`)
  process.exit(1)
}
console.log('\nAll live no-lift checks passed.')
