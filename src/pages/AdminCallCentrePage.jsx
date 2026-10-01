import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CallHistoryPanel from '../components/admin/CallHistoryPanel'
import ContactsPanel from '../components/admin/ContactsPanel'
import TeamsCallButtons from '../components/admin/TeamsCallButtons'
import { normalisePhone } from '../lib/ukPhone'

function LiveCallsPanel() {
  const [phone, setPhone] = useState('')
  const parsed = phone.trim() ? normalisePhone(phone) : null

  return (
    <div className="admin-surface space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900">Call with Microsoft Teams</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          This page does not place the call. Call with Teams opens the official Teams link. Teams asks the
          agent to confirm, then the call runs in the Teams desktop or web client. The agent needs a Teams Phone
          licence and the existing calling plan. ShiftMyHome does not store Microsoft passwords.
        </p>
      </div>
      <label className="block max-w-md text-sm font-medium text-slate-700">
        Telephone number
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="For example 07700 900123"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </label>
      {parsed && !parsed.ok ? <p className="text-sm text-amber-900">{parsed.error}</p> : null}
      {parsed?.ok ? <p className="font-mono text-xs text-slate-600">{parsed.e164}</p> : null}
      <TeamsCallButtons phone={phone} />
    </div>
  )
}

export default function AdminCallCentrePage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab = requested === 'history' || requested === 'contacts' ? requested : 'live'

  function selectTab(next) {
    const nextParams = new URLSearchParams(params)
    if (next === 'live') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const tabs = useMemo(
    () => [
      ['live', 'Teams'],
      ['history', 'Call History'],
      ['contacts', 'Contacts'],
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="admin-surface">
        <h2 className="text-base font-bold tracking-tight text-slate-900 xxs:text-lg sm:text-2xl">Call Centre</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Customer and driver numbers stay in the address book and on bookings. Use Open Microsoft Teams or Call
          with Teams. History appears only when Microsoft Graph is configured on the server.
        </p>
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Call Centre">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`call-centre-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`call-centre-panel-${id}`}
              onClick={() => selectTab(id)}
              className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'live' ? (
        <div id="call-centre-panel-live" role="tabpanel" aria-labelledby="call-centre-tab-live">
          <LiveCallsPanel />
        </div>
      ) : null}
      {tab === 'history' ? (
        <div id="call-centre-panel-history" role="tabpanel" aria-labelledby="call-centre-tab-history">
          <CallHistoryPanel />
        </div>
      ) : null}
      {tab === 'contacts' ? (
        <div id="call-centre-panel-contacts" role="tabpanel" aria-labelledby="call-centre-tab-contacts">
          <ContactsPanel />
        </div>
      ) : null}
    </div>
  )
}
