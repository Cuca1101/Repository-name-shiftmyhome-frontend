/**
 * Hydrate quote wizard draft from customer_leads.wizard_data (server resume).
 */
import { initialWizardState, QUOTE_WIZARD_MAX_STEP } from './quoteWizardDefaults'
import { hydrateWizardFromDraft, pathForServiceType, saveQuoteDraft } from './quoteDraftStorage'
import { resolveSavedQuoteTotal, buildPriceAffectingFingerprint } from './quoteResumePriceLock'
import { markResumeSavedQuote } from './quoteSessionMode'
import { step3ContactDetailsValid } from './quoteWizardStep3ContactScroll'
import { bindWebsiteLeadSessionId, getWebsiteLeadSessionId } from './websiteLeadSession'

export const QUOTE_WELCOME_BACK_SESSION_KEY = 'shiftmyhome_quote_welcome_back_v1'

/**
 * @param {Record<string, unknown>|null|undefined} wizardData
 * @returns {ReturnType<typeof initialWizardState>}
 */
export function wizardStateFromCustomerLeadData(wizardData) {
  const wd = wizardData && typeof wizardData === 'object' ? wizardData : {}
  const s1 = wd.step1 && typeof wd.step1 === 'object' ? wd.step1 : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? wd.step2 : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}

  // Prefer first defined crewSize — null in step3 must not wipe a good step2 value.
  // Engine defaults missing crew to 2 (often £85); resume must keep 1-man quotes at 1.
  let crewSize =
    s3.crewSize != null && s3.crewSize !== ''
      ? s3.crewSize
      : s2.crewSize != null && s2.crewSize !== ''
        ? s2.crewSize
        : null
  if (crewSize == null || crewSize === '') {
    crewSize = 1
  } else {
    const n = Number(crewSize)
    crewSize = Number.isFinite(n) && n >= 1 && n <= 4 ? Math.round(n) : 1
  }

  const merged = {
    ...initialWizardState(),
    ...s1,
    ...s2,
    ...s3,
    crewSize,
    serviceType: s1.serviceType || s3.serviceType || '',
    inventoryLines: Array.isArray(s2.inventoryLines) ? s2.inventoryLines.map((l) => ({ ...l })) : [],
    mapboxRouteDurationSeconds:
      s1.mapboxRouteDurationSeconds != null && s1.mapboxRouteDurationSeconds !== ''
        ? s1.mapboxRouteDurationSeconds
        : s3.mapboxRouteDurationSeconds != null && s3.mapboxRouteDurationSeconds !== ''
          ? s3.mapboxRouteDurationSeconds
          : null,
    pickupLng: s1.pickupLng ?? null,
    pickupLat: s1.pickupLat ?? null,
    deliveryLng: s1.deliveryLng ?? null,
    deliveryLat: s1.deliveryLat ?? null,
  }

  return hydrateWizardFromDraft(merged)
}

/**
 * @param {{
 *   quote_ref?: string|null,
 *   service_type?: string|null,
 *   wizard_step?: number|null,
 *   wizard_data?: Record<string, unknown>|null,
 *   estimated_total?: number|null,
 *   agreed_price?: number|null,
 *   calculated_total?: number|null,
 *   source_page_url?: string|null,
 * }} lead
 */
export function draftPayloadFromCustomerLead(lead) {
  const wizard = wizardStateFromCustomerLeadData(lead?.wizard_data)
  const serviceType =
    String(lead?.service_type || wizard.serviceType || '').trim() || 'House Removals'
  wizard.serviceType = serviceType

  let step = Math.min(QUOTE_WIZARD_MAX_STEP, Math.max(1, Number(lead?.wizard_step) || 1))
  const inventoryReady = Array.isArray(wizard.inventoryLines) && wizard.inventoryLines.length > 0
  if (step >= 4) {
    step = inventoryReady && step3ContactDetailsValid(wizard) ? 4 : inventoryReady ? 3 : 2
  } else if (step === 3) {
    step = inventoryReady && step3ContactDetailsValid(wizard) ? 3 : inventoryReady ? 3 : 2
  }

  const estimatedTotal = resolveSavedQuoteTotal(lead)

  const returnPath =
    (typeof lead?.source_page_url === 'string' && lead.source_page_url.startsWith('/')
      ? lead.source_page_url
      : null) || pathForServiceType(serviceType)

  return {
    step,
    quoteRef: String(lead?.quote_ref || '').trim() || `RESUME-${Date.now()}`,
    serviceType,
    returnPath,
    wizard,
    estimatedTotal,
    lockedTotal: estimatedTotal,
    lockedPriceFingerprint:
      estimatedTotal != null
        ? buildPriceAffectingFingerprint({ serviceType, wizard })
        : null,
  }
}

/**
 * Persist draft + mark resume session so the wizard restores full state.
 * Re-binds the customer lead session when provided so recovery continues the same lead.
 * @param {ReturnType<typeof draftPayloadFromCustomerLead> & { leadSessionId?: string|null }} draft
 * @param {{ welcomeBack?: boolean, leadSessionId?: string|null }} [opts]
 */
export function applyCustomerLeadResumeDraft(draft, opts = {}) {
  const sessionId = opts.leadSessionId || draft.leadSessionId || null
  if (sessionId) {
    bindWebsiteLeadSessionId(sessionId)
  }
  saveQuoteDraft({
    ...draft,
    leadSessionId: sessionId || getWebsiteLeadSessionId() || null,
  })
  markResumeSavedQuote()
  if (opts.welcomeBack !== false && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(QUOTE_WELCOME_BACK_SESSION_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  return draft.returnPath || pathForServiceType(draft.serviceType)
}

/** @returns {boolean} */
export function consumeWelcomeBackFlag() {
  if (typeof window === 'undefined') return false
  try {
    const v = window.sessionStorage.getItem(QUOTE_WELCOME_BACK_SESSION_KEY) === '1'
    window.sessionStorage.removeItem(QUOTE_WELCOME_BACK_SESSION_KEY)
    return v
  } catch {
    return false
  }
}
