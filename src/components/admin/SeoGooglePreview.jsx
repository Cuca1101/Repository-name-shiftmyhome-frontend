/** Google-style SERP preview for SEO dashboard. */
export default function SeoGooglePreview({ title, url, description }) {
  const displayTitle = (title || 'Page title').trim()
  const displayUrl = (url || 'https://www.shiftmyhome.co.uk/').trim()
  const displayDesc = (description || 'Meta description preview…').trim()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Google preview</p>
      <div className="mt-3 rounded-xl bg-slate-50/80 p-4">
        <p className="truncate text-lg text-[#1a0dab]">{displayTitle}</p>
        <p className="mt-0.5 truncate text-sm text-[#006621]">{displayUrl}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#545454]">{displayDesc}</p>
      </div>
    </div>
  )
}
