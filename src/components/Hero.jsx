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
  'inline-flex min-h-[40px] w-auto items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-brand-500 hover:shadow-xl xxs:min-h-[42px] xxs:px-5 xxs:text-sm sm:min-h-[48px] sm:px-6 sm:py-3 lg:px-8 lg:text-base'
const btnWhatsApp =
  'inline-flex min-h-[40px] w-auto items-center justify-center rounded-full bg-[#25D366] px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30 transition hover:bg-[#20bd5a] hover:shadow-xl xxs:min-h-[42px] xxs:px-5 xxs:text-sm sm:min-h-[48px] sm:px-6 sm:py-3 lg:px-8 lg:text-base'

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

      <div className="relative mx-auto min-w-0 max-w-6xl space-y-5 px-3 py-8 xxs:space-y-6 xxs:px-3.5 xxs:py-9 xs:space-y-7 xs:px-4 xs:py-10 sm:space-y-12 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-5 xxs:gap-6 lg:gap-10">
          <div className="flex flex-col gap-3 xxs:flex-row xxs:flex-wrap xxs:items-start xxs:justify-between xxs:gap-3 sm:gap-4 lg:gap-8">
            <div className="min-w-0 max-w-2xl flex-1 lg:max-w-3xl">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-brand-200 xxs:text-xs sm:text-sm">Glasgow &amp; UK removals</p>
              <h1 className="mt-2 text-balance text-xl font-extrabold tracking-tight text-white xxs:text-2xl xs:text-3xl sm:mt-3 sm:text-5xl lg:text-6xl">
                Professional removals made simple
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-slate-200 xxs:mt-3 xxs:text-sm xs:text-base sm:mt-6 sm:text-lg lg:text-xl">
                Fast, reliable and affordable removals across Glasgow and the UK.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-row flex-wrap gap-2 xxs:gap-2.5 lg:mt-1 lg:w-auto lg:justify-end lg:gap-4">
              <HomeSectionLink sectionId="quote" className={btnPrimary}>
                Get Free Quote
              </HomeSectionLink>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={btnWhatsApp}>
                WhatsApp
              </a>
            </div>
          </div>

          <ul className="flex max-w-3xl flex-row flex-wrap gap-2 xxs:gap-2.5 sm:gap-4" role="list">
            {TRUST_BADGES.map((label) => (
              <li
                key={label}
                className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[0.65rem] font-medium text-white backdrop-blur-sm xxs:gap-2 xxs:px-2.5 xxs:py-1.5 xxs:text-xs sm:px-4 sm:py-2 sm:text-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-[0.65rem] font-bold text-white xxs:h-6 xxs:w-6 xxs:text-xs">
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
