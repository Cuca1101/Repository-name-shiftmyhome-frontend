/**
 * Scroll/focus the first quote wizard validation error (customer quote flow only).
 * Does not target admin sidebars or unrelated page regions.
 */

import { isWizardArrivalValid } from './arrivalWizardValidation'
import { isMoveDateOnOrAfterToday } from './moveDateLocal'

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

export const QUOTE_ERROR_SCROLL_HINTS = {
  feedback: '[data-quote-wizard-feedback="true"]',
  crewSize: '[data-quote-field="crew-size"]',
  inventory: '[data-quote-field="inventory"]',
  pickupAddress: '[data-quote-field="pickup-address"]',
  deliveryAddress: '[data-quote-field="delivery-address"]',
  pickupAccess: '[data-quote-field="pickup-access"]',
  deliveryAccess: '[data-quote-field="delivery-access"]',
  moveDate: '[data-quote-field="move-date"]',
  arrival: '[data-quote-field="arrival"]',
  contactDetails: '[data-quote-field="contact-details"]',
  payment: '[data-quote-field="payment"]',
}

/**
 * @param {object} wizard
 * @param {string} [feedbackText]
 * @returns {string}
 */
export function resolveStep1ScrollHint(wizard, feedbackText = '') {
  if (/suggestions/i.test(feedbackText)) {
    if (wizard.pickupLng == null || wizard.pickupLat == null) {
      return QUOTE_ERROR_SCROLL_HINTS.pickupAddress
    }
    return QUOTE_ERROR_SCROLL_HINTS.deliveryAddress
  }
  if (wizard.pickupAddress.trim().length <= 2) return QUOTE_ERROR_SCROLL_HINTS.pickupAddress
  if (wizard.deliveryAddress.trim().length <= 2) return QUOTE_ERROR_SCROLL_HINTS.deliveryAddress
  if (
    HAS_MAPBOX_TOKEN &&
    (wizard.pickupLng == null ||
      wizard.pickupLat == null ||
      wizard.deliveryLng == null ||
      wizard.deliveryLat == null)
  ) {
    if (wizard.pickupLng == null || wizard.pickupLat == null) {
      return QUOTE_ERROR_SCROLL_HINTS.pickupAddress
    }
    return QUOTE_ERROR_SCROLL_HINTS.deliveryAddress
  }
  if (wizard.pickupFloor == null) return QUOTE_ERROR_SCROLL_HINTS.pickupAccess
  if (wizard.deliveryFloor == null) return QUOTE_ERROR_SCROLL_HINTS.deliveryAccess
  if (!wizard.moveDate || !isMoveDateOnOrAfterToday(wizard.moveDate)) {
    return QUOTE_ERROR_SCROLL_HINTS.moveDate
  }
  if (!isWizardArrivalValid(wizard) || /arrival|flexible from|exact arrival/i.test(feedbackText)) {
    return QUOTE_ERROR_SCROLL_HINTS.arrival
  }
  if (!(Number(wizard.distanceMiles) > 0)) return QUOTE_ERROR_SCROLL_HINTS.pickupAddress
  return QUOTE_ERROR_SCROLL_HINTS.feedback
}

/**
 * @param {object} wizard
 * @returns {string}
 */
export function resolveStep2ScrollHint(wizard) {
  const crewOk = Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4
  if (!crewOk) return QUOTE_ERROR_SCROLL_HINTS.crewSize
  if (wizard.inventoryLines.length === 0) return QUOTE_ERROR_SCROLL_HINTS.inventory
  return QUOTE_ERROR_SCROLL_HINTS.feedback
}

const QUOTE_ROOT_SELECTORS = ['#quote', '.quote-wizard-section']

const ERROR_SELECTORS = [
  '[data-quote-wizard-feedback="true"]',
  '[data-quote-error="true"]',
  '.quote-error',
  '[role="alert"]',
  '[aria-invalid="true"]',
]

const HIGHLIGHT_CLASS = 'quote-error-highlight'
const HIGHLIGHT_MS = 2200
const FOCUS_DELAY_MS = 380
const HEADER_OFFSET_PX = 88

/**
 * @param {'fullName'|'phone'|'email'} field
 * @returns {string}
 */
export function quoteContactFieldSelector(field) {
  const mobile =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const suffix = mobile ? 'mobile' : 'desktop'
  return `#quote-wizard-${field}-${suffix}`
}

/**
 * @param {HTMLElement | null} el
 * @returns {HTMLElement | null}
 */
