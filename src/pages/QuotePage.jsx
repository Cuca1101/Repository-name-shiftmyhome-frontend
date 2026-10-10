import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import SeoHead from '../components/seo/SeoHead'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'
import { preloadStripeJs } from '../lib/stripePromise'

export default function QuotePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const accountBooking = params.get('from') === 'account'

  useEffect(() => {
    if (!accountBooking) return
    const next = new URLSearchParams(params)
    next.delete('from')
    const query = next.toString()
    navigate(`/portal/book${query ? `?${query}` : ''}`, { replace: true })
  }, [accountBooking, navigate, params])

  useEffect(() => {
    preloadStripeJs()
  }, [])

  if (accountBooking) return null

  return (
    <PublicLayout>
      <SeoHead
        title="Instant Removal Quote | ShiftMyHome"
        description="Get an instant removals quote with ShiftMyHome for house removals, furniture delivery, man with van and moving services across Scotland."
        path="/quote"
        includeSocial
      />
      <div className="quote-page-shell quote-flow-layout min-w-0 bg-[#e7eef6] px-3 py-3 sm:px-4 sm:py-5" data-quote-flow>
        <CustomerQuoteCalculator pageChrome />
      </div>
    </PublicLayout>
  )
}
