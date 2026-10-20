import { useState } from 'react'
import { Phone } from 'lucide-react'
import { teamsCallLink } from '../../lib/teamsPhone'

/**
 * Visible telephone number plus one Teams call control.
 * @param {{ phone?: string }} props
 */
export default function LeadCallButton({ phone = '', compact = false }) {
  const [error, setError] = useState('')
  const display = String(phone || '').trim()
  if (!display) return <span className="text-slate-500">—</span>

  const link = teamsCallLink(display)

  return (
    <span className={`inline-flex max-w-full items-center gap-1 ${compact ? 'flex-wrap' : 'gap-1.5 whitespace-nowrap'}`}>
      <span className={compact ? 'min-w-0 break-all text-slate-800' : 'whitespace-nowrap text-slate-800'}>{display}</span>
      <a
        href={link.ok ? link.href : '#call'}
        target="_blank"
        rel="noopener noreferrer"
        title={link.ok ? `Call ${display} in Microsoft Teams` : link.error}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        onClick={(event) => {
          if (link.ok) {
            setError('')
            return
          }
          event.preventDefault()
          setError(link.error || 'That telephone number is not valid.')
        }}
      >
        <Phone className="h-3.5 w-3.5" aria-hidden />
        {compact ? <span className="sr-only">Call</span> : 'Call'}
      </a>
      {error ? <span className="text-xs text-amber-900">{error}</span> : null}
    </span>
  )
}
