import HeroBackgroundMedia from '../HeroBackgroundMedia'
import { coerceUseHeroVideo } from '../../lib/heroCmsVideo'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'

/** Mobile homepage hero — light text panel + video card (&lt; md). */
export default function MobileHero() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const heroImage = h.heroImageUrl || DEFAULT_HOMEPAGE.heroImageUrl
  const useHeroVideo = coerceUseHeroVideo(h.useHeroVideo)
  const heroVideoUrl = h.heroVideoUrl || ''

  return (
    <section
      id="home"
      className="scroll-mt-[60px] overflow-hidden bg-gradient-to-b from-white via-brand-50/25 to-white"
    >
      <div className="home-container box-border px-3.5 pb-1.5 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-600">
          UK removals · Glasgow & beyond
        </p>
        <h1 className="mt-1.5 max-w-[18rem] text-balance text-[1.35rem] font-extrabold leading-[1.12] tracking-tight text-navy xs:max-w-none xs:text-[1.45rem] xs:leading-[1.14]">
          {h.heroTitlePart1}{' '}
          <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">
            {h.heroTitleHighlight1}
          </span>
          <br />
          <span className="text-slate-900">{h.heroTitlePart2} </span>
          <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">
            {h.heroTitleHighlight2}
          </span>
        </h1>
        <p className="mt-1.5 max-w-[20rem] text-[13px] leading-snug text-slate-600 xs:text-[14px]">
          {h.heroSubtitle}
        </p>

        <div className="hero-mobile-video relative mt-3 aspect-video overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-50 ring-1 ring-slate-200/70 shadow-sm">
          <HeroBackgroundMedia
            imageUrl={heroImage}
            videoUrl={heroVideoUrl}
            useVideo={useHeroVideo}
          />
        </div>

        <ul className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-medium leading-snug text-slate-600 xs:text-[11px]">
          <li className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            {h.trustpilotText || 'Excellent 4.8 Trustpilot'}
          </li>
          <li className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            Fully insured
          </li>
        </ul>
      </div>
    </section>
  )
}
