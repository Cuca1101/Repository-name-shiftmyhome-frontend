import HomeSectionLink from './HomeSectionLink'
import HomeTrustRow from './HomeTrustRow'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../lib/websiteCmsDefaults'

export default function Hero() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const heroImage = h.heroImageUrl || DEFAULT_HOMEPAGE.heroImageUrl

  return (
    <section id="home" className="scroll-mt-[76px] overflow-hidden bg-white">
      <div className="home-container">
        <div className="grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 xl:gap-10">
          <div className="py-6 sm:py-8 lg:py-10">
            <h1 className="text-balance text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-navy sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
              {h.heroTitlePart1}{' '}
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 bg-clip-text text-transparent">
                {h.heroTitleHighlight1}
              </span>
              <br />
              <span className="text-slate-900">{h.heroTitlePart2} </span>
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 bg-clip-text text-transparent">
                {h.heroTitleHighlight2}
              </span>
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-base lg:text-[17px]">
              {h.heroSubtitle}
            </p>

            <div className="mt-5 flex flex-col gap-2.5 xs:flex-row xs:flex-wrap sm:mt-6">
              <HomeSectionLink
                sectionId="services"
                className="btn-premium-primary min-h-[46px] w-full px-6 py-2.5 text-sm sm:w-auto sm:min-w-[200px] sm:text-[15px]"
              >
                {h.ctaPrimaryText}
                <span aria-hidden className="text-white/90">
                  →
                </span>
              </HomeSectionLink>
              <HomeSectionLink
                sectionId="how-it-works"
                className="btn-premium-secondary min-h-[46px] w-full px-5 py-2.5 text-sm sm:w-auto sm:text-[15px]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600"
                  aria-hidden
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                {h.ctaSecondaryText}
              </HomeSectionLink>
            </div>

            <div className="mt-5 sm:mt-6">
              <HomeTrustRow embedded trustpilotText={h.trustpilotText} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-[5/4] lg:aspect-auto lg:min-h-[380px] lg:rounded-none lg:rounded-l-2xl xl:min-h-[420px]">
              <div
                className="absolute inset-0 bg-cover bg-[center_42%] transition-transform duration-700 ease-premium lg:hover:scale-[1.02]"
                style={{ backgroundImage: `url(${heroImage})` }}
                role="img"
                aria-label="Professional home removals"
              />
              <div className="hero-image-fade absolute inset-0 lg:hidden" aria-hidden />
              <div
                className="absolute inset-0 hidden bg-gradient-to-r from-white via-white/75 to-transparent lg:block"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
