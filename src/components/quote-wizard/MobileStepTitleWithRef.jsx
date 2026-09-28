import MobileStepRefBadge from './MobileStepRefBadge'

/**
 * Step title with inline mobile reference badge beside it.
 * @param {{ title: string, quoteRef?: string, titleClassName?: string, className?: string }} props
 */
export default function MobileStepTitleWithRef({
  title,
  quoteRef,
  titleClassName = '',
  className = '',
}) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 ${className}`}>
      <h2
        className={`shrink-0 text-base font-bold leading-tight text-slate-900 md:text-2xl ${titleClassName}`}
      >
        {title}
      </h2>
      <MobileStepRefBadge quoteRef={quoteRef} />
    </div>
  )
}
