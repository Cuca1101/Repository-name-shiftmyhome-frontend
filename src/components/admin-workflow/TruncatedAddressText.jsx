import { truncateAddressForCard } from '../../lib/quoteAddressResolve'

/**
 * @param {{
 *   address: string,
 *   className?: string,
 *   maxLen?: number,
 * }} props
 */
export default function TruncatedAddressText({ address, className = '', maxLen = 72 }) {
  const { full, display } = truncateAddressForCard(address, maxLen)
  const needsTitle = full !== display && full !== '—'
  return (
    <span
      className={`line-clamp-2 break-words text-slate-800 ${className}`.trim()}
      title={needsTitle ? full : undefined}
    >
      {display}
    </span>
  )
}
