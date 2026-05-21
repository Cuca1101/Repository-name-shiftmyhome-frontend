import { journeyDispatchStatus, journeyBadgeClassName } from '../../lib/journeyPlannerDisplay'

/**
 * @param {{
 *   journey: Record<string, unknown>,
 *   quotes?: Record<string, unknown>[],
 *   className?: string,
 * }} props
 */
export default function JourneyDispatchStatusBadge({ journey, quotes = [], className = '' }) {
  const status = journeyDispatchStatus(journey, quotes)
  const shortLabel =
    status.key === 'active' && status.label.includes('·')
      ? status.label.split('·')[0].trim()
      : status.label.length > 28
        ? status.label.slice(0, 26) + '…'
        : status.label

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${journeyBadgeClassName(status.tone)} ${className}`}
      title={status.label}
    >
      {shortLabel}
    </span>
  )
}
