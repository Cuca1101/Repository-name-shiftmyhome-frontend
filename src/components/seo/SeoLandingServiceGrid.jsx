import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import { getBrandedServiceImage } from '../../lib/getBrandedServiceImage'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { useSeoQuoteModal } from '../../context/SeoQuoteModalContext'
import HomeStyleServiceCard from './HomeStyleServiceCard'

/**
 * Six main ShiftMyHome services as homepage-style cards (SEO city pages).
 *
 * @param {{ pagePath: string, quoteAnchor?: string }} props
 */
export default function SeoLandingServiceGrid({ pagePath, quoteAnchor = '#seo-quote' }) {
  const cards = useServiceGridCards()
  const { openQuote, hasModal } = useSeoQuoteModal()

  return (
    <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {cards.map((card) => (
        <li key={card.key} className="flex min-w-0">
          <HomeStyleServiceCard
            slug={card.slug}
            title={card.title}
            description={card.description}
            imageSrc={getBrandedServiceImage(card.slug)}
            imageAlt={`${card.title} — ShiftMyHome removals Scotland`}
            price={card.price}
            buttonText={card.buttonText}
            href={hasModal ? '#seo-quote' : quoteAnchor}
            onClick={
              hasModal
                ? (e) => {
                    e.preventDefault()
                    markNewQuoteFromServiceCard(card.serviceType || '', pagePath)
                    openQuote(card.serviceType || undefined)
                  }
                : () => markNewQuoteFromServiceCard(card.serviceType || '', pagePath)
            }
          />
        </li>
      ))}
    </ul>
  )
}
