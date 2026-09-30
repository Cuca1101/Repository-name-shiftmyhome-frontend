import { useCallback, useEffect, useState } from 'react'
import {
  ADMIN_PRESENCE_ONLINE_MS,
  adminSessionDurationMs,
  adminSessionStatus,
  listAdminLoginSessions,
} from '../lib/adminPresence'
import { parseUserAgentLite } from '../lib/parseUserAgent'

const UK_TIME = {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

function formatWhen(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', UK_TIME)
}

function formatDuration(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours <= 0) return `${minutes} min`
  return `${hours}h ${minutes}m`
}

function StatusBadge({ status }) {
  if (status.state === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Online
      </span>
    )
  }
  if (status.endedBy === 'sign-out') {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Signed out
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
      Browser closed
    </span>
  )
}

export default function AdminSessionsPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const data = await listAdminLoginSessions()
      setRows(data)
      setError('')
    } catch (err) {
      const message = err?.message || 'Could not load admin sign-ins.'
      setError(
        /admin_login_sessions|schema cache|does not exist/i.test(message)
          ? 'The sign-in journal is not in the database yet. Apply migration 103_admin_login_sessions.sql, then refresh.'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refresh = window.setInterval(() => {
      setNow(Date.now())
      void load()
    }, 20_000)
    return () => window.clearInterval(refresh)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin sign-ins</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Who opened the admin panel, how long they stayed, and when they left. Times are UK. A visit stays
          Online while the panel is open. Sign out records the exact leave time. Closing the browser records
          the last moment the panel was still open, within about {Math.round(ADMIN_PRESENCE_ONLINE_MS / 1000)}{' '}
          seconds.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-8 text-sm text-slate-500">Loading sign-ins…</p>
        ) : error && rows.length === 0 ? null : rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            No sign-ins recorded yet. This list starts from the next time someone opens admin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Signed in</th>
                  <th className="px-4 py-3">Time in admin</th>
                  <th className="px-4 py-3">Left</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Browser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const status = adminSessionStatus(row, now)
                  const browser = parseUserAgentLite(row.user_agent || '')
                  return (
                    <tr key={row.id} className="text-slate-800">
                      <td className="px-4 py-3 font-medium">{row.email}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatWhen(row.signed_in_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDuration(adminSessionDurationMs(row, now))}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {status.state === 'online' ? 'Still here' : formatWhen(status.leftAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {browser.browser_name}
                        <span className="text-slate-400"> · {browser.device_type}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
