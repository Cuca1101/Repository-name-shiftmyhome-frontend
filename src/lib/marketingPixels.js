import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
} from './cookieConsent.js'

/** @returns {string} */
export function getMetaPixelId() {
  const id = import.meta.env.VITE_META_PIXEL_ID
  return typeof id === 'string' ? id.trim() : ''
}

/** Site GA4 property. Still used for analytics events. */
export const GA4_MEASUREMENT_ID = 'G-JHFQTSQRTL'

/**
 * Google tag for the Ads account under verification.
 * Already linked to destination AW-18251721917.
 */
export const GOOGLE_TAG_ID = 'G-Z2G1NH5YRB'

/** Google Ads destination linked to GOOGLE_TAG_ID. */
export const GOOGLE_ADS_DESTINATION_ID = 'AW-18251721917'

/** Previous Ads account. Do not configure it again. */
const RETIRED_GOOGLE_ADS_CONVERSION_ID = 'AW-18190966910'

/** Conversion label that belongs to the retired Ads account. */
const RETIRED_GOOGLE_ADS_PURCHASE_LABEL = 'NRicCNqylbccEP7AkoJD'

/** @param {unknown} value */
function readEnvId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** @returns {string} */
export function getGaMeasurementId() {
  return readEnvId(import.meta.env.VITE_GA_MEASUREMENT_ID) || GA4_MEASUREMENT_ID
}

/**
 * Ads destination configured by the single sitewide gtag loader.
 * A Cloudflare override that still points at the retired account is ignored.
 * @returns {string}
 */
export function getGoogleAdsConversionId() {
  const envId = readEnvId(import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID)
  if (envId && envId.toUpperCase() !== RETIRED_GOOGLE_ADS_CONVERSION_ID && /^AW-\d+$/i.test(envId)) {
    return envId
  }
  return GOOGLE_ADS_DESTINATION_ID
}

/**
 * Purchase conversion label for the active Ads account.
 * The label baked in for AW-18190966910 is not valid on AW-18251721917.
 * @returns {string}
 */
export function getGoogleAdsPurchaseLabel() {
  const label = readEnvId(import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL)
  const envId = readEnvId(import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID)
  if (!label || /x{3,}/i.test(label)) return ''
  if (label === RETIRED_GOOGLE_ADS_PURCHASE_LABEL) return ''
  if (!envId || envId.toUpperCase() === RETIRED_GOOGLE_ADS_CONVERSION_ID) return ''
  return label
}

/** Analytics properties that should receive GA events. Ads is not included. */
function getAnalyticsSendTo() {
  return [...new Set([getGaMeasurementId(), GOOGLE_TAG_ID].filter(Boolean))]
}

/** @returns {string} `AW-xxx/label` for gtag conversion send_to. */
export function getGoogleAdsPurchaseSendTo() {
  const id = getGoogleAdsConversionId()
  const label = getGoogleAdsPurchaseLabel()
  return id && label ? `${id}/${label}` : ''
}

/** @returns {boolean} */
export function isMetaPixelConfigured() {
  return Boolean(getMetaPixelId())
}

/** @returns {boolean} */
export function isGaConfigured() {
  return Boolean(getGaMeasurementId())
}

/** True when the Google Ads destination tag is installed (cookie disclosure). */
export function isGoogleAdsConfigured() {
  const id = getGoogleAdsConversionId()
  if (!id || /x{3,}/i.test(id)) return false
  return /^AW-\d+$/i.test(id)
}

/** Human-readable names of optional cookies that are configured in env. */
export function getConfiguredOptionalCookieServiceNames() {
  const names = []
  if (isGaConfigured()) names.push('Google Analytics')
  if (isGoogleAdsConfigured()) names.push('Google Ads')
  if (isMetaPixelConfigured()) names.push('Meta Pixel')
  return names
}

