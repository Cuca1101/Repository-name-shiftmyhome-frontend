import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ADMIN_PRESENCE_ONLINE_MS,
  adminSessionDurationMs,
  adminSessionStatus,
  listAdminAuthHistory,
  listAdminLoginSessions,
} from '../lib/adminPresence'
import { parseUserAgentLite } from '../lib/parseUserAgent'
import { supabase } from '../lib/supabase'

const UK_TIME = {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const VISIT_MATCH_MS = 5 * 60 * 1000

function formatWhen(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', UK_TIME)
}

function londonDayKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatSmartWhen(iso, now) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const day = londonDayKey(date)
  const today = londonDayKey(now)
  const yesterday = londonDayKey(now - 24 * 60 * 60 * 1000)
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  })
  if (day === today) return `Today, ${time}`
  if (day === yesterday) return `Yesterday, ${time}`
  return formatWhen(iso)
}

function relativeTime(iso, now) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return '—'
  const minutes = Math.floor(Math.max(0, now - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  return formatWhen(iso)
}

function formatDuration(ms) {
  const safe = Math.max(0, ms)
  const totalMin = Math.floor(safe / 60000)
  if (totalMin <= 0) return 'Under a minute'
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours <= 0) return `${minutes} min`
  return `${hours}h ${minutes}m`
}

function personKey(email) {
  return String(email || 'unknown').trim().toLowerCase()
}

