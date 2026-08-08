/**
 * Hydrate quote wizard draft from customer_leads.wizard_data (server resume).
 */
import { initialWizardState, QUOTE_WIZARD_MAX_STEP } from './quoteWizardDefaults'
import { hydrateWizardFromDraft, pathForServiceType, saveQuoteDraft } from './quoteDraftStorage'
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

  const merged = {
    ...initialWizardState(),
    ...s1,
    ...s2,
    ...s3,
    serviceType: s1.serviceType || s3.serviceType || '',
    inventoryLines: Array.isArray(s2.inventoryLines) ? s2.inventoryLines.map((l) => ({ ...l })) : [],
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

  const estimatedTotal =
    lead?.estimated_total != null && Number.isFinite(Number(lead.estimated_total))
      ? Number(lead.estimated_total)
      : s3Estimated(lead?.wizard_data)

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
  }
}

/** @param {unknown} wizardData */
function s3Estimated(wizardData) {
  const wd = wizardData && typeof wizardData === 'object' ? wizardData : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}
  const n = Number(s3.estimatedTotal)
  return Number.isFinite(n) ? n : null
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
