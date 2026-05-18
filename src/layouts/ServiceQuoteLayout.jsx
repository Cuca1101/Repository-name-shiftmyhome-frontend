import QuoteNavbar from '../components/QuoteNavbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import { CoverageModalProvider } from '../context/CoverageModalContext'
import { WebsiteCmsProvider } from '../context/WebsiteCmsContext'

/** Service quote routes only — compact header, no full-site navbar or announcement bar. */
export default function ServiceQuoteLayout({ children }) {
  return (
    <CoverageModalProvider>
      <WebsiteCmsProvider>
        <div className="flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x">
          <QuoteNavbar />
          <main className="min-w-0 flex-1 w-full max-w-full overflow-x-hidden pb-24 md:pb-0">{children}</main>
          <Footer />
          <WhatsAppButton />
        </div>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
