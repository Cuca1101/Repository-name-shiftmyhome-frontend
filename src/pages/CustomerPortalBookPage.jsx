import PortalShell from '../components/customer-portal/PortalShell'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'

export default function CustomerPortalBookPage() {
  return (
    <PortalShell
      title="New booking | ShiftMyHome"
      description="Start a new ShiftMyHome booking from your account."
      path="/portal/book"
    >
      <div className="quote-page-shell quote-flow-layout -mx-4 bg-[#e7eef6] px-3 py-3 sm:-mx-6 sm:px-4 sm:py-5 xl:-mx-8" data-quote-flow>
        <CustomerQuoteCalculator pageChrome />
      </div>
    </PortalShell>
  )
}
