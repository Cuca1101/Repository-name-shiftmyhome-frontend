import { useState } from 'react'
import { Link } from 'react-router-dom'
import TeamsCallButtons from './TeamsCallButtons'
import { useCallContacts } from '../../lib/callContactsContext'
import { saveCallContact } from '../../lib/data/callContactsRepository'
import { normalisePhone } from '../../lib/ukPhone'

const buttonClass =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'

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
  const { byPhone, refresh } = useCallContacts()
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const display = String(phone || '').trim()
  const parsed = display ? normalisePhone(display) : { ok: false, error: '' }
  const matched = parsed.ok ? byPhone(parsed.e164) : null

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
        <TeamsCallButtons phone={display} compact={compact} />
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
