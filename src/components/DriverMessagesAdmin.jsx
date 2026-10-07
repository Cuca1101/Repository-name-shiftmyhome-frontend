import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  fetchDriverSupportMessages,
  groupMessagesByDriver,
  isMessageUnread,
  markDriverMessageRead,
  updateDriverMessageStatus,
} from '../lib/driverMessagesRepository'
import {
  ensureSupportRequestNotificationPermission,
  unlockSupportRequestSound,
} from '../lib/supportRequestAlerts'

const STATUS_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

const STATUS_COLORS = {
  new: 'bg-sky-100 text-sky-900',
  in_progress: 'bg-amber-100 text-amber-900',
  resolved: 'bg-emerald-100 text-emerald-800',
}

/**
 * @param {string | null | undefined} name
 */
function driverInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/**
 * @param {string | null | undefined} iso
 */
function formatSubmittedLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDateTimeUK(iso)
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${date} · ${time}`
}

/**
 * @param {{ name?: string | null, photoUrl?: string | null, size?: 'sm' | 'md' | 'lg' }} props
 */
function DriverAvatar({ name, photoUrl, size = 'md' }) {
  const dim =
    size === 'lg' ? 'h-14 w-14 text-base' : size === 'sm' ? 'h-10 w-10 text-xs' : 'h-12 w-12 text-sm'
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`}
      />
    )
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white ring-2 ring-white shadow-sm`}
      aria-hidden
    >
      {driverInitials(name)}
    </div>
  )
}

function StatusBadge({ status }) {
  const key = String(status || 'new')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        STATUS_COLORS[key] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {STATUS_LABELS[key] || key}
    </span>
  )
}

/**
 * Admin Driver Messages — grouped by driver, with per-message read state.
 */
export default function DriverMessagesAdmin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [driverFilter, setDriverFilter] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState(null)

  const selectedDriverId = searchParams.get('driver') || ''

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { rows: data, error: err } = await fetchDriverSupportMessages()
    if (err) setError(err)
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    ensureSupportRequestNotificationPermission()
    void unlockSupportRequestSound()
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined
    const channel = supabase
      .channel('admin-driver-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_support_requests' },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  const groups = useMemo(() => groupMessagesByDriver(rows), [rows])

  const driverOptions = useMemo(() => {
    return groups
      .map((g) => ({ id: g.driverId, name: g.driverName }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [groups])

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (driverFilter && g.driverId !== driverFilter) return false
      if (filter === 'unread') return g.unreadCount > 0
      if (filter === 'urgent') {
        return g.messages.some((m) => m.urgent && isMessageUnread(m))
      }
      if (filter === 'new') return g.messages.some((m) => m.status === 'new')
      if (filter === 'in_progress') return g.messages.some((m) => m.status === 'in_progress')
      if (filter === 'resolved') return g.messages.some((m) => m.status === 'resolved')
      return true
    })
  }, [groups, filter, driverFilter])

  const selectedGroup = useMemo(
    () => groups.find((g) => g.driverId === selectedDriverId) || null,
    [groups, selectedDriverId],
  )

  const threadMessages = useMemo(() => {
    if (!selectedGroup) return []
    let list = [...selectedGroup.messages]
    if (filter === 'unread') list = list.filter(isMessageUnread)
    if (filter === 'urgent') list = list.filter((m) => m.urgent)
    if (filter === 'new') list = list.filter((m) => m.status === 'new')
    if (filter === 'in_progress') list = list.filter((m) => m.status === 'in_progress')
    if (filter === 'resolved') list = list.filter((m) => m.status === 'resolved')
    return list
  }, [selectedGroup, filter])

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null
    return rows.find((r) => r.id === selectedMessageId) || null
  }, [rows, selectedMessageId])

  // When opening a message that is unread, persist read_at (only that message).
  useEffect(() => {
    if (!selectedMessage || !isMessageUnread(selectedMessage)) return undefined
    let cancelled = false
    ;(async () => {
      const result = await markDriverMessageRead(selectedMessage.id)
      if (cancelled || !result.ok) return
      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedMessage.id
            ? { ...r, read_at: new Date().toISOString() }
            : r,
        ),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMessage])

  const openDriver = useCallback(
    (driverId) => {
      setSearchParams({ driver: driverId })
      setSelectedMessageId(null)
    },
    [setSearchParams],
  )

  const backToList = useCallback(() => {
    setSearchParams({})
    setSelectedMessageId(null)
  }, [setSearchParams])

  const openMessage = useCallback((id) => {
    setSelectedMessageId(id)
  }, [])

  const setStatus = useCallback(
    async (id, status) => {
      setSavingId(id)
      const result = await updateDriverMessageStatus(id, status)
      if (!result.ok) setError(result.error || 'Could not update status.')
      else await load()
      setSavingId(null)
    },
    [load],
  )

  const jobHref = (row) => {
    if (!row?.quote_id) return null
    return `/admin/active-jobs/${encodeURIComponent(String(row.quote_id))}`
  }

  const totalUnread = useMemo(
    () => rows.filter(isMessageUnread).length,
    [rows],
  )

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Driver Messages</h1>
          <p className="mt-1 text-sm text-slate-600">
            Support messages from the driver app. Unread count is separate from workflow status.
            {totalUnread > 0 ? (
              <span className="ml-1 font-semibold text-red-700">
                {totalUnread} unread
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
          { id: 'urgent', label: 'Urgent' },
          { id: 'new', label: 'New' },
          { id: 'in_progress', label: 'In progress' },
          { id: 'resolved', label: 'Resolved' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          aria-label="Filter by driver"
        >
          <option value="">All drivers</option>
          {driverOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading driver messages…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!selectedDriverId ? (
        <>
          {!loading && !error && filteredGroups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No driver messages in this view.
            </p>
          ) : null}

          <div className="space-y-2">
            {filteredGroups.map((g) => {
              const preview = String(g.latest?.message || '').trim()
              const unreadLabel =
                g.unreadCount === 1 ? '1 unread message' : `${g.unreadCount} unread messages`
              return (
                <button
                  key={g.driverId}
                  type="button"
                  onClick={() => openDriver(g.driverId)}
                  className={`flex w-full gap-3 rounded-xl border p-3 text-left transition hover:border-slate-300 ${
                    g.unreadCount > 0
                      ? g.urgentUnread > 0
                        ? 'border-red-300 bg-red-50/80 shadow-sm shadow-red-100'
                        : 'border-sky-200 bg-sky-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <DriverAvatar name={g.driverName} photoUrl={g.driverPhotoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {g.driverName}
                        {g.unreadCount > 0 ? (
                          <span className="text-red-700"> ({g.unreadCount})</span>
                        ) : null}
                      </p>
                      {g.urgentUnread > 0 ? (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Urgent
                        </span>
                      ) : null}
                      {g.unreadCount > 0 ? (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {g.unreadCount} unread
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">All read</span>
                      )}
                    </div>
                    {g.unreadCount > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-slate-600">{unreadLabel}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {g.latest?.topic || 'Support'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                      {preview ? `“${preview}”` : '—'}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {formatSubmittedLabel(g.latest?.created_at)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={backToList}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              ← All drivers
            </button>
            {selectedGroup ? (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <DriverAvatar
                  name={selectedGroup.driverName}
                  photoUrl={selectedGroup.driverPhotoUrl}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">
                    {selectedGroup.driverName}
                    {selectedGroup.unreadCount > 0 ? (
                      <span className="text-red-700"> ({selectedGroup.unreadCount})</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedGroup.unreadCount === 0
                      ? 'No unread messages'
                      : selectedGroup.unreadCount === 1
                        ? '1 unread message'
                        : `${selectedGroup.unreadCount} unread messages`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Driver not found.</p>
            )}
          </div>

          {!selectedGroup ? null : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-2">
                {threadMessages.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No messages match this filter.
                  </p>
                ) : null}
                {threadMessages.map((m) => {
                  const unread = isMessageUnread(m)
                  const active = selectedMessageId === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openMessage(m.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        m.urgent && unread
                          ? 'border-red-300 bg-red-50/80'
                          : unread
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-slate-200 bg-white'
                      } ${active ? 'ring-2 ring-emerald-500/60' : 'hover:border-slate-300'}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{m.topic || 'Support'}</p>
                        {m.urgent ? (
                          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                            Urgent
                          </span>
                        ) : null}
                        {unread ? (
                          <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                            Unread
                          </span>
                        ) : null}
                        <StatusBadge status={m.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{m.message}</p>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {formatSubmittedLabel(m.created_at)}
                        {m.quote_ref ? (
                          <span className="ml-2 font-mono font-semibold text-brand-700">
                            {m.quote_ref}
                          </span>
                        ) : null}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
                {!selectedMessage ? (
                  <p className="text-sm text-slate-500">Select a message to view details.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <DriverAvatar
                        name={selectedMessage.driver_name}
                        photoUrl={selectedMessage.driver_photo_url}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">
                            {selectedMessage.driver_name || 'Driver'}
                          </h2>
                          {selectedMessage.urgent ? (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Urgent
                            </span>
                          ) : null}
                          {isMessageUnread(selectedMessage) ? (
                            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Unread
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400">Read</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          {selectedMessage.topic || 'Support'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatSubmittedLabel(selectedMessage.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {selectedMessage.message || '—'}
                      </p>
                    </div>

                    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500">Phone</dt>
                        <dd className="text-slate-800">{selectedMessage.driver_phone || '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Email</dt>
                        <dd className="truncate text-slate-800">
                          {selectedMessage.driver_email || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Booking</dt>
                        <dd className="font-mono text-slate-800">
                          {selectedMessage.quote_ref || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Status</dt>
                        <dd>
                          <StatusBadge status={selectedMessage.status} />
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      {selectedMessage.driver_phone ? (
                        <a
                          href={`tel:${String(selectedMessage.driver_phone).replace(/\s+/g, '')}`}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Call driver
                        </a>
                      ) : null}
                      {selectedMessage.driver_email ? (
                        <a
                          href={`mailto:${selectedMessage.driver_email}`}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-500"
                        >
                          Email driver
                        </a>
                      ) : null}
                      {jobHref(selectedMessage) ? (
                        <Link
                          to={jobHref(selectedMessage)}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          View job
                        </Link>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {selectedMessage.status !== 'in_progress' &&
                      selectedMessage.status !== 'resolved' ? (
                        <button
                          type="button"
                          disabled={savingId === selectedMessage.id}
                          onClick={() => void setStatus(selectedMessage.id, 'in_progress')}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
                        >
                          Mark in progress
                        </button>
                      ) : null}
                      {selectedMessage.status !== 'resolved' ? (
                        <button
                          type="button"
                          disabled={savingId === selectedMessage.id}
                          onClick={() => void setStatus(selectedMessage.id, 'resolved')}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          Mark resolved
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={savingId === selectedMessage.id}
                          onClick={() => void setStatus(selectedMessage.id, 'in_progress')}
                          className="inline-flex min-h-[36px] items-center rounded-lg bg-slate-600 px-3 text-xs font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** @deprecated Prefer DriverMessagesAdmin — kept for route aliases. */
export { DriverMessagesAdmin as SupportRequestsAdmin }
