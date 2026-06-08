import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, LockOpen, Shield, Users } from 'lucide-react'
import UnlockProtectedSettingsModal from '../components/admin/UnlockProtectedSettingsModal'
import { useAuthAccessUnlock } from '../hooks/useAuthAccessUnlock'
import { fetchAuthUsersForAdmin, setAuthUserRoleAdmin } from '../lib/authRolesAdmin'

function roleBadge(role) {
  if (role === 'admin') {
    return 'bg-emerald-100 text-emerald-900 ring-emerald-200'
  }
  if (role === 'driver') {
    return 'bg-sky-100 text-sky-900 ring-sky-200'
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin'
  if (role === 'driver') return 'Driver'
  return 'No role'
}

export default function AuthAccessAdmin() {
  const { unlocked, remainingMs, unlock, lock } = useAuthAccessUnlock()
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  /** @type {[import('react').Dispatch<import('react').SetStateAction<object[]>>]} */
  const [users, setUsers] = useState([])
  const [roleCounts, setRoleCounts] = useState({ admin: 0, driver: 0, none: 0 })
  const [totalUsers, setTotalUsers] = useState(0)

  const minsLeft =
    remainingMs != null && remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 60000)) : null

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchAuthUsersForAdmin({ listAll: true })
      setUsers(Array.isArray(result.users) ? result.users : [])
      setRoleCounts(result.role_counts || { admin: 0, driver: 0, none: 0 })
      setTotalUsers(Number(result.total) || result.users?.length || 0)
    } catch (e) {
      setError(e?.message || 'Could not load users.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (unlocked) {
      void loadUsers()
    } else {
      setUsers([])
    }
  }, [unlocked, loadUsers])

  const filtered = useMemo(() => {
    let rows = users
    if (roleFilter === 'admin') rows = rows.filter((u) => u.role === 'admin')
    else if (roleFilter === 'driver') rows = rows.filter((u) => u.role === 'driver')
    else if (roleFilter === 'none') rows = rows.filter((u) => u.role === 'none')

    const q = search.trim().toLowerCase()
    if (!q) {
      return [...rows].sort((a, b) => {
        const rank = (r) => (r === 'admin' ? 0 : r === 'driver' ? 1 : 2)
        return rank(a.role) - rank(b.role) || String(a.email).localeCompare(String(b.email))
      })
    }
    return rows
      .filter((u) => String(u.email || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = (r) => (r === 'admin' ? 0 : r === 'driver' ? 1 : 2)
        return rank(a.role) - rank(b.role) || String(a.email).localeCompare(String(b.email))
      })
  }, [users, search, roleFilter])

  async function changeRole(user, role) {
    const label = role === 'none' ? 'remove access role from' : `set as ${role}`
    if (!window.confirm(`${label} ${user.email}?`)) return
    setBusyId(user.id)
    setError('')
    setNotice('')
    try {
      await setAuthUserRoleAdmin(user.id, role)
      setNotice(`Updated ${user.email} → ${roleLabel(role)}. User must sign in again.`)
      await loadUsers()
    } catch (e) {
      setError(e?.message || 'Could not update role.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Shield className="h-4 w-4" aria-hidden />
              Protected
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">User access control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Choose who can open <strong>Admin</strong> and who is a <strong>Driver</strong> (mobile app).
              Unlocked only with your protected admin PIN or password (same as Marketplace settings).
            </p>
          </div>
          {unlocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                <LockOpen className="h-3.5 w-3.5" aria-hidden />
                Unlocked{minsLeft ? ` · ${minsLeft}m` : ''}
              </span>
              <button
                type="button"
                onClick={lock}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Lock now
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Lock className="h-4 w-4" aria-hidden />
              Unlock with PIN
            </button>
          )}
        </div>
      </header>

      {!unlocked ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-800">This page is locked</p>
          <p className="mt-1 text-sm text-slate-600">
            Use your admin PIN or password to manage roles. Create new logins first in Supabase →
            Authentication → Users if needed.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              Total: {totalUsers}
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">
              Admins: {roleCounts.admin}
            </span>
            <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-900">
              Drivers: {roleCounts.driver}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
              No role: {roleCounts.none}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'admin', label: 'Admins only' },
              { id: 'driver', label: 'Drivers only' },
              { id: 'none', label: 'No role' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  roleFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-w-[12rem] flex-1">
              <span className="sr-only">Search email</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email…"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
              {notice}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Users className="h-4 w-4 text-slate-500" aria-hidden />
              <p className="text-sm font-semibold text-slate-900">Auth users</p>
              <span className="text-xs text-slate-500">({filtered.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Driver profile</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Loading users…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                  {filtered.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{user.email || '—'}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{user.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${roleBadge(user.role)}`}
                        >
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.driver_name ? (
                          <span>{user.driver_name}</span>
                        ) : user.driver_profile_id ? (
                          <span className="font-mono text-xs">{user.driver_profile_id}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === user.id || user.role === 'admin'}
                            onClick={() => void changeRole(user, 'admin')}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                          >
                            Make admin
                          </button>
                          <button
                            type="button"
                            disabled={busyId === user.id || user.role === 'driver'}
                            onClick={() => void changeRole(user, 'driver')}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-40"
                          >
                            Make driver
                          </button>
                          <button
                            type="button"
                            disabled={busyId === user.id || user.role === 'none'}
                            onClick={() => void changeRole(user, 'none')}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Remove role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            New email? Create the user in Supabase → Authentication → Users, then refresh here and
            click <strong>Make admin</strong>. Drivers should normally be created from{' '}
            <strong>Drivers</strong> in admin; use <strong>Make driver</strong> only for existing
            accounts.
          </p>
        </>
      )}

      <UnlockProtectedSettingsModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlock={unlock}
        title="Unlock user access control"
        description="Enter your protected admin PIN or password. Same verification as Marketplace protected settings. Unlock lasts 30 minutes in this browser."
      />
    </div>
  )
}
