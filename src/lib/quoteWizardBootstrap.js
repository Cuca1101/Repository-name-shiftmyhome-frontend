import { loadQuoteDraft } from './quoteDraftStorage'
import { initialWizardState, makeQuoteRef } from './quoteWizardDefaults'
import {
  clearResumeSavedQuote,
  consumeNewQuoteFromServiceCard,
  isResumeSavedQuote,
} from './quoteSessionMode'

/**
 * Initial wizard state: only hydrate localStorage when user chose “Continue saved quote”.
 * Service-card visits always start a fresh quote for the route’s service type.
 * @param {string} serviceTypeProp
 */
export function resolveWizardBootstrap(serviceTypeProp) {
  if (isResumeSavedQuote()) {
    const draft = loadQuoteDraft()
    if (draft) {
      return {
        step: draft.step,
        quoteRef: draft.quoteRef,
        wizard: draft.wizard,
        serviceType: draft.serviceType || serviceTypeProp,
        isResumed: true,
        dateWasReset: Boolean(draft.dateWasReset),
      }
    }
    clearResumeSavedQuote()
  }

  const fromServiceCard = consumeNewQuoteFromServiceCard()

  return {
    step: 1,
    quoteRef: makeQuoteRef(),
    wizard: initialWizardState(),
    serviceType: fromServiceCard?.serviceType || serviceTypeProp,
    isResumed: false,
    dateWasReset: false,
  }
}
