import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import LeadCallButton from './admin/LeadCallButton'
import {
  deleteCustomerLeadById,
  fetchCustomerLeadsForAdmin,
} from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS } from '../lib/customerLeadStatus'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import { formatGbp, resolveChargeableTotal } from '../lib/adminAgreedPrice'
import {
  convertCustomerLeadToUnpaidJob,
  getCustomerLeadBookingSummary,
  revertCustomerLeadConversion,
} from '../lib/customerLeadBookingConvert'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'converted', label: 'Converted' },
]

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200/80',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200/80',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
}

function statusTone(status) {
  if (status === 'converted_to_booking') return 'green'
  if (status === 'abandoned') return 'orange'
  if (status === 'payment_started') return 'violet'
  if (status === 'quote_viewed') return 'blue'
  if (status === 'quote_started') return 'amber'
  return 'slate'
}

/** True when lead was converted to an unpaid job (status and/or converted_at). */
function leadIsConverted(row) {
  if (!row) return false
  const st = String(row.status || '')
  const eff = String(row.effective_status || st)
  if (st === 'converted_to_booking' || eff === 'converted_to_booking') return true
  if (row.converted_at) return true
  return false
}

function StatusBadge({ status }) {
  const tone = BADGE_TONES[statusTone(status)] || BADGE_TONES.slate
  const label = CUSTOMER_LEAD_STATUS_LABELS[status] || status
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${v.toFixed(2)}`
}

function mailHref(email) {
  const e = String(email || '').trim()
  return e ? `mailto:${e}` : null
}

const MENU_WIDTH = 208

function TopTableScrollbar({ scrollRef }) {
  const trackRef = useRef(null)
  const metricsRef = useRef({ left: 0, width: 48, maxLeft: 0, range: 0 })
  const [metrics, setMetrics] = useState({ left: 0, width: 48, visible: true, value: 0, max: 0 })

  const publish = useCallback(() => {
    const body = scrollRef.current
    const track = trackRef.current
    if (!body || !track) return
    const range = Math.max(0, body.scrollWidth - body.clientWidth)
    const visible = range > 1
    const trackWidth = track.clientWidth || 0
    const width = visible ? Math.max(48, trackWidth > 0 ? (body.clientWidth / body.scrollWidth) * trackWidth : 48) : 48
    const maxLeft = Math.max(0, trackWidth - width)
    const left = visible && range > 0 && maxLeft > 0 ? (body.scrollLeft / range) * maxLeft : 0
    metricsRef.current = { left, width, maxLeft, range }
    setMetrics((prev) => {
      if (
        prev.visible === visible &&
        Math.abs(prev.max - range) < 0.5 &&
        Math.abs(prev.left - left) < 0.5 &&
        Math.abs(prev.width - width) < 0.5 &&
        Math.abs(prev.value - body.scrollLeft) < 0.5
      ) {
        return prev
      }
      return { left, width, visible, value: body.scrollLeft, max: range }
    })
  }, [scrollRef])

  useEffect(() => {
    const body = scrollRef.current
    if (!body) return undefined
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(body)
    const table = body.querySelector('table')
    if (table) observer.observe(table)
    if (trackRef.current) observer.observe(trackRef.current)
    body.addEventListener('scroll', publish, { passive: true })
    window.addEventListener('resize', publish)
    return () => {
      observer.disconnect()
      body.removeEventListener('scroll', publish)
      window.removeEventListener('resize', publish)
    }
  }, [publish, scrollRef])

  function scrollToThumbLeft(nextLeft) {
    const body = scrollRef.current
    const { maxLeft, range } = metricsRef.current
    if (!body || maxLeft <= 0 || range <= 0) return
    const left = Math.max(0, Math.min(maxLeft, nextLeft))
    body.scrollLeft = (left / maxLeft) * range
  }

  function onPointerDown(event) {
    if (!metricsRef.current.range) return
    const track = trackRef.current
    if (!track) return
    event.preventDefault()
    const { left, width } = metricsRef.current
    const pointer = event.clientX - track.getBoundingClientRect().left
    const onThumb = pointer >= left && pointer <= left + width
    const startX = event.clientX
    const startLeft = onThumb ? left : pointer - width / 2
    if (!onThumb) scrollToThumbLeft(startLeft)
    track.setPointerCapture?.(event.pointerId)

    function onMove(ev) {
      scrollToThumbLeft(startLeft + (ev.clientX - startX))
    }
    function onUp() {
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
    }
    track.addEventListener('pointermove', onMove)
    track.addEventListener('pointerup', onUp)
  }

  function onKeyDown(event) {
    const body = scrollRef.current
    if (!body) return
    const page = Math.max(80, body.clientWidth * 0.8)
    let next = null
    if (event.key === 'ArrowRight') next = body.scrollLeft + 60
    else if (event.key === 'ArrowLeft') next = body.scrollLeft - 60
    else if (event.key === 'PageDown') next = body.scrollLeft + page
    else if (event.key === 'PageUp') next = body.scrollLeft - page
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = body.scrollWidth
    if (next == null) return
    event.preventDefault()
    body.scrollLeft = next
  }

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-label="Scroll customer leads horizontally"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(metrics.max)}
      aria-valuenow={Math.round(metrics.value)}
      aria-controls="customer-leads-table"
      tabIndex={metrics.visible ? 0 : -1}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`relative touch-none border-b border-slate-200 bg-slate-200 ${
        metrics.visible ? 'h-6 cursor-pointer sm:h-4' : 'hidden'
      }`}
    >
      <div
        className="pointer-events-none absolute left-0 top-1 h-4 rounded-full bg-slate-500 sm:top-0.5 sm:h-3"
        style={{ width: metrics.width, transform: `translateX(${metrics.left}px)` }}
      />
    </div>
  )
}

function LeadActionsMenu({
  open,
  onOpenChange,
  scrollParentRef,
  leadRef,
  emailHref,
  detailsTo,
  converted,
  busyConvert,
  busyRevert,
  busyDelete,
  convertDisabled,
  revertDisabled,
  deleteDisabled,
  onConvert,
  onRevert,
  onDelete,
}) {
  const navigate = useNavigate()
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const pressingMenuRef = useRef(false)
  const [coords, setCoords] = useState(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return false
    const rect = button.getBoundingClientRect()
    const parent = scrollParentRef?.current
    if (parent) {
      const bounds = parent.getBoundingClientRect()
      const hidden =
        rect.bottom <= bounds.top + 1 ||
        rect.top >= bounds.bottom - 1 ||
        rect.right <= bounds.left + 1 ||
        rect.left >= bounds.right - 1
      if (hidden) return false
    }
    const menuHeight = menuRef.current?.offsetHeight || 188
    let left = rect.right - MENU_WIDTH
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
    let top = rect.bottom + 4
    if (top + menuHeight > window.innerHeight - 8) {
      const above = rect.top - 4 - menuHeight
      if (above >= 8) top = above
    }
    setCoords((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }))
    return true
  }, [scrollParentRef])

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    if (!updatePosition()) onOpenChangeRef.current(false)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : []
      if (path.includes(buttonRef.current) || path.includes(menuRef.current)) return
      const target = event.target
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onOpenChangeRef.current(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') onOpenChangeRef.current(false)
    }
    function onScroll() {
      if (pressingMenuRef.current) return
      if (!updatePosition()) onOpenChangeRef.current(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open, updatePosition])

  function choose(action) {
    onOpenChange(false)
    action()
  }

  const itemClass =
    'flex min-h-11 w-full items-center rounded-md px-2.5 py-2 text-left text-sm font-semibold disabled:opacity-50 sm:min-h-9'

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${leadRef || 'lead'}`}
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? 0,
              width: MENU_WIDTH,
              zIndex: 200,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            onPointerDown={() => {
              pressingMenuRef.current = true
            }}
            onPointerUp={() => {
              pressingMenuRef.current = false
            }}
            onPointerCancel={() => {
              pressingMenuRef.current = false
            }}
          >
            {emailHref ? (
              <a
                role="menuitem"
                href={emailHref}
                className={`${itemClass} text-slate-800 hover:bg-slate-50`}
                onClick={() => onOpenChange(false)}
              >
                Email
              </a>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={`${itemClass} text-brand-800 hover:bg-brand-50`}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                pressingMenuRef.current = true
                onOpenChange(false)
                navigate(detailsTo)
              }}
            >
              Details
            </button>
            {converted ? (
              <button
                type="button"
                role="menuitem"
                disabled={revertDisabled}
                title="Undo convert — restore lead and remove unpaid job from Available Jobs"
                className={`${itemClass} text-amber-950 hover:bg-amber-50`}
                onClick={() => choose(onRevert)}
              >
                {busyRevert ? 'Undoing…' : 'Undo convert'}
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={convertDisabled}
                title="Create unpaid job from saved lead details (no re-typing)"
                className={`${itemClass} text-emerald-900 hover:bg-emerald-50`}
                onClick={() => choose(onConvert)}
              >
                {busyConvert ? 'Creating…' : 'Create job'}
              </button>
            )}
            <div className="my-1 h-px bg-slate-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              disabled={deleteDisabled}
              className={`${itemClass} text-red-800 hover:bg-red-50`}
              onClick={() => choose(onDelete)}
            >
              {busyDelete ? 'Deleting…' : 'Delete'}
            </button>
          </div>,
          document.body,
        )
      : null

  const triggerBusy = busyConvert || busyRevert || busyDelete

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${leadRef || 'lead'}`}
        disabled={triggerBusy}
        onClick={() => onOpenChange(!open)}
        className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:min-h-8"
      >
        {busyConvert ? 'Creating…' : busyRevert ? 'Undoing…' : busyDelete ? 'Deleting…' : 'Actions'}
        <svg
          className={`h-3.5 w-3.5 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {menu}
    </>
  )
}

