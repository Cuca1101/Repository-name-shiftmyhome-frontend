/**
 * Text info card for intent / specialty SEO pages (not tied to a service image).
 *
 * @param {{
 *   section: { heading: string, paragraphs: string[] },
 *   quoteAnchor: string,
 * }} props
 */
export default function SeoInfoBodyCard({ section, quoteAnchor }) {
  const excerpt = section.paragraphs[0] ?? ''

  return (
    <li className="flex min-w-0">
      <article className="flex h-full w-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
        <h3 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{section.heading}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-5">{excerpt}</p>
        <a href={quoteAnchor} className="service-card-cta mt-4 min-h-[42px] text-xs sm:min-h-[44px] sm:text-sm">
          Get a Quote
          <span className="opacity-90" aria-hidden>
            →
          </span>
        </a>
      </article>
    </li>
  )
}
