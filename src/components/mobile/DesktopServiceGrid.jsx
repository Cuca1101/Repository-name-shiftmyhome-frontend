import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import HomeServiceCard from './HomeServiceCard'

/** Desktop service cards — grid (md+). */
export default function DesktopServiceGrid() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const cards = useServiceGridCards()

  return (
    <section id="services" className="home-section scroll-mt-[76px] bg-white pb-2">
      <div className="home-container">
        <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl lg:text-[1.65rem]">
              {h.servicesHeading}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">{h.servicesSubheading}</p>
          </div>
        </div>

        <ul className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
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
