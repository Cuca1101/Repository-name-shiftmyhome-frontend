import { SERVICE_TYPES } from '../constants/serviceTypes'
import { getLocalDateYYYYMMDD, sanitizeDraftMoveDate } from './moveDateLocal'
import { initialWizardState, makeQuoteRef } from './quoteWizardDefaults'
import { hydrateWizardFromDraft } from './quoteDraftStorage'

export const ADMIN_PHONE_BOOKING_DRAFT_STORAGE_KEY = 'shiftmyhome_admin_phone_booking_draft_v1'

const DRAFT_VERSION = 1
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const MAX_STEP = 3

/**
 * @typedef {Object} AdminPhoneBookingDraftPayload
 * @property {number} version
 * @property {number} savedAt
 * @property {number} step
 * @property {ReturnType<typeof initialWizardState>} wizard
 * @property {string} serviceType
 * @property {string} quoteRef
 * @property {string} customQuoteRef
 * @property {boolean} useCalculatedPrice
 * @property {string} finalPriceOverride
 * @property {string} overrideReason
 * @property {string} adminNote
 * @property {boolean} [dateWasReset]
 */

/**
 * @returns {AdminPhoneBookingDraftPayload | null}
 */
export function loadAdminPhoneBookingDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ADMIN_PHONE_BOOKING_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== DRAFT_VERSION) return null
    if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > MAX_AGE_MS) {
      clearAdminPhoneBookingDraft()
      return null
    }
    if (!data.wizard || typeof data.quoteRef !== 'string') return null

    let wizard = hydrateWizardFromDraft(data.wizard)
    let step = Math.min(MAX_STEP, Math.max(1, Number(data.step) || 1))
    const sanitized = sanitizeDraftMoveDate(wizard, step)
    wizard = sanitized.wizard
    step = sanitized.step

    const payload = {
      version: DRAFT_VERSION,
      savedAt: data.savedAt,
      step,
      wizard,
      serviceType:
        typeof data.serviceType === 'string' && data.serviceType.trim()
          ? data.serviceType
          : SERVICE_TYPES[0],
      quoteRef: data.quoteRef,
      customQuoteRef: typeof data.customQuoteRef === 'string' ? data.customQuoteRef : '',
      useCalculatedPrice: data.useCalculatedPrice !== false,
      finalPriceOverride:
        typeof data.finalPriceOverride === 'string' ? data.finalPriceOverride : '',
      overrideReason: typeof data.overrideReason === 'string' ? data.overrideReason : '',
      adminNote: typeof data.adminNote === 'string' ? data.adminNote : '',
      dateWasReset: sanitized.dateWasReset,
    }

    if (sanitized.dateWasReset) {
      saveAdminPhoneBookingDraft(payload)
    }

    return payload
  } catch {
    clearAdminPhoneBookingDraft()
    return null
  }
}

/** @param {Omit<AdminPhoneBookingDraftPayload, 'version' | 'savedAt'>} payload */
export function saveAdminPhoneBookingDraft(payload) {
  if (typeof window === 'undefined') return
  try {
    const body = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      step: payload.step,
      wizard: payload.wizard,
      serviceType: payload.serviceType,
      quoteRef: payload.quoteRef,
      customQuoteRef: payload.customQuoteRef,
      useCalculatedPrice: payload.useCalculatedPrice,
      finalPriceOverride: payload.finalPriceOverride,
      overrideReason: payload.overrideReason,
      adminNote: payload.adminNote,
    }
    window.localStorage.setItem(ADMIN_PHONE_BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(body))
    window.dispatchEvent(new Event('shiftmyhome-admin-phone-booking-draft'))
  } catch {
    /* quota / private mode */
  }
}

export function clearAdminPhoneBookingDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ADMIN_PHONE_BOOKING_DRAFT_STORAGE_KEY)
    window.dispatchEvent(new Event('shiftmyhome-admin-phone-booking-draft'))
  } catch {
    /* ignore */
  }
}

export function hasAdminPhoneBookingDraft() {
  return loadAdminPhoneBookingDraft() != null
}

/** Fresh form state when no draft exists. */
export function freshAdminPhoneBookingFormState() {
  return {
    wizard: { ...initialWizardState(), moveDate: getLocalDateYYYYMMDD() },
    serviceType: SERVICE_TYPES[0],
    quoteRef: makeQuoteRef(),
    customQuoteRef: '',
    useCalculatedPrice: true,
    finalPriceOverride: '',
    overrideReason: '',
    adminNote: '',
    step: 1,
  }
}

/**
 * @returns {ReturnType<typeof freshAdminPhoneBookingFormState> & { draftRestored?: boolean, dateWasReset?: boolean }}
 */
export function bootstrapAdminPhoneBookingFormState() {
  const draft = loadAdminPhoneBookingDraft()
  if (!draft) return freshAdminPhoneBookingFormState()
  return {
    wizard: draft.wizard,
    serviceType: draft.serviceType,
    quoteRef: draft.quoteRef,
    customQuoteRef: draft.customQuoteRef,
    useCalculatedPrice: draft.useCalculatedPrice,
    finalPriceOverride: draft.finalPriceOverride,
    overrideReason: draft.overrideReason,
    adminNote: draft.adminNote,
    step: draft.step,
    draftRestored: true,
    dateWasReset: Boolean(draft.dateWasReset),
  }
}
