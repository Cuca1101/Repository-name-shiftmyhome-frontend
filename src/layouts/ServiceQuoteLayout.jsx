import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WebsiteAnnouncementBar from '../components/WebsiteAnnouncementBar'
import WhatsAppButton from '../components/WhatsAppButton'
import FloatingReviewsBadge from '../components/reviews/FloatingReviewsBadge'
import { CoverageModalProvider } from '../context/CoverageModalContext'
import { WebsiteCmsProvider } from '../context/WebsiteCmsContext'
import { SeoSettingsProvider } from '../context/SeoSettingsContext'

/** Service pages use the same site header as the homepage and /quote. */
export default function ServiceQuoteLayout({ children }) {
  return (
    <CoverageModalProvider>
      <WebsiteCmsProvider>
        <SeoSettingsProvider>
        <div className="quote-flow-layout flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x" data-quote-flow>
          <WebsiteAnnouncementBar />
          <Navbar />
          <main className="quote-flow-main box-border min-w-0 flex-1 w-full max-w-full">
            {children}
          </main>
          <Footer />
        </div>
        <FloatingReviewsBadge variant="quote-flow" />
        <WhatsAppButton variant="quote-flow" />
        </SeoSettingsProvider>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
