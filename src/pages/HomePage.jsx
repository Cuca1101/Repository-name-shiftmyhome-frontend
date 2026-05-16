import PublicLayout from '../layouts/PublicLayout'
import Hero from '../components/Hero'
import WhyShiftMyHomeSection from '../components/WhyShiftMyHomeSection'
import FAQSection from '../components/FAQSection'
import SupportCTASection from '../components/SupportCTASection'
import ReviewsSection from '../components/ReviewsSection'
import PricingPreview from '../components/PricingPreview'
import CoverageHomeSection from '../components/CoverageHomeSection'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'
import ContactSection from '../components/ContactSection'

export default function HomePage() {
  return (
    <PublicLayout>
      <Hero />
      <WhyShiftMyHomeSection />
      <FAQSection />
      <SupportCTASection />
      <ReviewsSection />
      <PricingPreview />
      <CoverageHomeSection />
      <CustomerQuoteCalculator />
      <ContactSection />
    </PublicLayout>
  )
}
