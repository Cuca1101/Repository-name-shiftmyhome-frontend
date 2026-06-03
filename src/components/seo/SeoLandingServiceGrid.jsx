import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import HomeStyleServiceCard from './HomeStyleServiceCard'

/**
 * Six main ShiftMyHome services as homepage-style cards (SEO city pages).
 *
 * @param {{ quoteAnchor?: string, pagePath: string }} props
 */
export default function SeoLandingServiceGrid({ quoteAnchor = '#seo-quote', pagePath }) {
  const cards = useServiceGridCards()

  return (
    <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {cards.map((card) => (
        <li key={card.key} className="flex min-w-0">
          <HomeStyleServiceCard
            slug={card.slug}
            title={card.title}
            description={card.description}
            imageSrc={card.imageSrc}
            price={card.price}
            buttonText={card.buttonText}
            href={quoteAnchor}
            onClick={() => markNewQuoteFromServiceCard(card.serviceType || '', pagePath)}
          />
        </li>
      ))}
    </ul>
  )
}
