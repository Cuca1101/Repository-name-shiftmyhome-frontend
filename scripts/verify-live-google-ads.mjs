/**
 * Post-deploy check: one Google tag loader, required destinations in HTML,
 * and the retired Ads account is not configured again.
 */
const ORIGIN = 'https://www.shiftmyhome.co.uk'
const GOOGLE_TAG = 'G-Z2G1NH5YRB'
const ADS = 'AW-18251721917'
const ANALYTICS = 'G-JHFQTSQRTL'
const RETIRED_ADS = 'AW-18190966910'

const homeHtml = await fetch(`${ORIGIN}/`).then((response) => response.text())
const paymentHtml = await fetch(`${ORIGIN}/payment-success`).then((response) => response.text())
const bundleMatch = homeHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)

const checks = {
  oneGtagLoader: (homeHtml.match(/googletagmanager\.com\/gtag\/js/g) || []).length === 1,
  loaderIsGoogleTag: homeHtml.includes(`gtag/js?id=${GOOGLE_TAG}`),
  configGoogleTag: homeHtml.includes(`gtag('config', '${GOOGLE_TAG}')`),
  configAds: homeHtml.includes(`gtag('config', '${ADS}')`),
  configAnalytics: homeHtml.includes(`gtag('config', '${ANALYTICS}')`),
  retiredAdsNotConfigured: !homeHtml.includes(`gtag('config', '${RETIRED_ADS}')`),
  paymentSuccessSameShell: paymentHtml.includes(`gtag/js?id=${GOOGLE_TAG}`) && paymentHtml.includes(`gtag('config', '${ADS}')`),
  bundle: bundleMatch?.[1] || null,
}

const ok = Object.entries(checks)
  .filter(([key]) => key !== 'bundle')
  .every(([, value]) => value)

console.log(JSON.stringify({ ok, checks }, null, 2))
process.exit(ok ? 0 : 1)
