import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import HomeHashScroll from '../components/HomeHashScroll'
import { CoverageModalProvider } from '../context/CoverageModalContext'

export default function PublicLayout({ children }) {
  return (
    <CoverageModalProvider>
      <div className="flex min-h-screen min-w-0 w-full max-w-full flex-col clip-x">
        <HomeHashScroll />
        <Navbar />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </CoverageModalProvider>
  )
}
