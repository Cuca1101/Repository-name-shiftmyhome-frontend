/**
 * Visible heading above the embedded quote wizard on SEO pages.
 *
 * @param {{ title: string, subtitle?: string }} props
 */
export default function SeoQuoteSectionHeader({ title, subtitle }) {
  return (
    <div className="seo-section-inner border-b border-slate-200/60 pb-4 pt-5 sm:pb-5 sm:pt-6">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p>
      ) : null}
    </div>
  )
}
