import { SEO_SITE_ORIGIN } from '../../data/seoPages'

/**
 * Lightweight FAQ structured data for SEO landing pages (no external library).
 * @param {{ faqs: { q: string, a: string }[], path: string }} props
 */
export default function SeoFaqJsonLd({ faqs, path }) {
  if (!faqs?.length) return null

  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
    url: `${SEO_SITE_ORIGIN}${path}`,
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
