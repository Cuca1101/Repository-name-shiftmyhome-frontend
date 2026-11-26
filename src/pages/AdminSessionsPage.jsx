import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminSessionStatus,
  listAdminAuthHistory,
  listAdminLoginSessions,
} from '../lib/adminPresence'
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

function formatStamp(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', UK_TIME)
}

function formatHours(ms) {
  const totalMin = Math.max(0, Math.floor(Number(ms) / 60000))
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function londonOffsetMs(utcMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - utcMs
}

function startOfLondonDay(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number)
  const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0)
  return Date.UTC(year, month - 1, day, 0, 0, 0) - londonOffsetMs(noonUtc)
}

function nextLondonDay(dayKey) {
  return londonDayKey(startOfLondonDay(dayKey) + 36 * 60 * 60 * 1000)
}

function dayKeysBetween(startMs, endMs) {
  const keys = []
  let key = londonDayKey(startMs)
  const last = londonDayKey(endMs)
  for (let guard = 0; key && last && key <= last && guard < 400; guard += 1) {
    keys.push(key)
    const next = nextLondonDay(key)
    if (!next || next <= key) break
    key = next
  }
  return keys
}

function overlapMs(startMs, endMs, dayKey) {
  const dayStart = startOfLondonDay(dayKey)
  const dayEnd = startOfLondonDay(nextLondonDay(dayKey))
  return Math.max(0, Math.min(endMs, dayEnd) - Math.max(startMs, dayStart))
}

