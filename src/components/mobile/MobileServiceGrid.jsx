import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import HomeServiceCard from './HomeServiceCard'

/** Mobile service cards — one column below the tablet breakpoint. */
export default function MobileServiceGrid() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const cards = useServiceGridCards()

  return (
    <section id="services" className="scroll-mt-[60px] bg-white pb-3 pt-0">
      <div className="home-container min-w-0 px-4">
        <div className="mb-2.5 min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-navy">{h.servicesHeading}</h2>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">{h.servicesSubheading}</p>
        </div>

        <ul className="grid grid-cols-1 items-stretch gap-4">
          {cards.map((card) => (
            <li key={card.key} className="flex min-w-0">
              <HomeServiceCard card={card} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
