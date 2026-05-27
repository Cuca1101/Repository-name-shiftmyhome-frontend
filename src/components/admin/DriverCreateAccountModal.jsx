import { useState } from 'react'
import { createDriverAccountAdmin } from '../../lib/createDriverAccountAdmin'

const fieldInput =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'
const fieldLabel = 'text-xs font-semibold uppercase tracking-wide text-slate-500'

/**
 * Admin Add Driver — Supabase Auth + drivers row via Edge Function (no service_role in browser).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCreated: (result: {
 *     driver: import('../../lib/data/driversRepository').ReturnType<import('../../lib/data/driversRepository').fleetDriverToAdminRecord>,
 *     driverId: string,
 *     userId: string,
 *     successMessage: string,
 *   }) => void | Promise<void>,
 * }} props
 */
export default function DriverCreateAccountModal({ open, onClose, onCreated }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicleRegistration, setVehicleRegistration] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('active')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState(
    /** @type {{ message: string, driverId: string, userId: string, driverName: string } | null} */ (null),
  )

  if (!open) return null

  function resetForm() {
    setFullName('')
    setEmail('')
    setPhone('')
    setVehicleRegistration('')
    setPassword('')
    setStatus('active')
    setErr('')
    setSuccess(null)
  }

  function handleClose() {
    if (busy) return
    resetForm()
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const result = await createDriverAccountAdmin({
        fullName,
        email,
        phone,
        vehicleRegistration,
        temporaryPassword: password,
        active: status === 'active',
      })
      if (!result.driver) throw new Error('Account created but driver profile was not returned.')
      setSuccess({
        message: result.successMessage || 'Driver saved',
        driverId: result.driverId,
        userId: result.userId,
        driverName: result.driver.name,
      })
      await onCreated({
        driver: result.driver,
        driverId: result.driverId,
        userId: result.userId,
        successMessage: result.successMessage || 'Driver saved',
      })
    } catch (ex) {
      setErr(ex?.message || 'Could not add driver.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-driver-title"
      onClick={handleClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <>
            <h3 id="add-driver-title" className="text-lg font-semibold text-emerald-900">
              {success.message}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong className="text-slate-900">{success.driverName}</strong> can sign in on the Driver app with the
              email and temporary password you set.
            </p>
            <dl className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="font-semibold uppercase tracking-wide text-emerald-800">Driver id</dt>
                <dd className="font-mono text-emerald-950">{success.driverId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold uppercase tracking-wide text-emerald-800">Auth user id</dt>
                <dd className="max-w-[12rem] truncate font-mono text-emerald-950" title={success.userId}>
                  {success.userId}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <h3 id="add-driver-title" className="text-lg font-semibold text-slate-900">
              Add Driver
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Creates a Supabase Auth user and a linked <code className="rounded bg-slate-100 px-1">drivers</code> row.
              The service role key stays on the server only.
            </p>

            {err ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {err}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={fieldLabel}>Full name *</span>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={fieldInput}
                  placeholder="e.g. Alex Taylor"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Email *</span>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldInput}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Phone</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInput} />
              </label>
              <label className="block">
                <span className={fieldLabel}>Vehicle registration (optional)</span>
                <input
                  value={vehicleRegistration}
                  onChange={(e) => setVehicleRegistration(e.target.value)}
                  className={fieldInput}
                  placeholder="e.g. AB12 CDE"
                  autoCapitalize="characters"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Temporary password *</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldInput}
                  placeholder="Min. 8 characters — share securely with the driver"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={fieldInput}
                >
                  <option value="active">Active — can sign in to Driver app</option>
                  <option value="inactive">Inactive — login blocked</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save driver'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