function formatDayHeading(dayKey) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(startOfLondonDay(dayKey)))
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
      const logins = rows.length
        ? []
        : [...person.logins].sort(
            (a, b) => new Date(b.signed_in_at).getTime() - new Date(a.signed_in_at).getTime(),
          )
      const activity = [
        ...rows.map((row) => ({ kind: 'visit', at: row.signed_in_at, row })),
        ...logins.map((row) => ({ kind: 'login', at: row.signed_in_at, row })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      const lastAt = online?.last_seen_at || activity[0]?.at || ''
      const activeToday =
        Boolean(online) ||
        activity.some((item) => {
          if (item.kind === 'login') {
            return (
              londonDayKey(item.at) === today ||
              londonDayKey(item.row.last_active_at || item.at) === today
            )
          }
          const bounds = activityBounds(item, now)
          if (!Number.isFinite(bounds.start) || !Number.isFinite(bounds.end)) return false
          return dayKeysBetween(bounds.start, bounds.end).includes(today)
        })
      return {
        ...person,
        name: prettyName(person.email),
        visits: rows,
        logins,
        online,
        activity,
        lastAt,
        activeToday,
      }
    })
    .sort((a, b) => {
      if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1
      return new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()
    })
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
  if (status?.state === 'continued') {
    return (
      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
        Continued
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

function activityBounds(item, now) {
  const start = new Date(item.row.signed_in_at).getTime()
  if (item.kind === 'visit') {
    const status = adminSessionStatus(item.row, now)
    const end = status.state === 'online' ? now : new Date(status.leftAt).getTime()
    return { start, end, status }
  }
  const end = new Date(item.row.last_active_at || item.row.signed_in_at).getTime()
  return {
    start,
    end,
    status: { state: 'left', leftAt: item.row.last_active_at, endedBy: 'unknown' },
  }
}

/** One row per person per UK day, split so a long visit still shows on every day it was open. */
function buildDaySheet(people, now) {
  const slices = []
  for (const person of people) {
    for (const item of person.activity) {
      const bounds = activityBounds(item, now)
      if (!Number.isFinite(bounds.start) || !Number.isFinite(bounds.end) || bounds.end < bounds.start) continue
      for (const dayKey of dayKeysBetween(bounds.start, bounds.end)) {
        const hoursMs = overlapMs(bounds.start, bounds.end, dayKey)
        if (hoursMs <= 0) continue
        slices.push({
          dayKey,
          person,
          id: `${item.kind}-${item.row.id}-${dayKey}`,
          start: bounds.start,
          end: bounds.end,
          hoursMs,
          status: bounds.status,
          continued: londonDayKey(bounds.start) !== dayKey,
        })
      }
    }
  }

  const byDay = new Map()
  for (const slice of slices) {
    if (!byDay.has(slice.dayKey)) byDay.set(slice.dayKey, [])
    byDay.get(slice.dayKey).push(slice)
  }

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dayKey, daySlices]) => {
      const byPerson = new Map()
      for (const slice of daySlices) {
        if (!byPerson.has(slice.person.key)) byPerson.set(slice.person.key, [])
        byPerson.get(slice.person.key).push(slice)
      }
      const admins = [...byPerson.values()]
        .map((visits) => {
          const ordered = visits.sort((a, b) => a.start - b.start)
          return {
            person: ordered[0].person,
            visits: ordered.map((visit, index) => ({ ...visit, again: index > 0 })),
            dayMs: ordered.reduce((sum, visit) => sum + visit.hoursMs, 0),
          }
        })
        .sort((a, b) => {
          const aOnline = a.visits.some((visit) => visit.status.state === 'online')
          const bOnline = b.visits.some((visit) => visit.status.state === 'online')
          if (aOnline !== bOnline) return aOnline ? -1 : 1
          return b.dayMs - a.dayMs
        })
      return {
        dayKey,
        label: formatDayHeading(dayKey),
        admins,
        totalMs: admins.reduce((sum, admin) => sum + admin.dayMs, 0),
      }
    })
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
  const [showOlderDays, setShowOlderDays] = useState(false)

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
  const todayKey = londonDayKey(now)
  const daySheet = useMemo(() => {
    try {
      return buildDaySheet(visible, now)
    } catch (err) {
      return [
        {
          dayKey: 'error',
          label: err instanceof Error ? err.stack || err.message : String(err),
          admins: [],
          totalMs: 0,
        },
      ]
    }
  }, [visible, now])
  const scopedDays = scope === 'today' ? daySheet.filter((day) => day.dayKey === todayKey) : daySheet
  const daysShown = scope === 'all' && !showOlderDays ? scopedDays.slice(0, 14) : scopedDays

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin sign-ins</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Each UK day lists who was in admin, the date and time they entered, when they left, and the hours
            that day. A second visit the same day is marked Entered again. Times are UK.
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
      ) : daysShown.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500 shadow-sm">
          {scope === 'today' ? 'Nobody has been in admin today.' : 'No visits recorded yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {daysShown.map((day) => (
            <section key={day.dayKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">{day.label}</h2>
                <p className="text-xs font-medium text-slate-500">
                  {day.admins.length} {day.admins.length === 1 ? 'person' : 'people'} entered · {formatHours(day.totalMs)} total
                </p>
              </header>
              <div className="divide-y divide-slate-100">
                {day.admins.map((admin) => (
                  <article key={admin.person.key} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {admin.person.name}
                          {admin.person.key === me ? (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">You</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">{admin.person.email}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatHours(admin.dayMs)} this day</p>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                      <div className="hidden grid-cols-[1.3fr_1.3fr_0.7fr_auto] gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                        <span>Entered</span>
                        <span>Left</span>
                        <span>Hours</span>
                        <span>Status</span>
                      </div>
                      {admin.visits.map((visit) => {
                        const dayStart = startOfLondonDay(visit.dayKey)
                        const enteredAt = visit.continued ? dayStart : visit.start
                        const leftSameDay = londonDayKey(visit.end) === visit.dayKey
                        const leftLabel =
                          !leftSameDay
                            ? 'Still in admin overnight'
                            : visit.status.state === 'online'
                              ? 'Still here'
                              : formatStamp(visit.end)
                        return (
                          <div
                            key={visit.id}
                            className="grid gap-2 border-t border-slate-100 px-3 py-2 text-sm first:border-t-0 sm:grid-cols-[1.3fr_1.3fr_0.7fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                {visit.again ? 'Entered again' : 'Entered'}
                              </p>
                              <p className="font-medium text-slate-900">{formatStamp(enteredAt)}</p>
                              {visit.continued ? (
                                <p className="text-xs text-slate-500">Still open from {formatStamp(visit.start)}</p>
                              ) : null}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Left</p>
                              <p className="font-medium text-slate-900">{leftLabel}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">Hours</p>
                              <p className="font-semibold text-slate-900">{formatHours(visit.hoursMs)}</p>
                            </div>
                            <StatusPill status={!leftSameDay ? { state: 'continued' } : visit.status} />
                          </div>
                        )
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {scope === 'all' && scopedDays.length > 14 ? (
            <button
              type="button"
              onClick={() => setShowOlderDays((open) => !open)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-left text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              {showOlderDays ? 'Show the latest 14 days' : `Show ${scopedDays.length - 14} older days`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
