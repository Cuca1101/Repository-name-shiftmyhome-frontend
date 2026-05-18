import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'

function onServiceCardClick(card) {
  markNewQuoteFromServiceCard(card.serviceType || '', card.path)
  trackWebsiteLeadEvent('new_quote_from_service', {
    serviceType: card.serviceType,
    returnPath: card.path,
  })
}

/** Mobile service cards — 2-column grid (&lt; md). */
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

        <ul className="grid grid-cols-2 gap-2.5">
          {cards.map((card) => {
            const Icon = iconBySlug[card.slug] ?? HouseIcon
            const ctaLabel = card.buttonText?.trim() || 'Get a Quote'
            return (
              <li key={card.key} className="flex min-w-0">
                <Link
                  to={card.path}
                  onClick={() => onServiceCardClick(card)}
                  className="group service-card-shell"
                >
                  <div className="relative aspect-[4/5] w-full min-h-[124px]">
                    <img
                      src={card.imageSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="service-card-media-overlay absolute inset-0" aria-hidden />
                    <div className="relative flex h-full flex-col p-2.5 pb-2">
                      <div className="service-card-icon-badge h-8 w-8">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <div className="mt-auto min-w-0 space-y-0.5">
                        <h3 className="text-[13px] font-bold leading-tight text-white">{card.title}</h3>
                        <p className="line-clamp-2 text-[10px] leading-snug text-white/88">
                          {card.description}
                        </p>
                        {card.price ? (
                          <p className="text-[10px] font-semibold text-sky-200">
                            From <span className="font-bold text-white">{card.price}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 pt-1.5">
                    <span className="service-card-cta min-h-[44px] text-[11px] leading-tight">
                      {ctaLabel}
                      <span className="shrink-0 opacity-90" aria-hidden>
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
