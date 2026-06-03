import QuoteNavbar from '../components/QuoteNavbar'
import WhatsAppButton from '../components/WhatsAppButton'
import FloatingReviewsBadge from '../components/reviews/FloatingReviewsBadge'
import { CoverageModalProvider } from '../context/CoverageModalContext'
import { WebsiteCmsProvider } from '../context/WebsiteCmsContext'
import { SeoSettingsProvider } from '../context/SeoSettingsContext'

/** Service quote routes only — compact header, no full-site navbar or announcement bar. */
export default function ServiceQuoteLayout({ children }) {
  return (
    <CoverageModalProvider>
      <WebsiteCmsProvider>
        <SeoSettingsProvider>
        <div className="quote-flow-layout flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x" data-quote-flow>
          <QuoteNavbar />
          <main className="box-border min-w-0 flex-1 w-full max-w-full overflow-x-hidden pb-[4.25rem] md:pb-0">
            {children}
          </main>
        </div>
        <FloatingReviewsBadge variant="quote-flow" />
        <WhatsAppButton variant="quote-flow" />
        </SeoSettingsProvider>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
