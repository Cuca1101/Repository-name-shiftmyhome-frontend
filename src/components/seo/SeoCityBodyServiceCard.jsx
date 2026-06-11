import HomeStyleServiceCard, { slugForServiceHeading } from './HomeStyleServiceCard'
import { getServicePageByPath } from '../../constants/servicePages'
import { getBrandedServiceImage } from '../../lib/getBrandedServiceImage'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { useSeoQuoteModal } from '../../context/SeoQuoteModalContext'
/**
 * @param {{
 *   section: { heading: string, paragraphs: string[] },
 *   pagePath: string,
 * }} props
 */
export default function SeoCityBodyServiceCard({ section, pagePath }) {
  const { openQuote } = useSeoQuoteModal()
  const slug = slugForServiceHeading(section.heading)
  const excerpt = section.paragraphs[0] ?? ''
  const serviceType = getServicePageByPath(`/${slug}`)?.serviceType ?? ''

  return (
    <li className="flex min-w-0">
      <HomeStyleServiceCard
        slug={slug}
        title={section.heading}
        description={excerpt}
        imageSrc={getBrandedServiceImage(slug)}
        imageAlt={`${section.heading} — ShiftMyHome removals Scotland`}
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
