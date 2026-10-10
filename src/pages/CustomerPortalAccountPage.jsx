import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PortalShell, { usePortalAccess, usePortalSession } from '../components/customer-portal/PortalShell'
import { getPortalContact, requestEmailChange, requestPasswordReset, savePortalProfile } from '../lib/customerPortalApi'
import { customerPortalClient } from '../lib/customerPortalClient'
import { passwordUpdateBody } from '../lib/customerPortalModel'
import { validateNewPassword } from '../lib/passwordRecoveryUrl'

const emptyProfile = {
  fullName: '',
  phone: '',
  email: '',
  savedAddress: '',
  pendingEmail: '',
  hasPassword: false,
}

export default function CustomerPortalAccountPage() {
  const access = usePortalAccess()
  const { session } = usePortalSession()
  const adminView = access.mode === 'admin'
  const [profile, setProfile] = useState(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  function applyProfile(next) {
    if (!next) return
    setProfile({
      fullName: String(next.fullName || '').trim(),
      phone: String(next.phone || '').trim(),
      email: String(next.email || '').trim(),
      savedAddress: String(next.savedAddress || '').trim(),
      pendingEmail: String(next.pendingEmail || '').trim(),
      hasPassword: Boolean(next.hasPassword),
    })
  }

  useEffect(() => {
    if (access.mode === 'anonymous') return undefined
    let cancelled = false
    setLoading(true)
    getPortalContact(access)
      .then((contact) => {
        if (cancelled) return
        if (!contact?.email && !contact?.fullName) setLoadError('This customer profile could not be loaded.')
        else setLoadError('')
        applyProfile(contact)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || 'This customer profile could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session, access.mode, access.customerId])

  return (
    <PortalShell
      title="Account settings | ShiftMyHome"
      description="Your ShiftMyHome name, phone, address, email and password."
      path="/portal/account"
    >
      <Link to={access.portalTo('/portal/bookings')} className="text-sm font-semibold text-brand-700">Back to bookings</Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Account settings</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        These details belong to this customer profile. An email link can still be used to sign in.
      </p>
      {loading ? <p className="mt-5 text-sm text-slate-500">Loading your account…</p> : null}
      {loadError ? <p className="mt-4 text-sm text-red-700" role="alert">{loadError}</p> : null}
      {!loading ? (
        <div className="mt-5 space-y-4">
          <PersonalDetails profile={profile} access={access} onSaved={applyProfile} />
          <SavedAddress profile={profile} access={access} onSaved={applyProfile} />
          <EmailAddress profile={profile} access={access} onSaved={applyProfile} />
          <PasswordSecurity profile={profile} adminView={adminView} onPasswordSet={() => applyProfile({ ...profile, hasPassword: true })} />
        </div>
      ) : null}
    </PortalShell>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function FieldActions({ editing, onEdit, editLabel, onCancel }) {
  if (editing) {
    return (
      <button type="button" className="text-sm font-semibold text-slate-600" onClick={onCancel}>
        Cancel
      </button>
    )
  }
  return (
    <button type="button" className="text-sm font-bold text-brand-700" onClick={onEdit}>
      {editLabel}
    </button>
  )
}

function PersonalDetails({ profile, access, onSaved }) {
  const [editor, setEditor] = useState('')
  const [name, setName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.fullName)
    setPhone(profile.phone)
  }, [profile.fullName, profile.phone])

  function close() {
    setEditor('')
    setError('')
    setName(profile.fullName)
    setPhone(profile.phone)
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const field = editor === 'phone' ? 'phone' : 'full_name'
      const value = editor === 'phone' ? phone : name
      const next = await savePortalProfile(field, value, access)
      onSaved(next)
      setEditor('')
    } catch (err) {
      setError(err?.message || 'Could not save this change.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Personal details">
      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium text-slate-500">Full name</span>
              <span className="mt-1 block font-semibold">{profile.fullName || 'Name not on this account yet'}</span>
            </p>
            <FieldActions
              editing={editor === 'name'}
              editLabel="Edit my name"
              onEdit={() => { setEditor('name'); setError('') }}
              onCancel={close}
            />
          </div>
          {editor === 'name' ? (
            <form onSubmit={save} className="mt-3 space-y-3">
              <label className="block text-sm font-medium" htmlFor="account-name">Full name</label>
              <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
              {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
              <SaveButton saving={saving} />
            </form>
          ) : null}
        </div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium text-slate-500">Phone</span>
              <span className="mt-1 block font-semibold">{profile.phone || 'No phone saved'}</span>
            </p>
            <FieldActions
              editing={editor === 'phone'}
              editLabel="Edit phone number"
              onEdit={() => { setEditor('phone'); setError('') }}
              onCancel={close}
            />
          </div>
          {editor === 'phone' ? (
            <form onSubmit={save} className="mt-3 space-y-3">
              <label className="block text-sm font-medium" htmlFor="account-phone">Phone number</label>
              <input id="account-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
              {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
              <SaveButton saving={saving} />
            </form>
          ) : null}
        </div>
      </div>
    </Section>
  )
}

function SavedAddress({ profile, access, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState(profile.savedAddress)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setAddress(profile.savedAddress), [profile.savedAddress])

  function close() {
    setEditing(false)
    setError('')
    setAddress(profile.savedAddress)
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const next = await savePortalProfile('saved_address', address, access)
      onSaved(next)
      setEditing(false)
    } catch (err) {
      setError(err?.message || 'Could not save this address.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Saved addresses">
      <p className="mt-2 text-sm leading-6 text-slate-600">
        This address can be reused when you start a new booking. Collection and delivery addresses on existing bookings stay as they are.
      </p>
      <div className="mt-4 flex items-start justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium text-slate-500">Saved address</span>
          <span className="mt-1 block font-semibold">{profile.savedAddress || 'No address saved on this profile yet'}</span>
        </p>
        <FieldActions editing={editing} editLabel="Edit my address" onEdit={() => setEditing(true)} onCancel={close} />
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-3">
          <label className="block text-sm font-medium" htmlFor="account-address">Address</label>
          <textarea id="account-address" value={address} onChange={(event) => setAddress(event.target.value)} required rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <SaveButton saving={saving} />
        </form>
      ) : null}
    </Section>
  )
}

function EmailAddress({ profile, access, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [nextEmail, setNextEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    setEditing(false)
    setError('')
    setNextEmail('')
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const result = await requestEmailChange(nextEmail, access)
      setMessage(result?.message || 'Pending verification. The current email stays in place until the new address is confirmed.')
      onSaved({ ...profile, pendingEmail: result?.pending_email || nextEmail.trim().toLowerCase() })
      setEditing(false)
      setNextEmail('')
    } catch (err) {
      setError(err?.message || 'The current email is unchanged.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Email address">
      <div className="mt-4 flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm">
          <span className="font-medium text-slate-500">Email</span>
          <span className="mt-1 block break-all font-semibold">{profile.email || 'Signed-in account'}</span>
        </p>
        <FieldActions editing={editing} editLabel="Change email address" onEdit={() => { setEditing(true); setError('') }} onCancel={close} />
      </div>
      {profile.pendingEmail ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950" role="status">
          Pending verification — {profile.pendingEmail}. The current email stays in place until that address is confirmed.
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-800" role="status">{message}</p> : null}
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-3">
          <label className="block text-sm font-medium" htmlFor="account-email">New email address</label>
          <input id="account-email" type="email" autoComplete="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
          <p className="text-sm leading-6 text-slate-600">We email a confirmation link to the new address. Bookings, payments and feedback stay on this profile.</p>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <SaveButton saving={saving} label={saving ? 'Sending confirmation…' : 'Save changes'} />
        </form>
      ) : null}
    </Section>
  )
}

function PasswordSecurity({ profile, adminView, onPasswordSet }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    const invalid = validateNewPassword(password, confirm)
    if (invalid) {
      setError(invalid)
      return
    }
    if (adminView || !customerPortalClient) {
      setError('A customer password is changed from the customer sign-in. This admin view leaves the admin password as it is.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await customerPortalClient.auth.updateUser(passwordUpdateBody(password))
      if (updateError) {
        setError(updateError.message || 'Could not save the password.')
        return
      }
      setPassword('')
      setConfirm('')
      setOpen(false)
      setMessage('Password saved. An email link can still be used to sign in.')
      onPasswordSet()
    } finally {
      setSaving(false)
    }
  }

  async function resetPassword() {
    setError('')
    setMessage('')
    if (!profile.email) {
      setError('Add an email before sending a reset link.')
      return
    }
    setResetting(true)
    try {
      const result = await requestPasswordReset(profile.email)
      setMessage(result?.message || `A reset link is on its way to ${profile.email}. It opens the password form.`)
    } catch (err) {
      setError(err?.message || 'Could not send the reset link.')
    } finally {
      setResetting(false)
    }
  }

  const passwordLabel = profile.hasPassword ? 'Change password' : 'Set password'

  return (
    <Section title="Password & security">
      <p className="mt-2 text-sm leading-6 text-slate-600">
        A password is optional. Signing in with an email link stays available.
      </p>
      {adminView ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
          Password changes stay on this customer’s sign-in. This admin view leaves your admin password as it is.
        </p>
      ) : (
        <div className="mt-4">
          {open ? (
            <form onSubmit={save} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">{passwordLabel}</h3>
                <button type="button" className="text-sm font-semibold text-slate-600" onClick={close}>Cancel</button>
              </div>
              <label className="block text-sm font-medium" htmlFor="account-password">New password</label>
              <input id="account-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
              <label className="block text-sm font-medium" htmlFor="account-confirm">Confirm password</label>
              <input id="account-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-brand-500" />
              <SaveButton saving={saving} />
            </form>
          ) : (
            <button type="button" className="text-sm font-bold text-brand-700" onClick={() => { setOpen(true); setError(''); setMessage('') }}>
              {passwordLabel}
            </button>
          )}
        </div>
      )}
      <div className="mt-4">
        <button type="button" className="text-sm font-bold text-brand-700 disabled:opacity-60" disabled={resetting} onClick={resetPassword}>
          {resetting ? 'Sending reset email…' : 'Reset my password'}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 text-sm leading-6 text-emerald-800" role="status">{message}</p> : null}
    </Section>
  )
}

function SaveButton({ saving, label = '' }) {
  return (
    <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
      {label || (saving ? 'Saving…' : 'Save changes')}
    </button>
  )
}
