import { useState } from 'react'
import { TEAMS_HOME_URL, teamsCallLink } from '../../lib/teamsPhone'

const buttonClass =
  'inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50'

/**
 * Opens Microsoft Teams. The voice call runs in Teams after the agent confirms it.
 * @param {{ phone?: string, compact?: boolean }} props
 */
export default function TeamsCallButtons({ phone = '', compact = false }) {
  const [error, setError] = useState('')
  const link = teamsCallLink(phone)

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex flex-wrap gap-2">
        <a href={TEAMS_HOME_URL} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          Open Microsoft Teams
        </a>
        <a
          href={link.ok ? link.href : TEAMS_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClass} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`}
          onClick={(event) => {
            if (link.ok) {
              setError('')
              return
            }
            event.preventDefault()
            setError(link.error || 'That telephone number is not valid.')
          }}
        >
          Call with Teams
        </a>
      </div>
      {error ? <p className="text-xs text-amber-900">{error}</p> : null}
    </div>
  )
}
