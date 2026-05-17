import PublicLayout from '../layouts/PublicLayout'
import Hero from '../components/Hero'
import HomeTrustRow from '../components/HomeTrustRow'
import HeroServiceGrid from '../components/HeroServiceGrid'
import HomeBenefitBar from '../components/HomeBenefitBar'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'
import WhyShiftMyHomeSection from '../components/WhyShiftMyHomeSection'
import ReviewsSection from '../components/ReviewsSection'
import FAQSection from '../components/FAQSection'
import SupportCTASection from '../components/SupportCTASection'
import PricingPreview from '../components/PricingPreview'
import CoverageHomeSection from '../components/CoverageHomeSection'
import ContactSection from '../components/ContactSection'

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="bg-white">
        <Hero />
        <HomeTrustRow />
        <HeroServiceGrid />
        <HomeBenefitBar />
        <CustomerQuoteCalculator />
        <WhyShiftMyHomeSection />
        <ReviewsSection />
        <PricingPreview />
        <CoverageHomeSection />
        <FAQSection />
        <SupportCTASection />
        <ContactSection />
      </div>
    </PublicLayout>
  )
}
