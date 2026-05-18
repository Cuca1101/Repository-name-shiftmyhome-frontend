import { SERVICE_PAGES } from '../constants/servicePages'
import { initialWizardState } from './quoteWizardDefaults'

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
    const step = Math.min(4, Math.max(1, Number(data.step) || 1))
    return {
      version: DRAFT_VERSION,
      savedAt: data.savedAt,
      step,
      quoteRef: data.quoteRef,
      serviceType: typeof data.serviceType === 'string' ? data.serviceType : '',
      returnPath: typeof data.returnPath === 'string' ? data.returnPath : '/quote',
      wizard: hydrateWizardFromDraft(data.wizard),
      estimatedTotal:
        typeof data.estimatedTotal === 'number' && Number.isFinite(data.estimatedTotal)
          ? data.estimatedTotal
          : null,
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
 */
