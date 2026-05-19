import { SEO_SITE_ORIGIN } from '../../data/seoPages'
import { buildLocalBusinessJsonLd } from '../../lib/schemaOrgBusiness'

/**
 * LocalBusiness structured data for SEO landing pages (shared official phone & contactPoint).
 * @param {{ path: string, pageTitle?: string, description?: string }} props
 */
export default function SeoBusinessJsonLd({ path, pageTitle, description }) {
  const data = buildLocalBusinessJsonLd(SEO_SITE_ORIGIN, {
    path,
    pageTitle,
    description,
  })

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
