import { SEO_SITE_ORIGIN } from '../../data/seoPages'

/**
 * Standalone Service schema for main service quote pages.
 * @param {{ name: string, description: string, path: string, serviceType?: string }} props
 */
export default function SeoServiceJsonLd({ name, description, path, serviceType }) {
  const pageUrl = `${SEO_SITE_ORIGIN}${path}`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name,
    description,
    url: pageUrl,
    serviceType: serviceType || name,
    provider: {
      '@type': 'MovingCompany',
      '@id': `${SEO_SITE_ORIGIN}/#organization`,
      name: 'ShiftMyHome',
    },
    areaServed: {
      '@type': 'Country',
      name: 'United Kingdom',
    },
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
