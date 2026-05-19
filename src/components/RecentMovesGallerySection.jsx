import { useMemo } from 'react'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../lib/websiteCmsDefaults'
import { formatDateUK } from '../lib/formatDateDisplay'
import { SEO_SITE_ORIGIN } from '../data/seoPages'

function buildImageAlt(item) {
  const title = String(item.title || '').trim()
  const city = String(item.city || '').trim()
  const service = String(item.service_type || '').trim()
  const parts = [title, service, city].filter(Boolean)
  if (parts.length) return `${parts.join(' — ')} | ShiftMyHome removals Scotland`
  return 'Completed removal job photo — ShiftMyHome Scotland'
}

/**
 * @param {Record<string, unknown>} item
 */
function GalleryCard({ item }) {
  const title = String(item.title || '').trim()
  const city = String(item.city || '').trim()
  const service = String(item.service_type || '').trim()
  const description = String(item.description || '').trim()
  const review = String(item.review_text || '').trim()
  const imageUrl = String(item.image_url || '').trim()
  const moveDate = item.move_date != null ? String(item.move_date) : ''
  const alt = buildImageAlt(item)

  return (
    <article className="group flex h-full min-w-[min(100%,280px)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(37,99,235,0.12)] sm:min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-brand-50/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
          {city ? (
            <span className="inline-flex rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800 shadow-sm backdrop-blur-sm">
              {city}
            </span>
          ) : null}
          {service ? (
            <span className="inline-flex rounded-md bg-brand-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
              {service}
            </span>
          ) : null}
        </div>
        </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-bold leading-snug text-navy sm:text-lg">{title || 'Recent move'}</h3>
        {moveDate ? (
          <p className="mt-1 text-xs font-medium text-slate-500">Completed {formatDateUK(moveDate)}</p>
        ) : null}
        {description ? (
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
        ) : null}
        {review ? (
          <blockquote className="mt-3 rounded-xl border border-brand-100/80 bg-brand-50/50 px-3 py-2.5 text-sm italic leading-relaxed text-slate-700">
            &ldquo;{review}&rdquo;
          </blockquote>
        ) : null}
      </div>
    </article>
  )
}

function GalleryJsonLd({ items }) {
  const json = useMemo(() => {
    const elements = items
      .filter((item) => String(item.image_url || '').trim())
      .map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'ImageObject',
          name: String(item.title || '').trim() || 'ShiftMyHome completed move',
          description:
            [item.description, item.city, item.service_type].filter(Boolean).join(' — ') ||
            'Professional removals completed by ShiftMyHome',
          contentUrl: String(item.image_url).trim(),
          ...(item.city
            ? {
                contentLocation: {
                  '@type': 'Place',
                  name: String(item.city),
                  address: { '@type': 'PostalAddress', addressLocality: String(item.city), addressCountry: 'GB' },
                },
              }
            : {}),
        },
      }))
    if (!elements.length) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Recent removals by ShiftMyHome',
      description: 'Completed house removals, office moves, and deliveries across Scotland.',
      url: `${SEO_SITE_ORIGIN}/#recent-moves`,
      numberOfItems: elements.length,
      itemListElement: elements,
    }
  }, [items])

  if (!json) return null

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}

/**
 * Homepage gallery — active CMS items only; hidden when empty.
 */
export default function RecentMovesGallerySection() {
  const { homepage, galleryItems } = useWebsiteCms()
  const hp = homepage ?? DEFAULT_HOMEPAGE
  const heading = String(hp.galleryHeading || DEFAULT_HOMEPAGE.galleryHeading).trim()
  const subheading = String(hp.gallerySubheading || DEFAULT_HOMEPAGE.gallerySubheading).trim()
  const items = Array.isArray(galleryItems) ? galleryItems : []

  if (!items.length) return null

  return (
    <section
      id="recent-moves"
      className="scroll-mt-[76px] border-y border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-white py-12 sm:py-20"
      aria-labelledby="recent-moves-heading"
    >
      <GalleryJsonLd items={items} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Completed jobs</p>
          <h2
            id="recent-moves-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl"
          >
            {heading}
          </h2>
          {subheading ? (
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{subheading}</p>
          ) : null}
        </div>

        {/* Mobile: horizontal snap carousel */}
        <ul className="mt-10 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-thin md:hidden">
          {items.map((item) => (
            <li key={String(item.id)} className="snap-center shrink-0 w-[min(85vw,300px)]">
              <GalleryCard item={item} />
            </li>
          ))}
        </ul>

        {/* Desktop: premium grid */}
        <ul className="mt-12 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={String(item.id)} className="min-w-0">
              <GalleryCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