function findScrollableAncestor(el) {
  let node = el?.parentElement
  while (node && node !== document.body) {
    const { overflowY, overflow } = getComputedStyle(node)
    const scrollable =
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflow === 'auto' ||
      overflow === 'scroll'
    if (scrollable && node.scrollHeight > node.clientHeight + 2) return node
    node = node.parentElement
  }
  return null
}

/**
 * @param {Element | null} el
 */
function isVisible(el) {
  if (!(el instanceof HTMLElement)) return false
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * @returns {HTMLElement | null}
 */
function getQuoteWizardRoot() {
  for (const sel of QUOTE_ROOT_SELECTORS) {
    const el = document.querySelector(sel)
    if (el instanceof HTMLElement) return el
  }
  return null
}

/**
 * @param {ParentNode | null} scope
 * @param {string} [hintSelector]
 * @returns {HTMLElement | null}
 */
function findFirstErrorTarget(scope, hintSelector) {
  const root = scope instanceof HTMLElement ? scope : getQuoteWizardRoot()
  if (!root) return null

  if (hintSelector) {
    const hinted = root.querySelector(hintSelector)
    if (isVisible(hinted)) return /** @type {HTMLElement} */ (hinted)
  }

  for (const sel of ERROR_SELECTORS) {
    const nodes = root.querySelectorAll(sel)
    for (const node of nodes) {
      if (isVisible(node)) return /** @type {HTMLElement} */ (node)
    }
  }

  return null
}

/**
 * @param {HTMLElement} el
 * @param {number} offsetPx
 */
function scrollElementIntoViewWithOffset(el, offsetPx) {
  const scrollParent = findScrollableAncestor(el)
  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const top = scrollParent.scrollTop + (elRect.top - parentRect.top) - offsetPx
    scrollParent.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    return
  }

  const top = window.scrollY + el.getBoundingClientRect().top - offsetPx
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/**
 * @param {HTMLElement} target
 */
function flashHighlight(target) {
  target.classList.add(HIGHLIGHT_CLASS)
  window.setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS)
}

/**
 * @param {HTMLElement} target
 */
function focusFieldNear(target) {
  const fieldRoot =
    target.closest('[data-quote-field]') instanceof HTMLElement
      ? target.closest('[data-quote-field]')
      : target

  const focusable =
    fieldRoot instanceof HTMLInputElement ||
    fieldRoot instanceof HTMLSelectElement ||
    fieldRoot instanceof HTMLTextAreaElement
      ? fieldRoot
      : fieldRoot.querySelector?.(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[role="radio"]:not([disabled])',
        )

  if (!(focusable instanceof HTMLElement) || typeof focusable.focus !== 'function') return

  window.setTimeout(() => {
    try {
      focusable.focus({ preventScroll: true })
    } catch {
      focusable.focus()
    }
  }, FOCUS_DELAY_MS)
}

/**
 * @param {{
 *   hint?: string,
 *   focusField?: boolean,
 *   offsetPx?: number,
 * }} [options]
 * @returns {boolean} whether a target was found and scrolled
 */
export function scrollToFirstQuoteError(options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const { hint, focusField = true, offsetPx = HEADER_OFFSET_PX } = options
  const root = getQuoteWizardRoot()
  const target = findFirstErrorTarget(root, hint)
  if (!target) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[quote-scroll] no error target found', { hint })
    }
    return false
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[quote-scroll] scrolling to', {
      hint: hint || null,
      tag: target.tagName,
      field: target.getAttribute('data-quote-field'),
    })
  }

  scrollElementIntoViewWithOffset(target, offsetPx)
  flashHighlight(target)
  if (focusField) focusFieldNear(target)
  return true
}

/**
 * Run scroll after React paints error UI.
 * @param {{
 *   hint?: string,
 *   focusField?: boolean,
 *   contactField?: 'fullName'|'phone'|'email',
 * }} [options]
 */
export function scheduleQuoteValidationScroll(options = {}) {
  const { contactField, ...rest } = options
  const hint = rest.hint || (contactField ? quoteContactFieldSelector(contactField) : undefined)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (contactField) {
        const mobile =
          typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
        const suffix = mobile ? 'mobile' : 'desktop'
        const section = document.getElementById(`quote-wizard-contact-details-${suffix}`)
        if (section) scrollElementIntoViewWithOffset(section, HEADER_OFFSET_PX)
      }
      scrollToFirstQuoteError({ ...rest, hint })
    })
  })
}
