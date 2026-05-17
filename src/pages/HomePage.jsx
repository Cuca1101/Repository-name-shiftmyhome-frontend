import PublicLayout from '../layouts/PublicLayout'
import Hero from '../components/Hero'
import HeroServiceGrid from '../components/HeroServiceGrid'
import HowItWorksSection from '../components/HowItWorksSection'
import AboutSection from '../components/AboutSection'
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
        <HeroServiceGrid />
        <HowItWorksSection />
        <AboutSection />
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
