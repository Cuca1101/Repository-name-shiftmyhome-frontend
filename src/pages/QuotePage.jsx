import { useEffect } from 'react'
import PublicLayout from '../layouts/PublicLayout'
import SeoHead from '../components/seo/SeoHead'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'
import { preloadStripeJs } from '../lib/stripePromise'

export default function QuotePage() {
  useEffect(() => {
    preloadStripeJs()
  }, [])

  return (
    <PublicLayout>
      <SeoHead
        title="Instant Removal Quote | ShiftMyHome"
        description="Get an instant removals quote with ShiftMyHome for house removals, furniture delivery, man with van and moving services across Scotland."
        path="/quote"
        includeSocial
      />
      <div className="quote-page-shell quote-flow-layout min-w-0 bg-[#e7eef6] px-3 py-4 sm:px-4 sm:py-8" data-quote-flow>
        <CustomerQuoteCalculator pageChrome />
      </div>
    </PublicLayout>
  )
}