/** @param {string[]} names */
export function formatCookieServiceList(names) {
  if (!names?.length) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** @returns {string} */
export function getMarketingCookiePreferenceTitle() {
  const hasAds = isGoogleAdsConfigured()
  const hasMeta = isMetaPixelConfigured()
  if (hasAds && hasMeta) return 'Marketing (Google Ads & Meta Pixel)'
  if (hasAds) return 'Marketing (Google Ads)'
  if (hasMeta) return 'Marketing (Meta Pixel)'
  return 'Marketing'
}

/** @returns {string} */
export function getMarketingCookiePreferenceDescription() {
  const hasAds = isGoogleAdsConfigured()
  const hasMeta = isMetaPixelConfigured()
  if (hasAds && hasMeta) {
    return 'Used to measure paid ad performance — including Google Ads conversions after a booking payment and Meta ads when you interact with our quote tools.'
  }
  if (hasAds) {
    return 'Used to measure Google Ads conversions after a booking payment.'
  }
  if (hasMeta) {
    return 'Used to measure Meta ad performance when you interact with our quote tools.'
  }
  return 'Used to measure paid ad performance.'
}

let gaInitialized = false
let metaInitialized = false
let adsInitialized = false

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function hasGtagLoaderInHead() {
  return Boolean(
    document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
  )
}

/** @param {string} id */
function initGoogleAnalytics(id) {
  if (!canUseDom() || gaInitialized || !id) return

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments)
    }

  if (!hasGtagLoaderInHead() && !document.querySelector(`script[data-smh-gtag="${id}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    script.setAttribute('data-smh-gtag', id)
    document.head.appendChild(script)
  }

  window.gtag('js', new Date())
  window.gtag('config', id, { send_page_view: false, anonymize_ip: true })
  gaInitialized = true
}

/** @param {string} id */
function initMetaPixel(id) {
  if (!canUseDom() || metaInitialized || !id || window.fbq) return

  /* eslint-disable */
  ;(function (f, b, e, v, n, t, s) {
    if (f.fbq) return
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = true
    t.src = v
    t.setAttribute('data-smh-meta-pixel', id)
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */

  window.fbq('init', id)
  metaInitialized = true
}

/** @param {string} conversionId AW-XXXXXXXXX */
function initGoogleAds(conversionId) {
  if (!canUseDom() || adsInitialized || !conversionId) return
  if (conversionId.toUpperCase() === RETIRED_GOOGLE_ADS_CONVERSION_ID) return

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments)
    }

  // index.html already loads gtag.js once and configs this destination.
  // A second config would send another Ads page view.
  if (!hasGtagLoaderInHead()) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_TAG_ID)}`
    script.setAttribute('data-smh-gtag', GOOGLE_TAG_ID)
    document.head.appendChild(script)
    window.gtag('js', new Date())
    window.gtag('config', GOOGLE_TAG_ID, { send_page_view: false })
    window.gtag('config', conversionId, { send_page_view: false })
    window.gtag('config', getGaMeasurementId(), { send_page_view: false, anonymize_ip: true })
  }

  adsInitialized = true
}

/** Sync third-party scripts with current consent + env configuration. */
export function syncMarketingPixels() {
  if (!canUseDom()) return

  const gaId = getGaMeasurementId()
  const metaId = getMetaPixelId()
  const adsId = getGoogleAdsConversionId()

  if (gaId && hasAnalyticsConsent()) {
    initGoogleAnalytics(gaId)
  }

  if (metaId && hasMarketingConsent()) {
    initMetaPixel(metaId)
  }

  if (adsId && hasMarketingConsent()) {
    initGoogleAds(adsId)
  }
}

/**
 * @param {string} pathname
 * @param {string} [search]
 */
export function trackMarketingPageView(pathname, search = '') {
  syncMarketingPixels()

  const path = `${pathname || '/'}${search || ''}`
  const location = typeof window !== 'undefined' ? window.location.href : path

  if (gaInitialized && hasAnalyticsConsent() && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      send_to: getAnalyticsSendTo(),
      page_path: path,
      page_location: location,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
    })
  }

  if (metaInitialized && hasMarketingConsent() && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView')
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.source]
 * @param {string} [params.href]
 */
export function trackMarketingQuoteClick(params = {}) {
  syncMarketingPixels()

  const payload = {
    event_category: 'engagement',
    event_label: params.source || 'quote_button',
    link_url: params.href || undefined,
  }

  if (gaInitialized && hasAnalyticsConsent() && typeof window.gtag === 'function') {
    window.gtag('event', 'generate_lead', { ...payload, send_to: getAnalyticsSendTo() })
  }

  if (metaInitialized && hasMarketingConsent() && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', {
      content_name: params.source || 'quote_button',
    })
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.quoteRef]
 * @param {number} [params.value]
 * @param {string} [params.currency]
 */
