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

/** @returns {string} */
export function getGaMeasurementId() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID
  return typeof id === 'string' ? id.trim() : ''
}

/** @returns {boolean} */
export function isMetaPixelConfigured() {
  return Boolean(getMetaPixelId())
}

/** @returns {boolean} */
export function isGaConfigured() {
  return Boolean(getGaMeasurementId())
}

let gaInitialized = false
let metaInitialized = false

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
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

  if (!document.querySelector(`script[data-smh-gtag="${id}"]`)) {
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

/** Sync third-party scripts with current consent + env configuration. */
export function syncMarketingPixels() {
  if (!canUseDom()) return

  const gaId = getGaMeasurementId()
  const metaId = getMetaPixelId()

  if (gaId && hasAnalyticsConsent()) {
    initGoogleAnalytics(gaId)
  }

  if (metaId && hasMarketingConsent()) {
    initMetaPixel(metaId)
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
    window.gtag('event', 'generate_lead', payload)
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
    window.gtag('event', 'generate_lead', payload)
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
        transaction_id: transactionId,
        value,
        currency,
      })
    } else {
      window.gtag('event', 'sign_up', {
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

/** @returns {boolean} */
export function shouldShowMarketingScripts() {
  return (
    (isGaConfigured() && hasAnalyticsConsent()) || (isMetaPixelConfigured() && hasMarketingConsent())
  )
}

/** Re-run pixel bootstrap when consent changes. */
export function subscribeMarketingConsentChanges(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback(getCookieConsent())
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler)
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler)
}
