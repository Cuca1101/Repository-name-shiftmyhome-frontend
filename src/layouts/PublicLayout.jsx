import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import FloatingReviewsBadge from '../components/reviews/FloatingReviewsBadge'
import HomeHashScroll from '../components/HomeHashScroll'
import HomePageSeo from '../components/seo/HomePageSeo'
import WebsiteAnnouncementBar from '../components/WebsiteAnnouncementBar'
import { CoverageModalProvider } from '../context/CoverageModalContext'
import { WebsiteCmsProvider } from '../context/WebsiteCmsContext'
import { SeoSettingsProvider } from '../context/SeoSettingsContext'
import { SeoQuoteModalProvider } from '../context/SeoQuoteModalContext'
import { pathUsesPublicQuoteModal } from '../lib/quoteModalRoutes'

export default function PublicLayout({ children }) {
  const { pathname } = useLocation()
  const quoteFlow = pathname === '/quote' || pathname.startsWith('/quote/')
  const paymentFlow = pathname.startsWith('/payment')
  const showQuoteModal = pathUsesPublicQuoteModal(pathname)

  const hideFooter = quoteFlow || paymentFlow

  const layoutBody = (
    <div className="flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x">
      <HomeHashScroll />
      <HomePageSeo />
      <WebsiteAnnouncementBar />
      <Navbar />
      <main
        className={`box-border min-w-0 flex-1 w-full max-w-full md:pb-0 ${
          quoteFlow ? 'quote-flow-main pb-[4.25rem]' : 'overflow-x-hidden pb-24'
        }`}
      >
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  )

  return (
    <CoverageModalProvider>
      <WebsiteCmsProvider>
        <SeoSettingsProvider>
        {showQuoteModal ? <SeoQuoteModalProvider>{layoutBody}</SeoQuoteModalProvider> : layoutBody}
        <FloatingReviewsBadge />
        <WhatsAppButton variant={quoteFlow ? 'quote-flow' : 'default'} />
        </SeoSettingsProvider>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
