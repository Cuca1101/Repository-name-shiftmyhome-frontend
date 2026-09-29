import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCallContacts } from '../../lib/callContactsContext'
import { deleteCallContact, saveCallContact } from '../../lib/data/callContactsRepository'
import { subscribeCallUi } from '../../lib/callUiBus'
import { requestOutboundCall } from '../../lib/outboundCall'
import { normalisePhone } from '../../lib/ukPhone'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const emptyForm = { id: '', fullName: '', phone: '', company: '', email: '', notes: '', allowUpdate: false }

export default function ContactsPanel({ onCall }) {
  const { contacts, loading, error, refresh } = useCallContacts()
  const [params] = useSearchParams()
  const focusId = params.get('contact') || ''
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [callPhase, setCallPhase] = useState('idle')
  const callBusy = callPhase === 'preparing' || callPhase === 'calling' || callPhase === 'ringing' || callPhase === 'connected'

  useEffect(() => subscribeCallUi((next) => setCallPhase(next.phase)), [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return contacts
    return contacts.filter((contact) =>
      [contact.fullName, contact.company, contact.email, contact.phoneOriginal, contact.phoneE164]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [contacts, query])

  function beginEdit(contact) {
    setEditing(true)
    setMessage('')
    setForm({
      id: contact.id,
      fullName: contact.fullName,
      phone: contact.phoneOriginal || contact.phoneE164,
      company: contact.company,
      email: contact.email,
      notes: contact.notes,
      allowUpdate: true,
    })
  }

  function beginCreate() {
    setEditing(true)
    setMessage('')
    setForm(emptyForm)
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await saveCallContact({
        id: form.id || undefined,
        fullName: form.fullName,
        phone: form.phone,
        company: form.company,
        email: form.email,
        notes: form.notes,
        allowUpdate: Boolean(form.id) || form.allowUpdate,
      })
      if (result.duplicate) {
        setForm((current) => ({ ...current, allowUpdate: true, id: result.duplicate.id }))
        setMessage(`${result.duplicate.fullName} already uses this number. Save again to update that contact.`)
        return
      }
      await refresh()
      setEditing(false)
      setForm(emptyForm)
      setMessage('Contact saved.')
    } catch (err) {
      setMessage(err?.message || 'Could not save the contact.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await deleteCallContact(pendingDelete.id)
      await refresh()
      setPendingDelete(null)
      setMessage('Contact deleted.')
    } catch (err) {
      setMessage(err?.message || 'Could not delete the contact.')
    } finally {
      setBusy(false)
    }
  }

  function callContact(contact) {
    const parsed = normalisePhone(contact.phoneE164)
    if (!parsed.ok) {
      setMessage(parsed.error)
      return
    }
    requestOutboundCall({ name: contact.fullName, phone: contact.phoneE164, e164: parsed.e164 })
    onCall?.()
  }

  return (
    <div className="space-y-4">
      <div className="admin-surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900">Contacts</h3>
            <p className="mt-1 text-sm text-slate-600">Shared address book for Amazon Connect calls.</p>
          </div>
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Add contact
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, company, email or telephone"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      {message ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      {editing ? (
        <form onSubmit={submit} className="admin-surface grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input required value={form.fullName} onChange={(event) => setForm((c) => ({ ...c, fullName: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Telephone
            <input required value={form.phone} onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Company
            <input value={form.company} onChange={(event) => setForm((c) => ({ ...c, company: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input value={form.email} onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea value={form.notes} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} className={`${inputClass} mt-1`} rows={3} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Saving…' : 'Save contact'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {pendingDelete ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>Delete {pendingDelete.fullName}? This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={confirmDelete} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Delete contact
            </button>
            <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden />
          Loading contacts…
        </div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          {query.trim() ? 'No contacts matched this search.' : 'No contacts yet. Add a contact to start the address book.'}
        </div>
      ) : null}

      <div className="space-y-3 lg:hidden">
        {filtered.map((contact) => (
          <article key={contact.id} className={`rounded-xl border bg-white p-3 shadow-sm ${contact.id === focusId ? 'border-brand-500' : 'border-slate-200'}`}>
            <p className="font-semibold text-slate-900">{contact.fullName}</p>
            <p className="text-sm text-slate-700">{contact.phoneE164}</p>
            {contact.company ? <p className="text-sm text-slate-600">{contact.company}</p> : null}
            {contact.email ? <p className="text-sm text-slate-600">{contact.email}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={callBusy} onClick={() => callContact(contact)} className="min-h-[44px] rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50">
                Call
              </button>
              <button type="button" onClick={() => beginEdit(contact)} className="min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm font-semibold">
                Edit
              </button>
              <button type="button" onClick={() => setPendingDelete(contact)} className="min-h-[44px] rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-800">
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Telephone</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr key={contact.id} className={`border-b border-slate-100 ${contact.id === focusId ? 'bg-emerald-50' : ''}`}>
                  <td className="px-3 py-3 font-medium text-slate-900">{contact.fullName}</td>
                  <td className="px-3 py-3 font-mono text-xs">{contact.phoneE164}</td>
                  <td className="px-3 py-3">{contact.company || '—'}</td>
                  <td className="px-3 py-3">{contact.email || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={callBusy} onClick={() => callContact(contact)} className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                        Call
                      </button>
                      <button type="button" onClick={() => beginEdit(contact)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold">
                        Edit
                      </button>
                      <button type="button" onClick={() => setPendingDelete(contact)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-800">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
