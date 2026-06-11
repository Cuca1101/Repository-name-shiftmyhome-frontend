import { useState } from 'react'
import SeoLinkCardGrid from './SeoLinkCardGrid'

/**
 * Link grid that shows a subset first, with expand/collapse for long SEO area lists.
 *
 * @param {{
 *   links: { href: string, label: string }[],
 *   initialVisible?: number,
 *   expandLabel?: string,
 *   collapseLabel?: string,
 *   className?: string,
 * }} props
 */
export default function SeoExpandableLinkGrid({
  links,
  initialVisible = 6,
  expandLabel,
  collapseLabel = 'Show fewer',
  className = '',
}) {
  const [open, setOpen] = useState(false)

  if (!links?.length) return null

  const needsToggle = links.length > initialVisible
  const visibleLinks = open || !needsToggle ? links : links.slice(0, initialVisible)
  const hiddenCount = links.length - initialVisible

  return (
    <div className={className}>
      <SeoLinkCardGrid links={visibleLinks} />
      {needsToggle ? (
        <div className="mt-4 flex justify-center sm:mt-5">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-800"
          >
            {open
              ? collapseLabel
              : expandLabel ?? `Show all areas (${hiddenCount} more)`}
            <svg
              className={`h-4 w-4 shrink-0 text-brand-600 transition-transform ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}
