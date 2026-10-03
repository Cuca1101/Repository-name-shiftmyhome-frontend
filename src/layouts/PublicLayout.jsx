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
import { pathHasOwnQuoteModal, pathUsesDedicatedQuotePage, pathUsesPublicQuoteModal } from '../lib/quoteModalRoutes'
import ContinueQuoteBanner from '../components/ContinueQuoteBanner'

export default function PublicLayout({ children }) {
  const { pathname } = useLocation()
  const quoteFlow = pathname === '/quote' || pathname.startsWith('/quote/')
  const paymentFlow = pathname.startsWith('/payment')
  const showQuoteModal = pathUsesPublicQuoteModal(pathname)

  const hideFooter = paymentFlow

  const layoutBody = (
    <div className="flex min-h-screen min-w-0 w-full max-w-full flex-col">
      <HomeHashScroll />
      <HomePageSeo />
      <WebsiteAnnouncementBar />
      <Navbar />
      <main
        className={`box-border min-w-0 flex-1 w-full max-w-full md:pb-0 ${
          quoteFlow ? 'quote-flow-main bg-[#e7eef6]' : 'overflow-x-hidden pb-24'
        }`}
      >
        <ContinueQuoteBanner />
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
        {pathUsesDedicatedQuotePage(pathname) || pathHasOwnQuoteModal(pathname) ? null : (
          <FloatingReviewsBadge />
        )}
        <WhatsAppButton variant={quoteFlow ? 'quote-flow' : 'default'} />
        </SeoSettingsProvider>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
