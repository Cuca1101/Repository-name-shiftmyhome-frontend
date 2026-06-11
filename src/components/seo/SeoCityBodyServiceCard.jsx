import HomeStyleServiceCard, { slugForServiceHeading } from './HomeStyleServiceCard'
import { getServicePageByPath } from '../../constants/servicePages'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { useSeoQuoteModal } from '../../context/SeoQuoteModalContext'
import { useServiceCardImageBySlug } from '../../hooks/useServiceGridCards'
/**
 * @param {{
 *   section: { heading: string, paragraphs: string[] },
 *   pagePath: string,
 * }} props
 */
export default function SeoCityBodyServiceCard({ section, pagePath }) {
  const { openQuote } = useSeoQuoteModal()
  const getImageForSlug = useServiceCardImageBySlug()
  const slug = slugForServiceHeading(section.heading)
  const excerpt = section.paragraphs[0] ?? ''
  const serviceType = getServicePageByPath(`/${slug}`)?.serviceType ?? ''

  return (
    <li className="flex min-w-0">
      <HomeStyleServiceCard
        slug={slug}
        title={section.heading}
        description={excerpt}
        imageSrc={getImageForSlug(slug)}
        href="#seo-quote"
        onClick={(e) => {
          e.preventDefault()
          markNewQuoteFromServiceCard(serviceType, pagePath)
          openQuote()
        }}
      />
    </li>
  )
}
