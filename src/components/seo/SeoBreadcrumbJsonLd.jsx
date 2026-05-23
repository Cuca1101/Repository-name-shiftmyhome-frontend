import { SEO_SITE_ORIGIN } from '../../data/seoPages'

/**
 * BreadcrumbList JSON-LD for pages with visible breadcrumb navigation.
 * @param {{ items: { name: string, path: string }[] }} props
 */
export default function SeoBreadcrumbJsonLd({ items }) {
  if (!Array.isArray(items) || items.length < 2) return null

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SEO_SITE_ORIGIN}${item.path}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
