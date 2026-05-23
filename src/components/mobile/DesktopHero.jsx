import HomeSectionLink from '../HomeSectionLink'
import HomeTrustRow from '../HomeTrustRow'
import HeroBackgroundMedia from '../HeroBackgroundMedia'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { coerceUseHeroVideo } from '../../lib/heroCmsVideo'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'

/** Desktop homepage hero — text left on light blue, video right (md+). */
export default function DesktopHero() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const heroImage = h.heroImageUrl || DEFAULT_HOMEPAGE.heroImageUrl
  const useHeroVideo = coerceUseHeroVideo(h.useHeroVideo)
  const heroVideoUrl = h.heroVideoUrl || ''

  return (
    <section id="home" className="hero-desktop-split scroll-mt-[76px] overflow-hidden bg-white">
      <div className="hero-desktop-split-grid grid min-w-0 lg:grid-cols-2 lg:items-stretch">
        <div className="hero-text-panel flex min-w-0 flex-col justify-center">
          <div className="home-container py-8 sm:py-10 lg:max-w-none lg:py-12 lg:pl-8 lg:pr-6 xl:pl-10 xl:pr-8">
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
                trackLabel="Get an Instant Quote"
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
              <HomeTrustRow
                embedded
                trustpilotText={h.trustpilotText}
                badgeListClassName="hero-desktop-trust-badges"
              />
            </div>
          </div>
        </div>

        <div className="hero-media-panel relative min-h-[16rem] sm:min-h-[20rem] lg:min-h-[26rem] xl:min-h-[30rem]">
          <HeroBackgroundMedia
            imageUrl={heroImage}
            videoUrl={heroVideoUrl}
            useVideo={useHeroVideo}
            overlay="panel-edge"
          />
        </div>
      </div>
    </section>
  )
}
