/**
 * Accessible FAQ accordion (native details/summary — no extra libraries).
 * @param {{ faqs: { q: string, a: string }[] }} props
 */
export default function SeoFaqAccordion({ faqs }) {
  return (
    <div className="seo-faq-accordion mt-5 space-y-2.5 sm:mt-8 sm:space-y-3" role="list">
      {faqs.map(({ q, a }) => (
        <details key={q} className="seo-faq-item group" role="listitem">
          <summary className="seo-faq-summary">{q}</summary>
          <div className="seo-faq-answer">
            <p>{a}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