export function trackMarketingQuoteSubmit(params = {}) {
  syncMarketingPixels()

  const value = Number(params.value)
  const hasValue = Number.isFinite(value) && value > 0
  const payload = {
    event_category: 'conversion',
    event_label: 'quote_form_submit',
    quote_ref: params.quoteRef || undefined,
    value: hasValue ? value : undefined,
    currency: hasValue ? params.currency || 'GBP' : undefined,
  }

  if (gaInitialized && hasAnalyticsConsent() && typeof window.gtag === 'function') {
    window.gtag('event', 'generate_lead', { ...payload, send_to: getAnalyticsSendTo() })
  }

  if (metaInitialized && hasMarketingConsent() && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', {
      content_name: 'quote_form_submit',
      value: hasValue ? value : undefined,
      currency: hasValue ? params.currency || 'GBP' : undefined,
    })
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.transactionId]
 * @param {string} [params.quoteRef]
 * @param {number} [params.value]
 * @param {string} [params.currency]
 */
export function trackMarketingPurchase(params = {}) {
  syncMarketingPixels()

  const transactionId = String(params.transactionId || params.quoteRef || '').trim()
  if (!transactionId || typeof window === 'undefined') return

  const dedupeKey = `smh_px_purchase_${transactionId}`
  if (window.sessionStorage.getItem(dedupeKey)) return
  window.sessionStorage.setItem(dedupeKey, '1')

  const value = Number(params.value)
  const hasValue = Number.isFinite(value) && value > 0
  const currency = params.currency || 'GBP'

  if (gaInitialized && hasAnalyticsConsent() && typeof window.gtag === 'function') {
    if (hasValue) {
      window.gtag('event', 'purchase', {
        send_to: getAnalyticsSendTo(),
        transaction_id: transactionId,
        value,
        currency,
      })
    } else {
      window.gtag('event', 'sign_up', {
        send_to: getAnalyticsSendTo(),
        method: 'stripe_payment',
        transaction_id: transactionId,
      })
    }
  }

  if (metaInitialized && hasMarketingConsent() && typeof window.fbq === 'function') {
    if (hasValue) {
      window.fbq('track', 'Purchase', { value, currency })
    } else {
      window.fbq('track', 'CompleteRegistration')
    }
  }
}

/**
 * Google Ads conversion (marketing consent only).
 *
 * @param {string} sendTo AW-xxx/label
 * @param {object} [params]
 * @param {string} [params.transactionId]
 * @param {number} [params.value]
 * @param {string} [params.currency]
 */
export function trackGoogleAdsConversion(sendTo, params = {}) {
  syncMarketingPixels()

  const sendToTrimmed = typeof sendTo === 'string' ? sendTo.trim() : ''
  if (!sendToTrimmed || !hasMarketingConsent()) return
  if (sendToTrimmed.toUpperCase().startsWith(`${RETIRED_GOOGLE_ADS_CONVERSION_ID}/`)) return
  if (!adsInitialized || typeof window.gtag !== 'function') return

  const transactionId = String(params.transactionId || '').trim()
  if (transactionId) {
    const dedupeKey = `smh_ads_conv_${transactionId}`
    if (window.sessionStorage.getItem(dedupeKey)) return
    window.sessionStorage.setItem(dedupeKey, '1')
  }

  const value = Number(params.value)
  const hasValue = Number.isFinite(value) && value > 0
  const currency = params.currency || 'GBP'

  window.gtag('event', 'conversion', {
    send_to: sendToTrimmed,
    value: hasValue ? value : undefined,
    currency: hasValue ? currency : undefined,
    transaction_id: transactionId || undefined,
  })
}

/** @returns {boolean} */
export function shouldShowMarketingScripts() {
  return (
    (isGaConfigured() && hasAnalyticsConsent()) ||
    (isMetaPixelConfigured() && hasMarketingConsent()) ||
    (isGoogleAdsConfigured() && hasMarketingConsent())
  )
}

/** Re-run pixel bootstrap when consent changes. */
export function subscribeMarketingConsentChanges(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback(getCookieConsent())
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler)
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler)
}
