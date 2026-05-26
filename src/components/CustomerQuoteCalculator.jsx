import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import QuoteWizard from './quote-wizard/QuoteWizard'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { SERVICE_PAGES } from '../constants/servicePages'

function resolveServiceFromParam(param) {
  if (!param) return null
  const slug = param.trim().toLowerCase()
  const bySlug = SERVICE_PAGES.find((s) => s.slug === slug)
  if (bySlug) return bySlug.serviceType
  const byType = SERVICE_TYPES.find((t) => t.toLowerCase().replace(/\s+/g, '-') === slug)
  if (byType) return byType
  const byPartial = SERVICE_TYPES.find((t) => t.toLowerCase().includes(slug.replace(/-/g, ' ')))
  return byPartial || null
}

/** Homepage quote section — same 4-step wizard as service pages, with service type dropdown on step 1. */
export default function CustomerQuoteCalculator() {
  const [params] = useSearchParams()
  const serviceParam = params.get('service')

  const resolved = useMemo(() => resolveServiceFromParam(serviceParam), [serviceParam])
  const serviceType = resolved || SERVICE_TYPES[0]

  return <QuoteWizard serviceType={serviceType} allowServiceChange servicePreSelected={Boolean(resolved)} />
}
