import { loadQuoteDraft } from './quoteDraftStorage'
import { initialWizardState, makeQuoteRef } from './quoteWizardDefaults'
import {
  clearResumeSavedQuote,
  consumeNewQuoteFromServiceCard,
  isResumeSavedQuote,
} from './quoteSessionMode'
import { resolveServiceLabel } from './normalizeServiceType'
import {
  bindWebsiteLeadSessionId,
  rotateWebsiteLeadSessionId,
} from './websiteLeadSession'

const CUSTOMER_LEAD_CACHE_KEY = 'shiftmyhome_customer_lead_cache_v1'

function clearLeadCacheQuietly() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CUSTOMER_LEAD_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Initial wizard state: only hydrate localStorage when user chose “Continue saved quote”.
 * Service-card visits always start a fresh quote for the route’s service type.
 * Fresh quotes rotate the customer-lead session; resumed quotes re-bind the draft session.
 * @param {string} serviceTypeProp
 */
export function resolveWizardBootstrap(serviceTypeProp) {
  const propLabel = resolveServiceLabel(serviceTypeProp)

  if (isResumeSavedQuote()) {
    const draft = loadQuoteDraft()
    if (draft) {
      if (draft.leadSessionId) {
        bindWebsiteLeadSessionId(draft.leadSessionId)
      }
      return {
        step: draft.step,
        quoteRef: draft.quoteRef,
        wizard: draft.wizard,
        serviceType: resolveServiceLabel(draft.serviceType) || propLabel,
        isResumed: true,
        dateWasReset: Boolean(draft.dateWasReset),
        leadSessionId: draft.leadSessionId || bindWebsiteLeadSessionId(),
      }
    }
    clearResumeSavedQuote()
  }

  const fromServiceCard = consumeNewQuoteFromServiceCard()
  const leadSessionId = rotateWebsiteLeadSessionId()
  clearLeadCacheQuietly()

  return {
    step: 1,
    quoteRef: makeQuoteRef(),
    wizard: initialWizardState(),
    serviceType: resolveServiceLabel(fromServiceCard?.serviceType) || propLabel,
    isResumed: false,
    dateWasReset: false,
    leadSessionId,
  }
}
