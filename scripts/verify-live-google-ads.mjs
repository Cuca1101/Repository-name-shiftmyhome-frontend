/**
 * Post-deploy check: Google Ads IDs are baked into the production JS bundle.
 * AW tag loads only after marketing cookie consent (not in static HTML).
 */
const ORIGIN = 'https://www.shiftmyhome.co.uk'
const CONVERSION_ID = 'AW-18190966910'
const PURCHASE_LABEL = 'NRicCNqylbccEP7AkoJD'
const SEND_TO = `${CONVERSION_ID}/${PURCHASE_LABEL}`

const homeHtml = await fetch(`${ORIGIN}/`).then((r) => r.text())
const bundleMatch = homeHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)
if (!bundleMatch) {
  console.error('FAIL: no index-*.js bundle in homepage HTML')
  process.exit(1)
}

const bundleUrl = `${ORIGIN}/assets/${bundleMatch[1]}`
const js = await fetch(bundleUrl).then((r) => r.text())

const checks = {
  bundle: bundleMatch[1],
  conversionIdInBundle: js.includes(CONVERSION_ID),
  purchaseLabelInBundle: js.includes(PURCHASE_LABEL),
  sendToInBundle: js.includes(SEND_TO),
  trackGoogleAdsConversion: js.includes('trackGoogleAdsConversion'),
  gtagConversionEvent: js.includes('conversion'),
}

const ok = checks.conversionIdInBundle && checks.purchaseLabelInBundle && checks.sendToInBundle
console.log(JSON.stringify({ ok, checks }, null, 2))
process.exit(ok ? 0 : 1)
