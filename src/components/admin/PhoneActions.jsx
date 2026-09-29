import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCallContacts } from '../../lib/callContactsContext'
import { saveCallContact } from '../../lib/data/callContactsRepository'
import { subscribeCallUi } from '../../lib/callUiBus'
import { requestOutboundCall } from '../../lib/outboundCall'
import { normalisePhone } from '../../lib/ukPhone'

const buttonClass =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  )
}

/**
 * @param {{
 *   name?: string,
 *   phone?: string,
 *   email?: string,
 *   company?: string,
 *   sourceNote?: string,
 *   compact?: boolean,
 * }} props
 */
export default function PhoneActions({ name = '', phone = '', email = '', company = '', sourceNote = '', compact = false }) {
  const navigate = useNavigate()
  const { byPhone, refresh } = useCallContacts()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [callPhase, setCallPhase] = useState('idle')
  const display = String(phone || '').trim()
  const parsed = display ? normalisePhone(display) : { ok: false, error: '' }
  const matched = parsed.ok ? byPhone(parsed.e164) : null
  const callBusy = busy || callPhase === 'preparing' || callPhase === 'calling' || callPhase === 'ringing' || callPhase === 'connected'

  useEffect(() => subscribeCallUi((next) => setCallPhase(next.phase)), [])

  function startCall() {
    setMessage('')
    if (!parsed.ok) {
      setMessage(parsed.error || 'That telephone number is not valid.')
      return
    }
    setConfirming(true)
  }

  function placeCall() {
    if (!parsed.ok || callBusy) return
    setBusy(true)
    requestOutboundCall({
      name: matched?.fullName || name || '',
      phone: display,
      e164: parsed.e164,
    })
    setConfirming(false)
    setBusy(false)
    navigate('/admin/calls?tab=live')
  }

  function openSave() {
    setMessage('')
    if (!parsed.ok) {
      setMessage(parsed.error || 'That telephone number is not valid.')
      return
    }
    setDraft({
      fullName: matched?.fullName || name || '',
      phone: display,
      email: matched?.email || email || '',
      company: matched?.company || company || '',
      notes: matched?.notes || sourceNote || '',
      allowUpdate: false,
    })
  }

  async function submitSave(allowUpdate) {
    if (!draft) return
    setBusy(true)
    setMessage('')
    try {
      const result = await saveCallContact({ ...draft, id: matched?.id, allowUpdate })
      if (result.duplicate && !allowUpdate) {
        setDraft((current) => ({
          ...current,
          fullName: current.fullName || result.duplicate.fullName,
        }))
        setMessage(`${result.duplicate.fullName} already uses this number. Update that contact instead of creating another.`)
        setDraft((current) => ({ ...current, allowUpdate: true, existingName: result.duplicate.fullName }))
        return
      }
      await refresh()
      setDraft(null)
      setMessage('Contact saved.')
    } catch (error) {
      setMessage(error?.message || 'Could not save the contact.')
    } finally {
      setBusy(false)
    }
  }

  if (!display) return <span className="text-slate-500">—</span>

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-800">{display}</span>
        {matched ? <span className="text-xs font-semibold text-emerald-800">{matched.fullName}</span> : null}
        <button type="button" onClick={startCall} disabled={callBusy} className={buttonClass} aria-label="Call client">
          <PhoneIcon />
          Call client
        </button>
        {matched ? (
          <Link to={`/admin/calls?tab=contacts&contact=${matched.id}`} className={buttonClass}>
            View contact
          </Link>
        ) : (
          <button type="button" onClick={openSave} className={buttonClass}>
            {sourceNote ? 'Save to contacts' : 'Add contact'}
          </button>
        )}
      </div>
      {message ? <p className="text-xs text-amber-900">{message}</p> : null}
      {confirming && parsed.ok ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          <p className="font-semibold">Call this client through Amazon Connect?</p>
          <p className="mt-1">{matched?.fullName || name || 'Unknown caller'}</p>
          <p className="font-mono text-xs">{parsed.e164}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={callBusy}
              onClick={placeCall}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start call
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {draft ? (
        <form
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submitSave(Boolean(draft.allowUpdate))
          }}
        >
          <p className="text-sm font-semibold text-slate-900">
            {draft.allowUpdate ? 'Update existing contact' : 'Save to contacts'}
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Name
            <input
              required
              value={draft.fullName}
              onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Telephone
            <input
              required
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Company
            <input
              value={draft.company}
              onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Notes
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              rows={2}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : draft.allowUpdate ? 'Update contact' : 'Save contact'}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={buttonClass}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
