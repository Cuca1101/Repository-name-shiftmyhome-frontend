import { SERVICE_PAGES } from '../constants/servicePages'
import { initialWizardState, QUOTE_WIZARD_MAX_STEP } from './quoteWizardDefaults'
import { step3ContactDetailsValid } from './quoteWizardStep3ContactScroll'
import { sanitizeDraftMoveDate } from './moveDateLocal'

export const QUOTE_DRAFT_STORAGE_KEY = 'shiftmyhome_quote_draft_v1'

const DRAFT_VERSION = 1
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * @param {string} serviceType
 */
export function pathForServiceType(serviceType) {
  const page = SERVICE_PAGES.find((p) => p.serviceType === serviceType)
  return page?.path ?? '/quote'
}

/**
 * @param {unknown} stored
 */
export function hydrateWizardFromDraft(stored) {
  const base = initialWizardState()
  if (!stored || typeof stored !== 'object') return base
  const src = /** @type {Record<string, unknown>} */ (stored)
  const out = { ...base }
  for (const key of Object.keys(base)) {
    if (src[key] !== undefined) out[key] = src[key]
  }
  if (Array.isArray(src.inventoryLines)) {
    out.inventoryLines = src.inventoryLines
      .filter((line) => line && typeof line === 'object')
      .map((line) => ({ ...line }))
  }
  return normalizeArrivalInWizard(out)
}

/** Map legacy preset arrival windows to flex_window + times. */
function normalizeArrivalInWizard(wizard) {
  const legacy = {
    flex: { from: '08:00', until: '20:00' },
    morning: { from: '08:00', until: '12:00' },
    midday: { from: '12:00', until: '16:00' },
    evening: { from: '16:00', until: '20:00' },
    afternoon: { from: '16:00', until: '20:00' },
  }
  const preset = legacy[wizard.arrivalWindow]
  if (preset) {
    wizard.arrivalWindow = 'flex_window'
    if (!wizard.flexibleArrivalFrom) wizard.flexibleArrivalFrom = preset.from
    if (!wizard.flexibleArrivalUntil) wizard.flexibleArrivalUntil = preset.until
    wizard.exactArrivalTime = ''
  }
  return wizard
}

/**
 * @returns {import('./quoteDraftStorage').QuoteDraftPayload | null}
 */
export function loadQuoteDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== DRAFT_VERSION) return null
    if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > MAX_AGE_MS) {
      clearQuoteDraft()
      return null
    }
    if (!data.wizard || typeof data.quoteRef !== 'string') return null
    const rawStep = Math.max(1, Number(data.step) || 1)
    let wizard = hydrateWizardFromDraft(data.wizard)
    let step = Math.min(QUOTE_WIZARD_MAX_STEP, rawStep)
    if (rawStep === 4) {
      const inventoryReady =
        Array.isArray(wizard.inventoryLines) && wizard.inventoryLines.length > 0
      step =
        inventoryReady && step3ContactDetailsValid(wizard) ? 4 : 2
    } else if (rawStep === 3) {
      const inventoryReady =
        Array.isArray(wizard.inventoryLines) && wizard.inventoryLines.length > 0
      step = inventoryReady && step3ContactDetailsValid(wizard) ? 3 : 2
    }
    const serviceType = typeof data.serviceType === 'string' ? data.serviceType : ''
    const returnPath = typeof data.returnPath === 'string' ? data.returnPath : '/quote'
    const estimatedTotal =
      typeof data.estimatedTotal === 'number' && Number.isFinite(data.estimatedTotal)
        ? data.estimatedTotal
        : null

    const sanitized = sanitizeDraftMoveDate(wizard, step)
    wizard = sanitized.wizard
    step = sanitized.step

    if (sanitized.dateWasReset) {
      saveQuoteDraft({
        step,
        quoteRef: data.quoteRef,
        serviceType,
        returnPath,
        wizard,
        estimatedTotal,
      })
    }

    return {
      version: DRAFT_VERSION,
      savedAt: data.savedAt,
      step,
      quoteRef: data.quoteRef,
      serviceType,
      returnPath,
      wizard,
      estimatedTotal,
      dateWasReset: sanitized.dateWasReset,
    }
  } catch {
    clearQuoteDraft()
    return null
  }
}

/** @param {Omit<import('./quoteDraftStorage').QuoteDraftPayload, 'version' | 'savedAt'>} payload */
export function saveQuoteDraft(payload) {
  if (typeof window === 'undefined') return
  try {
    const body = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      step: payload.step,
      quoteRef: payload.quoteRef,
      serviceType: payload.serviceType,
      returnPath: payload.returnPath,
      wizard: payload.wizard,
      estimatedTotal: payload.estimatedTotal,
    }
    window.localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(body))
    window.dispatchEvent(new Event('shiftmyhome-quote-draft'))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearQuoteDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY)
    window.dispatchEvent(new Event('shiftmyhome-quote-draft'))
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function hasQuoteDraft() {
  return loadQuoteDraft() != null
}

/**
 * @typedef {Object} QuoteDraftPayload
 * @property {number} version
 * @property {number} savedAt
 * @property {number} step
 * @property {string} quoteRef
 * @property {string} serviceType
 * @property {string} returnPath
 * @property {ReturnType<typeof initialWizardState>} wizard
 * @property {number | null} estimatedTotal
 * @property {boolean} [dateWasReset]
 */
