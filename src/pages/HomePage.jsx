import PublicLayout from '../layouts/PublicLayout'
import Hero from '../components/Hero'
import HeroServiceGrid from '../components/HeroServiceGrid'
import MobileTrustBand from '../components/mobile/MobileTrustBand'
import HowItWorksSection from '../components/HowItWorksSection'
import AboutSection from '../components/AboutSection'
import ReviewsSection from '../components/ReviewsSection'
import RecentMovesGallerySection from '../components/RecentMovesGallerySection'
import FAQSection from '../components/FAQSection'
import SupportCTASection from '../components/SupportCTASection'
import PricingPreview from '../components/PricingPreview'
import CoverageHomeSection from '../components/CoverageHomeSection'
import ContactSection from '../components/ContactSection'
import ContinueQuoteBanner from '../components/ContinueQuoteBanner'

const mobileSecondarySections = (
  <>
    <AboutSection />
    <CoverageHomeSection />
    <FAQSection />
    <SupportCTASection />
  </>
)

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="bg-white">
        <ContinueQuoteBanner />
        {/* Mobile: hero → services → how it works → prices → quote request → reviews → rest */}
        <div className="block md:hidden">
          <Hero />
          <HeroServiceGrid />
          <HowItWorksSection compact />
          <PricingPreview />
          <ContactSection />
          <MobileTrustBand />
          <ReviewsSection />
          <RecentMovesGallerySection />
          {mobileSecondarySections}
        </div>

        {/* Desktop: original section order unchanged */}
        <div className="hidden md:block">
          <Hero />
          <HeroServiceGrid />
          <HowItWorksSection />
          <AboutSection />
          <ReviewsSection />
          <RecentMovesGallerySection />
          <PricingPreview />
          <CoverageHomeSection />
          <FAQSection />
          <SupportCTASection />
          <ContactSection />
        </div>
      </div>
    </PublicLayout>
  )
}
