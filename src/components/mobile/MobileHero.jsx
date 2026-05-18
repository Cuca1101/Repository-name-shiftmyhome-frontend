import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'

/** Mobile homepage hero — compact copy + trust row (&lt; md). */
export default function MobileHero() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE

  return (
    <section id="home" className="scroll-mt-[60px] overflow-hidden bg-gradient-to-b from-white via-brand-50/30 to-white">
      <div className="home-container px-4 pb-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">UK removals · Glasgow & beyond</p>
        <h1 className="mt-2 text-balance text-[1.45rem] font-extrabold leading-[1.15] tracking-tight text-navy">
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
        <p className="mt-2 max-w-[22rem] text-[14px] leading-snug text-slate-600">{h.heroSubtitle}</p>

        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-600">
          <li className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {h.trustpilotText || 'Excellent 4.8 Trustpilot'}
          </li>
          <li className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
            Fully insured
          </li>
        </ul>
      </div>
    </section>
  )
}
