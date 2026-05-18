import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import HomeHashScroll from '../components/HomeHashScroll'
import HomePageSeo from '../components/seo/HomePageSeo'
import WebsiteAnnouncementBar from '../components/WebsiteAnnouncementBar'
import { CoverageModalProvider } from '../context/CoverageModalContext'
import { WebsiteCmsProvider } from '../context/WebsiteCmsContext'

export default function PublicLayout({ children }) {
  return (
    <CoverageModalProvider>
      <WebsiteCmsProvider>
        <div className="flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x">
          <HomeHashScroll />
          <HomePageSeo />
          <WebsiteAnnouncementBar />
          <Navbar />
          <main className="min-w-0 flex-1 w-full max-w-full overflow-x-hidden pb-24 md:pb-0">{children}</main>
          <Footer />
          <WhatsAppButton />
        </div>
      </WebsiteCmsProvider>
    </CoverageModalProvider>
  )
}
