import { WHATSAPP_URL } from '../config'
import HeroServiceGrid from './HeroServiceGrid'
import HomeSectionLink from './HomeSectionLink'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80'

const TRUST_BADGES = [
  'Fully insured',
  'Same day / next day availability',
  'Friendly professional drivers',
]

const btnPrimary =
  'inline-flex min-h-[34px] items-center justify-center rounded-full bg-brand-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-lg transition hover:bg-brand-500 hover:shadow-xl xxs:min-h-[36px] xxs:px-4 xxs:text-xs sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-sm lg:w-auto lg:px-8 lg:text-base'
const btnWhatsApp =
  'inline-flex min-h-[34px] items-center justify-center rounded-full bg-[#25D366] px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-lg ring-1 ring-white/30 transition hover:bg-[#20bd5a] hover:shadow-xl xxs:min-h-[36px] xxs:px-4 xxs:text-xs sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-sm lg:w-auto lg:px-8 lg:text-base'

export default function Hero() {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-brand-950"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        role="img"
        aria-label="Professional home removals"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-900/88 to-brand-800/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />

      <div className="relative mx-auto min-w-0 max-w-6xl space-y-3 px-2.5 py-5 xxs:space-y-3.5 xxs:px-3 xxs:py-6 sm:space-y-12 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-3 xxs:gap-3.5 sm:gap-8 lg:gap-10">
          <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-2xl lg:max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-200 xxs:text-[11px] sm:text-sm">
                Glasgow &amp; UK removals
              </p>
              <h1 className="mt-1.5 text-balance text-lg font-extrabold tracking-tight text-white xxs:mt-2 xxs:text-xl xs:text-2xl sm:mt-3 sm:text-5xl lg:text-6xl">
                Professional removals made simple
              </h1>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-200 xxs:mt-2 xxs:text-xs sm:mt-6 sm:text-lg lg:text-xl">
                Fast, reliable and affordable removals across Glasgow and the UK.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-row flex-wrap gap-1.5 xxs:gap-2 sm:flex-col sm:gap-3 lg:mt-1 lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-4">
              <HomeSectionLink sectionId="quote" className={btnPrimary}>
                Get Free Quote
              </HomeSectionLink>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={btnWhatsApp}>
                WhatsApp
              </a>
            </div>
          </div>

          <ul className="flex max-w-3xl flex-row flex-wrap gap-1.5 xxs:gap-2 sm:gap-4" role="list">
            {TRUST_BADGES.map((label) => (
              <li
                key={label}
                className="inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm xxs:gap-1.5 xxs:px-2 xxs:py-1 xxs:text-[10px] sm:px-4 sm:py-2 sm:text-sm"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-[8px] font-bold text-white xxs:h-5 xxs:w-5 xxs:text-[10px] sm:h-6 sm:w-6 sm:text-xs">
                  ✓
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroServiceGrid />
      </div>
    </section>
  )
}
