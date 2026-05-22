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
    <div className={`flex min-w-0 flex-nowrap items-center gap-3 md:block ${className}`}>
      <h2
        className={`shrink-0 text-base font-bold leading-tight text-slate-900 md:text-2xl ${titleClassName}`}
      >
        {title}
      </h2>
      <MobileStepRefBadge quoteRef={quoteRef} />
    </div>
  )
}