async function resolveAdminCreatorLabel() {
  if (!isSupabaseConfigured || !supabase) return 'admin'
  try {
    const { data } = await supabase.auth.getSession()
    return String(data.session?.user?.email || '').trim() || 'admin'
  } catch {
    return 'admin'
  }
}

export default function CustomerLeadsAdmin() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [convertingId, setConvertingId] = useState('')
  const [revertingId, setRevertingId] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [openActionsId, setOpenActionsId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchCustomerLeadsForAdmin({ filter, search: activeSearch })
      setRows(list)
    } catch (e) {
      setError(e?.message || 'Failed to load customer leads.')
    } finally {
      setLoading(false)
    }
  }, [filter, activeSearch])

  useEffect(() => {
    load()
  }, [load])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const handleDeleteLead = useCallback(
    async (row) => {
      const ref = row.lead_ref || 'this lead'
      const eff = row.effective_status || row.status
      const isConverted = eff === 'converted_to_booking'
      const msg = isConverted
        ? `Delete lead ${ref}? The booking/quote (${row.quote_ref || 'linked record'}) stays in the system — only this lead row is removed.`
        : `Delete lead ${ref}? This cannot be undone.`
      if (!window.confirm(msg)) return

      setDeletingId(String(row.id))
      setError('')
      setActionMsg('')
      try {
        await deleteCustomerLeadById(String(row.id))
        setRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(String(row.id))
          return next
        })
      } catch (e) {
        setError(e?.message || 'Failed to delete lead.')
      } finally {
        setDeletingId('')
      }
    },
    [],
  )

  const handleConvertLead = useCallback(
    async (row) => {
      setError('')
      setActionMsg('')

      const chargeable = resolveChargeableTotal(row)
      if (chargeable == null || chargeable < 1) {
        navigate(`/admin/customer-leads/${row.id}`)
        return
      }

      const summary = getCustomerLeadBookingSummary(row)
      if (!summary.hasAddresses) {
        setError(
          `Lead ${row.lead_ref || ''} is missing pickup/delivery address. Open Details to check what was captured.`,
        )
        return
      }

      const ok = window.confirm(
        [
          `Create unpaid job from lead ${row.lead_ref || ''}?`,
          '',
          `Pickup: ${summary.pickupAddress}`,
          `Delivery: ${summary.deliveryAddress}`,
          `Price: ${formatGbp(chargeable)} (unpaid — customer pays driver / office)`,
          '',
          'Uses the saved lead details — you do not need to re-enter addresses.',
          'The job will appear in Available Jobs.',
          'You can Undo convert later if the job is still unpaid and unassigned.',
        ].join('\n'),
      )
      if (!ok) return

      setConvertingId(String(row.id))
      try {
        const adminLabel = await resolveAdminCreatorLabel()
        const result = await convertCustomerLeadToUnpaidJob({
          lead: row,
          createdBy: adminLabel,
          releaseToAvailableJobs: true,
        })
        setActionMsg(
          `Job ${result.quoteRef} created unpaid (£${Number(resolveChargeableTotal(row) || 0).toFixed(2)}) and sent to Available Jobs.`,
        )
        await load()
        navigate(`/admin/available-jobs/${encodeURIComponent(result.quoteId)}`)
      } catch (e) {
        setError(e?.message || 'Failed to create job from lead.')
      } finally {
        setConvertingId('')
      }
    },
    [load, navigate],
  )

  const handleRevertLead = useCallback(
    async (row) => {
      setError('')
      setActionMsg('')
      const ok = window.confirm(
        [
          `Undo convert for ${row.lead_ref || 'this lead'}?`,
          '',
          'Restores the lead as before (not converted).',
          'Removes the unpaid job from Available Jobs (only if still unpaid and not assigned).',
        ].join('\n'),
      )
      if (!ok) return

      setRevertingId(String(row.id))
      try {
        const result = await revertCustomerLeadConversion({ lead: row })
        setActionMsg(
          `Lead restored to ${CUSTOMER_LEAD_STATUS_LABELS[result.previousStatus] || result.previousStatus}.` +
            (result.quoteDeleted
              ? ' Unpaid job removed.'
              : result.quoteCancelled
                ? ' Unpaid job cancelled and removed from Available Jobs.'
                : result.quoteUnreleased
                  ? ' Job pulled out of Available Jobs.'
                  : ''),
        )
        await load()
      } catch (e) {
        setError(e?.message || 'Failed to undo convert.')
      } finally {
        setRevertingId('')
      }
    },
    [load],
  )

  const visibleIds = useMemo(() => rows.map((row) => String(row.id)), [rows])
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (visibleIds.length > 0 && visibleIds.every((id) => next.has(id))) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [visibleIds])

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    const ids = visibleIds.filter((id) => selectedIds.has(id))
    if (!ids.length || bulkDeleting) return
    const ok = window.confirm(
      `Delete ${ids.length} selected lead${ids.length === 1 ? '' : 's'}? This cannot be undone. Linked bookings stay in the system.`,
    )
    if (!ok) return

    setBulkDeleting(true)
    setError('')
    setActionMsg('')
    const deleted = []
    let failed = 0
    for (const id of ids) {
      try {
        await deleteCustomerLeadById(id)
        deleted.push(id)
      } catch {
        failed += 1
      }
    }
    const deletedSet = new Set(deleted)
    setRows((prev) => prev.filter((row) => !deletedSet.has(String(row.id))))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      deleted.forEach((id) => next.delete(id))
      return next
    })
    if (failed) {
      setError(`Could not delete ${failed} lead${failed === 1 ? '' : 's'}.`)
    }
    if (deleted.length) {
      setActionMsg(`Deleted ${deleted.length} lead${deleted.length === 1 ? '' : 's'}.`)
    }
    setBulkDeleting(false)
  }, [bulkDeleting, selectedIds, visibleIds])

  const selectAllRef = useRef(null)
  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected
  }, [selectedVisibleCount, allVisibleSelected])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    return activeSearch ? 'No leads found.' : 'No customer leads yet.'
  }, [loading, rows.length, activeSearch])

  const bodyRef = useRef(null)

  useEffect(() => {
    setOpenActionsId('')
  }, [filter, activeSearch, rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Leads</h2>
          <p className="mt-1 text-sm text-slate-600">
            Quote wizard and homepage enquiries saved before payment — reference format{' '}
            <code className="rounded bg-slate-100 px-1">SMH-LEAD-000001</code>. Use Create job for
            unpaid (no card) leads → Available Jobs. Use Undo convert to put the lead back if the
            job is still unpaid and unassigned.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition ${
              filter === f.id
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AdminRecordsSearchRow
        searchInput={searchInput}
        onSearchInputChange={(e) => setSearchInput(e.target.value)}
        onSearchSubmit={runSearchNow}
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800">{error}</p>
      )}
      {actionMsg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900">
          {actionMsg}
        </p>
      ) : null}

      {selectedVisibleCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
          <p className="text-sm font-semibold text-red-900">
            {selectedVisibleCount} selected
          </p>
          <button
            type="button"
            disabled={bulkDeleting}
            onClick={() => void handleDeleteSelected()}
            className="min-h-[40px] rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {bulkDeleting ? 'Deleting…' : 'Delete selected'}
          </button>
        </div>
      ) : null}

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading…</p>
        ) : emptyMessage ? (
          <p className="p-8 text-center text-slate-600">{emptyMessage}</p>
        ) : (
          <>
          <TopTableScrollbar scrollRef={bodyRef} />
          <div
            ref={bodyRef}
            id="customer-leads-table"
            className="leads-table-scroll max-h-[calc(100dvh-13rem)] min-w-0 overflow-auto overscroll-contain"
          >
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 px-3 py-1.5">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all leads on this page"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-1.5">Lead ref</th>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Phone</th>
                  <th className="px-3 py-1.5">Email</th>
                  <th className="px-3 py-1.5">Service</th>
                  <th className="min-w-[160px] px-3 py-1.5">Route</th>
                  <th className="px-3 py-1.5">Quote price</th>
                  <th className="px-3 py-1.5">Agreed</th>
                  <th className="px-3 py-1.5">Status</th>
                  <th className="px-3 py-1.5">Last activity</th>
                  <th className="px-3 py-1.5">Created</th>
                  <th className="w-px whitespace-nowrap px-3 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const rowId = String(row.id)
                  const selected = selectedIds.has(rowId)
                  const eff = row.effective_status || row.status
                  const converted = leadIsConverted(row)
                  const phone = row.customer_phone
                  const email = row.customer_email
                  const emailHref = mailHref(email)
                  const busyConvert = convertingId === String(row.id)
                  const busyRevert = revertingId === String(row.id)
                  const rowBg = selected ? 'bg-red-50' : 'bg-white'

                  return (
                    <tr key={row.id} className={`align-middle text-slate-800 ${selected ? 'bg-red-50' : ''}`}>
                      <td className={`sticky left-0 z-10 px-3 py-1.5 ${rowBg}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleOne(rowId)}
                          aria-label={`Select ${row.lead_ref || 'lead'}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Link
                          to={`/admin/customer-leads/${row.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {row.lead_ref}
                        </Link>
                        {row.quote_ref ? (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{row.quote_ref}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5">{row.customer_name || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <LeadCallButton phone={phone || ''} />
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-1.5" title={email || undefined}>
                        {email || '—'}
                      </td>
                      <td className="px-3 py-1.5">{row.service_type || '—'}</td>
                      <td className="max-w-[200px] truncate px-3 py-1.5" title={row.route_label || undefined}>
                        {row.route_label || '—'}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{money(row.estimated_total)}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {row.agreed_price != null ? (
                          <span className="font-semibold text-brand-800">{money(row.agreed_price)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={eff} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-600">
                        {formatDateTimeUK(row.last_activity_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-500">
                        {formatDateTimeUK(row.created_at)}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-1.5 text-right">
                        <LeadActionsMenu
                          open={openActionsId === rowId}
                          onOpenChange={(next) => setOpenActionsId(next ? rowId : '')}
                          scrollParentRef={bodyRef}
                          leadRef={row.lead_ref}
                          emailHref={emailHref}
                          detailsTo={`/admin/customer-leads/${row.id}`}
                          converted={converted}
                          busyConvert={busyConvert}
                          busyRevert={busyRevert}
                          busyDelete={deletingId === rowId}
                          convertDisabled={busyConvert || Boolean(convertingId) || Boolean(revertingId)}
                          revertDisabled={busyRevert || Boolean(convertingId) || Boolean(revertingId)}
                          deleteDisabled={bulkDeleting || deletingId === rowId}
                          onConvert={() => void handleConvertLead(row)}
                          onRevert={() => void handleRevertLead(row)}
                          onDelete={() => handleDeleteLead(row)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