function prettyName(email) {
  const local = String(email || '').split('@')[0] || 'Admin'
  const words = local.replace(/[._+-]+/g, ' ').trim()
  if (!words) return String(email || 'Admin')
  return words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function sameMoment(left, right) {
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= VISIT_MATCH_MS
}

/** One Online row per admin. A second window is the same person, not a second visit. */
function visibleVisits(rows, now) {
  const seenOnline = new Set()
  const byRecent = [...rows].sort(
    (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
  )
  const kept = byRecent.filter((row) => {
    if (adminSessionStatus(row, now).state !== 'online') return true
    const email = personKey(row.email)
    if (seenOnline.has(email)) return false
    seenOnline.add(email)
    return true
  })
  return kept.sort((a, b) => new Date(b.signed_in_at).getTime() - new Date(a.signed_in_at).getTime())
}

function buildPeople(visits, history, now) {
  const map = new Map()
  const ensure = (email) => {
    const key = personKey(email)
    if (!map.has(key)) {
      map.set(key, { key, email: email || 'unknown', visits: [], logins: [] })
    }
    const person = map.get(key)
    if (email && person.email === 'unknown') person.email = email
    return person
  }

  for (const row of visits) ensure(row.email).visits.push(row)
  for (const row of history) {
    const person = ensure(row.email)
    const covered = person.visits.some((visit) => sameMoment(visit.signed_in_at, row.signed_in_at))
    if (!covered) person.logins.push(row)
  }

  const today = londonDayKey(now)
  return [...map.values()]
    .map((person) => {
      const rows = visibleVisits(person.visits, now)
      const online = rows.find((row) => adminSessionStatus(row, now).state === 'online') || null
      const logins = [...person.logins].sort(
        (a, b) => new Date(b.signed_in_at).getTime() - new Date(a.signed_in_at).getTime(),
      )
      const activity = [
        ...rows.map((row) => ({ kind: 'visit', at: row.signed_in_at, row })),
        ...logins.map((row) => ({ kind: 'login', at: row.signed_in_at, row })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      const lastAt = online?.last_seen_at || activity[0]?.at || ''
      const activeToday =
        Boolean(online) ||
        activity.some((item) => londonDayKey(item.at) === today || londonDayKey(item.row.last_seen_at || item.row.last_active_at) === today)
      const deviceSource = online?.user_agent || rows[0]?.user_agent || logins[0]?.user_agent || ''
      return {
        ...person,
        name: prettyName(person.email),
        visits: rows,
        logins,
        online,
        activity,
        lastAt,
        activeToday,
        browser: parseUserAgentLite(deviceSource),
      }
    })
    .sort((a, b) => {
      if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1
      return new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()
    })
}

function DeviceLine({ browser }) {
  return (
    <span>
      {browser.browser_name}
      <span className="text-slate-400"> · {browser.device_type}</span>
    </span>
  )
}

function StatusPill({ status }) {
  if (status?.state === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Online
      </span>
    )
  }
  if (status?.endedBy === 'sign-out') {
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

function ActivityList({ items, now }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 5)
  if (items.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">No visits recorded yet.</p>
  }
  return (
    <div className="border-t border-slate-100">
      <ul className="divide-y divide-slate-100">
        {shown.map((item) => {
          if (item.kind === 'login') {
            return (
              <li key={`login-${item.row.id}`} className="grid gap-1 px-4 py-3 text-sm text-slate-700 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium text-slate-900">{formatSmartWhen(item.row.signed_in_at, now)}</p>
                  <p className="text-xs text-slate-500">
                    Last active {formatSmartWhen(item.row.last_active_at, now)}
                    {' · '}
                    <DeviceLine browser={parseUserAgentLite(item.row.user_agent || '')} />
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">Login kept by the browser</span>
              </li>
            )
          }
          const status = adminSessionStatus(item.row, now)
          return (
            <li key={item.row.id} className="grid gap-1 px-4 py-3 text-sm text-slate-700 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-medium text-slate-900">{formatSmartWhen(item.row.signed_in_at, now)}</p>
                <p className="text-xs text-slate-500">
                  {formatDuration(adminSessionDurationMs(item.row, now))} in admin
                  {' · '}
                  {status.state === 'online' ? 'Still here' : `Left ${formatSmartWhen(status.leftAt, now)}`}
                  {' · '}
                  <DeviceLine browser={parseUserAgentLite(item.row.user_agent || '')} />
                </p>
              </div>
              <StatusPill status={status} />
            </li>
          )
        })}
      </ul>
      {items.length > 5 ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="w-full border-t border-slate-100 px-4 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {expanded ? 'Show less' : `Show ${items.length - 5} older`}
        </button>
      ) : null}
    </div>
  )
}

export default function AdminSessionsPage() {
  const [rows, setRows] = useState([])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [me, setMe] = useState('')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [openKeys, setOpenKeys] = useState(() => new Set())

  const load = useCallback(async () => {
    const [visits, saved] = await Promise.allSettled([listAdminLoginSessions(), listAdminAuthHistory()])

    if (visits.status === 'fulfilled') {
      setRows(visits.value)
      setError('')
    } else {
      const message = visits.reason?.message || 'Could not load admin sign-ins.'
      setError(
        /admin_login_sessions|schema cache|does not exist/i.test(message)
          ? 'The sign-in journal is not in the database yet.'
          : message,
      )
    }

    if (saved.status === 'fulfilled') {
      setHistory(saved.value)
      setHistoryError('')
    } else {
      const message = saved.reason?.message || 'Could not load earlier logins.'
      setHistoryError(
        /list_admin_auth_history|schema cache|does not exist/i.test(message)
          ? 'Earlier logins are not available yet.'
          : message,
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const refresh = window.setInterval(() => {
      setNow(Date.now())
      void load()
    }, 20_000)
    return () => window.clearInterval(refresh)
  }, [load])

  useEffect(() => {
    if (!supabase) return undefined
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setMe(personKey(data.session?.user?.email || ''))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const people = useMemo(() => buildPeople(rows, history, now), [rows, history, now])
  const onlineCount = people.filter((person) => person.online).length
  const todayCount = people.filter((person) => person.activeToday).length
  const needle = query.trim().toLowerCase()
  const visible = people.filter((person) => {
    if (needle && !person.email.toLowerCase().includes(needle) && !person.name.toLowerCase().includes(needle)) {
      return false
    }
    if (scope === 'online') return Boolean(person.online)
    if (scope === 'today') return person.activeToday
    return true
  })
  const onlinePeople = visible.filter((person) => person.online)
  const otherPeople = scope === 'online' ? [] : visible.filter((person) => !person.online)

  function togglePerson(key) {
    setOpenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin sign-ins</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Who is in the panel now, and when each admin last came in. Times are UK. A visit stays online
            while this panel is open, and drops off about {Math.round(ADMIN_PRESENCE_ONLINE_MS / 1000)} seconds
            after the browser closes.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Online now</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-950">{loading ? '…' : onlineCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active today</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '…' : todayCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admins seen</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '…' : people.length}</p>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {historyError ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {historyError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search admins</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:ring-2"
          />
        </label>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            ['all', 'Everyone'],
            ['online', 'Online'],
            ['today', 'Today'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                scope === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500 shadow-sm">
          Loading sign-ins…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500 shadow-sm">
          {people.length === 0
            ? 'No sign-ins recorded yet. This list starts from the next time someone opens admin.'
            : scope === 'online'
              ? 'Nobody is in admin right now.'
              : 'No admins match this search.'}
        </p>
      ) : (
        <div className="space-y-4">
          {onlinePeople.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">In the panel now</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {onlinePeople.map((person) => {
                  const open = openKeys.has(person.key)
                  const status = adminSessionStatus(person.online, now)
                  return (
                    <article key={person.key} className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => togglePerson(person.key)}
                        aria-expanded={open}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50/40"
                      >
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{person.name}</span>
                            {person.key === me ? (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                You
                              </span>
                            ) : null}
                            <StatusPill status={status} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{person.email}</span>
                          <span className="mt-1 block text-xs text-slate-600">
                            Here for {formatDuration(adminSessionDurationMs(person.online, now))}
                            {' · since '}
                            {formatSmartWhen(person.online.signed_in_at, now)}
                            {' · '}
                            <DeviceLine browser={person.browser} />
                          </span>
                        </span>
                      </button>
                      {open ? <ActivityList items={person.activity} now={now} /> : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ) : scope === 'all' && !needle ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
              Nobody is in admin right now.
            </p>
          ) : null}

          {otherPeople.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Recent admins</h2>
              <ul className="divide-y divide-slate-100">
                {otherPeople.map((person) => {
                  const open = openKeys.has(person.key)
                  const latest = person.activity[0]
                  const latestVisit = person.visits[0]
                  const latestStatus = latestVisit ? adminSessionStatus(latestVisit, now) : null
                  return (
                    <li key={person.key}>
                      <button
                        type="button"
                        onClick={() => togglePerson(person.key)}
                        aria-expanded={open}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{person.name}</span>
                            {person.key === me ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                You
                              </span>
                            ) : null}
                            {latestStatus ? <StatusPill status={latestStatus} /> : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                Earlier login
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{person.email}</span>
                          <span className="mt-1 block text-xs text-slate-600">
                            Last seen {relativeTime(person.lastAt, now)}
                            {latest ? ` · ${formatSmartWhen(latest.at, now)}` : ''}
                            {' · '}
                            <DeviceLine browser={person.browser} />
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-400">{open ? 'Hide' : 'Visits'}</span>
                      </button>
                      {open ? <ActivityList items={person.activity} now={now} /> : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
