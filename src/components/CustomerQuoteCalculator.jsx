import QuoteWizard from './quote-wizard/QuoteWizard'
import { SERVICE_TYPES } from '../constants/serviceTypes'

/** Homepage quote section — same 4-step wizard as service pages, with service type dropdown on step 1. */
export default function CustomerQuoteCalculator() {
  return <QuoteWizard serviceType={SERVICE_TYPES[0]} allowServiceChange />
}
