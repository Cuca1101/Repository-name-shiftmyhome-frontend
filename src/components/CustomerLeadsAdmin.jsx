import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import LeadCallButton from './admin/LeadCallButton'
import {
  deleteCustomerLeadById,
  dismissCustomerLeadCallback,
  fetchCustomerLeadsForAdmin,
  purgeCustomerLeadById,
  restoreCustomerLeadById,
} from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS, customerLeadBookingRef } from '../lib/customerLeadStatus'
import {
  customerLeadCallbackDue,
  customerLeadIsConverted,
  customerLeadMoveCountdown,
  customerLeadNeedsFirstCall,
  customerLeadVisibleInList,
} from '../lib/customerLeadList'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { formatGbp, resolveChargeableTotal } from '../lib/adminAgreedPrice'
import {
  convertCustomerLeadToUnpaidJob,
  getCustomerLeadBookingSummary,
  revertCustomerLeadConversion,
} from '../lib/customerLeadBookingConvert'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'to_call', label: 'To call' },
  { id: 'new', label: 'New' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'converted', label: 'Converted' },
  { id: 'trash', label: 'Trash' },
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

function leadIsConverted(row) {
  return customerLeadIsConverted(row)
}

function CallBadge({ row, now }) {
  if (customerLeadCallbackDue(row, now)) {
    return (
      <span className="inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
        Call now
      </span>
    )
  }
  if (customerLeadNeedsFirstCall(row, now)) {
    return (
      <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300">
        To call
      </span>
    )
  }
  const callbackAt = Date.parse(String(row.callback_at || ''))
  if (Number.isFinite(callbackAt) && callbackAt > now) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
        Call {formatDateTimeUK(row.callback_at)}
      </span>
    )
  }
  if (row.called_at) {
    const by = String(row.called_by || '').trim()
    return (
      <span
        className="inline-flex max-w-[14rem] flex-col items-start rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
        title={by ? `Called by ${by}` : 'Called'}
      >
        <span>Called</span>
        {by ? <span className="max-w-full truncate font-medium">{by}</span> : null}
      </span>
    )
  }
  return null
}

function MoveCountdownBadge({ moveDate }) {
  const badge = customerLeadMoveCountdown(moveDate)
  if (!badge) return null
  const tone =
    badge.tone === 'expired'
      ? 'bg-red-100 text-red-800 ring-red-200'
      : badge.highlight
        ? 'bg-amber-100 text-amber-950 ring-amber-300'
        : 'bg-slate-100 text-slate-700 ring-slate-200/80'
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {badge.label}
    </span>
  )
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

function postcodeFromText(value) {
  const found = String(value || '').toUpperCase().match(/([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/)
  return found ? `${found[1]} ${found[2]}` : ''
}

function leadRoutePostcodes(row) {
  const step1 =
    row?.wizard_data?.step1 && typeof row.wizard_data.step1 === 'object' ? row.wizard_data.step1 : {}
  const label = String(row?.route_label || '').trim()
  const parts = label.split(/\s*(?:→|->)\s*/)
  const pickup =
    postcodeFromText(step1.pickupPostcode) ||
    postcodeFromText(row?.pickup_address) ||
    postcodeFromText(parts[0])
  const delivery =
    postcodeFromText(step1.deliveryPostcode) ||
    postcodeFromText(row?.delivery_address) ||
    postcodeFromText(parts[1])
  return { pickup, delivery }
}

function LeadRoute({ row }) {
  const { pickup, delivery } = leadRoutePostcodes(row)
  if (!pickup && !delivery) return '—'
  return (
    <div className="whitespace-nowrap font-medium leading-snug tabular-nums">
      {pickup ? <p>{pickup}</p> : null}
      {delivery ? <p className="text-slate-600">{delivery}</p> : null}
    </div>
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${v.toFixed(2)}`
}

function customerOfferView(offer, pendingFlag) {
  const status = String(offer?.status || '')
  const accepted = status === 'accepted' || status === 'counter_accepted'
  const pending = status === 'pending' || status === 'countered' || (!offer && Boolean(pendingFlag))
  const amount = accepted ? offer?.agreed_amount ?? offer?.proposed_amount : offer?.proposed_amount
  return { accepted, pending, amount, status }
}

function mailHref(email) {
  const e = String(email || '').trim()
  return e ? `mailto:${e}` : null
}

const MENU_WIDTH = 208

/** Sticky paired horizontal scrollbar — stays visible while the page scrolls vertically. */
function LeadsHorizontalScrollbar({ scrollRef, placement }) {
  const trackRef = useRef(null)
  const metricsRef = useRef({ left: 0, width: 48, maxLeft: 0, range: 0 })
  const [metrics, setMetrics] = useState({ left: 0, width: 48, visible: true, value: 0, max: 0 })
  const isTop = placement === 'top'

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

  return (
    <div
      className={`leads-h-scroll ${isTop ? 'sticky top-14 z-20 sm:top-16' : 'sticky bottom-0 z-20'}`}
    >
      <div
        ref={trackRef}
        role="scrollbar"
        aria-label={isTop ? 'Scroll customer leads horizontally (top)' : 'Scroll customer leads horizontally (bottom)'}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={Math.round(metrics.max)}
        aria-valuenow={Math.round(metrics.value)}
        aria-controls="customer-leads-table"
        tabIndex={metrics.visible ? 0 : -1}
        onPointerDown={onPointerDown}
        className={`relative touch-none bg-blue-100 shadow-sm ${
          isTop ? 'border-b border-blue-300' : 'border-t border-blue-300'
        } ${metrics.visible ? 'h-5 cursor-pointer' : 'hidden'}`}
      >
        <div
          className="pointer-events-none absolute left-0 top-1 h-3 rounded-full bg-blue-600"
          style={{ width: metrics.width, transform: `translateX(${metrics.left}px)` }}
        />
      </div>
    </div>
  )
}

function LeadActionsMenu({
  open,
  onOpenChange,
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
  trashed,
  busyPurge,
  onConvert,
  onRevert,
  onDelete,
  onRestore,
  onPurge,
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
    // Close only if the trigger left the viewport — menu is portaled to body
    // so it can open below the table card without staying inside that box.
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return false
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
  }, [])

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
              zIndex: 9999,
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
            {trashed ? null : converted ? (
              <button
                type="button"
                role="menuitem"
                disabled={revertDisabled}
                title="Undo convert — restore lead and remove admin-created job from Available Jobs"
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
                title="Convert this lead to a booking in Available Jobs"
                className={`${itemClass} text-emerald-900 hover:bg-emerald-50`}
                onClick={() => choose(onConvert)}
              >
                {busyConvert ? 'Converting…' : 'Convert'}
              </button>
            )}
            <div className="my-1 h-px bg-slate-100" role="separator" />
            {trashed ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleteDisabled}
                  className={`${itemClass} text-emerald-900 hover:bg-emerald-50`}
                  onClick={() => choose(onRestore)}
                >
                  {busyDelete ? 'Restoring…' : 'Restore'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleteDisabled || busyPurge}
                  className={`${itemClass} text-red-800 hover:bg-red-50`}
                  onClick={() => choose(onPurge)}
                >
                  {busyPurge ? 'Deleting…' : 'Delete permanently'}
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={deleteDisabled}
                className={`${itemClass} text-red-800 hover:bg-red-50`}
                onClick={() => choose(onDelete)}
              >
                {busyDelete ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>,
          document.body,
        )
      : null

  const triggerBusy = busyConvert || busyRevert || busyDelete || busyPurge

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
        {busyPurge
          ? 'Deleting…'
          : busyConvert
            ? 'Creating…'
            : busyRevert
              ? 'Undoing…'
              : busyDelete
                ? trashed
                  ? 'Restoring…'
                  : 'Deleting…'
                : 'Actions'}
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
  const [listNow, setListNow] = useState(() => Date.now())
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkPurging, setBulkPurging] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [purgingId, setPurgingId] = useState('')
  const [convertingId, setConvertingId] = useState('')
  const [revertingId, setRevertingId] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [callDismissingId, setCallDismissingId] = useState('')
  const [openActionsId, setOpenActionsId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Always load the full search result so filter tabs can show live counts.
      const list = await fetchCustomerLeadsForAdmin({ filter: 'all', search: activeSearch })
      setAllRows(list)
    } catch (e) {
      setError(e?.message || 'Failed to load customer leads.')
    } finally {
      setLoading(false)
    }
  }, [activeSearch])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setListNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const handleDeleteLead = useCallback(
    async (row) => {
      const ref = customerLeadBookingRef(row) || row.lead_ref || 'this lead'
      const eff = row.effective_status || row.status
      const isConverted = eff === 'converted_to_booking'
      const msg = isConverted
        ? `Move lead ${ref} to Trash? The booking (${row.quote_ref || 'linked record'}) stays in Available Jobs or Active Jobs. You can restore this lead from Trash.`
        : `Move lead ${ref} to Trash? You can restore it later. The booking, if one exists, stays in the system.`
      if (!window.confirm(msg)) return

      setDeletingId(String(row.id))
      setError('')
      setActionMsg('')
      try {
        const updated = await deleteCustomerLeadById(String(row.id))
        setAllRows((prev) =>
          prev.map((r) => (String(r.id) === String(row.id) ? { ...r, ...updated } : r)),
        )
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(String(row.id))
          return next
        })
        setActionMsg(`Moved ${ref} to Trash.`)
      } catch (e) {
        setError(e?.message || 'Failed to delete lead.')
      } finally {
        setDeletingId('')
      }
    },
    [],
  )

  const handleRestoreLead = useCallback(async (row) => {
    const ref = customerLeadBookingRef(row) || row.lead_ref || 'this lead'
    setDeletingId(String(row.id))
    setError('')
    setActionMsg('')
    try {
      const updated = await restoreCustomerLeadById(String(row.id))
      setAllRows((prev) => prev.map((r) => (String(r.id) === String(row.id) ? { ...r, ...updated } : r)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(String(row.id))
        return next
      })
      setActionMsg(`Restored ${ref}.`)
    } catch (e) {
      setError(e?.message || 'Failed to restore lead.')
    } finally {
      setDeletingId('')
    }
  }, [])

  const handlePurgeLead = useCallback(async (row) => {
    const ref = customerLeadBookingRef(row) || row.lead_ref || 'this lead'
    const ok = window.confirm(
      `Delete ${ref} permanently? It leaves Trash and cannot be restored. A linked booking stays in Available Jobs or Active Jobs.`,
    )
    if (!ok) return

    setPurgingId(String(row.id))
    setError('')
    setActionMsg('')
    try {
      await purgeCustomerLeadById(String(row.id))
      setAllRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(String(row.id))
        return next
      })
      setActionMsg(`Deleted ${ref} permanently.`)
    } catch (e) {
      setError(e?.message || 'Failed to delete lead permanently.')
    } finally {
      setPurgingId('')
    }
  }, [])

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
          `Lead ${customerLeadBookingRef(row) || row.lead_ref || ''} is missing pickup/delivery address. Open Details to check what was captured.`,
        )
        return
      }

      const ok = window.confirm(
        [
          `Convert lead ${customerLeadBookingRef(row) || row.lead_ref || ''} to a booking?`,
          '',
          `Pickup: ${summary.pickupAddress}`,
          `Delivery: ${summary.deliveryAddress}`,
          `Price: ${formatGbp(chargeable)}`,
          '',
          'Uses the saved lead details — you do not need to re-enter addresses.',
          'The booking appears in Available Jobs.',
          'Payment status is left as recorded. This does not mark an unpaid booking as paid.',
          'The lead is marked Converted. You can Undo convert later if the job is still unassigned.',
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
          `Booking ${result.quoteRef} created at £${Number(resolveChargeableTotal(row) || 0).toFixed(2)} and sent to Available Jobs. Payment status was left as recorded. Lead marked Converted.`,
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
          `Undo convert for ${customerLeadBookingRef(row) || row.lead_ref || 'this lead'}?`,
          '',
          'Restores the lead as before (not converted).',
          'Removes the admin-created job from Available Jobs (only if still unassigned, not card-paid).',
        ].join('\n'),
      )
      if (!ok) return

      setRevertingId(String(row.id))
      try {
        const result = await revertCustomerLeadConversion({ lead: row })
        setActionMsg(
          `Lead restored to ${CUSTOMER_LEAD_STATUS_LABELS[result.previousStatus] || result.previousStatus}.` +
            (result.quoteDeleted
              ? ' Job removed.'
              : result.quoteCancelled
                ? ' Job cancelled and removed from Available Jobs.'
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

  const filterCounts = useMemo(() => {
    const counts = { all: 0, to_call: 0, new: 0, abandoned: 0, converted: 0, trash: 0 }
    for (const row of allRows) {
      for (const item of FILTERS) {
        if (customerLeadVisibleInList(row, item.id, listNow)) counts[item.id] += 1
      }
    }
    return counts
  }, [allRows, listNow])

  const rows = useMemo(
    () => allRows.filter((row) => customerLeadVisibleInList(row, filter, listNow)),
    [allRows, filter, listNow],
  )

  const dueCalls = useMemo(
    () => allRows.filter((row) => customerLeadVisibleInList(row, 'all', listNow) && customerLeadCallbackDue(row, listNow)),
    [allRows, listNow],
  )

  const dismissCallback = useCallback(async (id) => {
    setCallDismissingId(id)
    setError('')
    try {
      const updated = await dismissCustomerLeadCallback(id)
      setAllRows((prev) => prev.map((row) => (String(row.id) === id ? { ...row, ...updated } : row)))
      setActionMsg('Callback notice closed.')
    } catch (e) {
      setError(e?.message || 'Failed to close the callback notice.')
    } finally {
      setCallDismissingId('')
    }
  }, [])

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
    const restoring = filter === 'trash'
    const ok = window.confirm(
      restoring
        ? `Restore ${ids.length} selected lead${ids.length === 1 ? '' : 's'}?`
        : `Move ${ids.length} selected lead${ids.length === 1 ? '' : 's'} to Trash? Linked bookings stay in the system.`,
    )
    if (!ok) return

    setBulkDeleting(true)
    setError('')
    setActionMsg('')
    const done = []
    let failed = 0
    for (const id of ids) {
      try {
        const updated = restoring ? await restoreCustomerLeadById(id) : await deleteCustomerLeadById(id)
        done.push({ id, updated })
      } catch {
        failed += 1
      }
    }
    const doneById = new Map(done.map((item) => [item.id, item.updated]))
    setAllRows((prev) => prev.map((row) => (doneById.has(String(row.id)) ? { ...row, ...doneById.get(String(row.id)) } : row)))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      done.forEach((item) => next.delete(item.id))
      return next
    })
    if (failed) {
      setError(
        restoring
          ? `Could not restore ${failed} lead${failed === 1 ? '' : 's'}.`
          : `Could not delete ${failed} lead${failed === 1 ? '' : 's'}.`,
      )
    }
    if (done.length) {
      setActionMsg(
        restoring
          ? `Restored ${done.length} lead${done.length === 1 ? '' : 's'}.`
          : `Moved ${done.length} lead${done.length === 1 ? '' : 's'} to Trash.`,
      )
    }
    setBulkDeleting(false)
  }, [bulkDeleting, filter, selectedIds, visibleIds])

  const handlePurgeSelected = useCallback(async () => {
    const ids = visibleIds.filter((id) => selectedIds.has(id))
    if (!ids.length || bulkPurging || filter !== 'trash') return
    const ok = window.confirm(
      `Delete ${ids.length} selected lead${ids.length === 1 ? '' : 's'} permanently? They leave Trash and cannot be restored. Linked bookings stay in the system.`,
    )
    if (!ok) return

    setBulkPurging(true)
    setError('')
    setActionMsg('')
    const done = []
    let failed = 0
    for (const id of ids) {
      try {
        await purgeCustomerLeadById(id)
        done.push(id)
      } catch {
        failed += 1
      }
    }
    const removed = new Set(done)
    setAllRows((prev) => prev.filter((row) => !removed.has(String(row.id))))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      done.forEach((id) => next.delete(id))
      return next
    })
    if (failed) setError(`Could not delete ${failed} lead${failed === 1 ? '' : 's'} permanently.`)
    if (done.length) {
      setActionMsg(`Deleted ${done.length} lead${done.length === 1 ? '' : 's'} permanently.`)
    }
    setBulkPurging(false)
  }, [bulkPurging, filter, selectedIds, visibleIds])

  const selectAllRef = useRef(null)
  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected
  }, [selectedVisibleCount, allVisibleSelected])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    if (activeSearch) return 'No leads found.'
    if (filter === 'trash') return 'Trash is empty.'
    if (filter === 'converted') return 'No converted leads from the last 12 hours.'
    if (filter === 'to_call') return 'No leads to call.'
    return 'No customer leads yet.'
  }, [loading, rows.length, activeSearch, filter])

  const bodyRef = useRef(null)

  useEffect(() => {
    setOpenActionsId('')
  }, [filter, activeSearch, rows])

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Customer Leads{' '}
            <span className="text-lg font-semibold tabular-nums text-slate-500">
              ({loading ? '…' : filterCounts[filter] ?? 0})
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Quote wizard and homepage enquiries saved before payment — reference format{' '}
            <code className="rounded bg-slate-100 px-1">SMH-LEAD-000001</code>. Convert sends the
            saved lead to Available Jobs and leaves the payment status as recorded. Undo convert puts
            the lead back if the job is still unassigned. Converted leads stay in this list for 12
            hours, then leave Customer Leads. The booking stays in Available Jobs or Active Jobs.
            Delete moves a lead to Trash. In Trash, Delete permanently removes it for good.
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
        {FILTERS.map((f) => {
          const count = filterCounts[f.id] ?? 0
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition ${
                active
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {loading ? '…' : count}
              </span>
            </button>
          )
        })}
      </div>

      {dueCalls.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-950">Time to call</p>
          {dueCalls.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-emerald-950">
              <p className="min-w-0">
                <Link to={`/admin/customer-leads/${row.id}`} className="font-mono font-semibold hover:underline">
                  {customerLeadBookingRef(row) || row.lead_ref}
                </Link>
                {' · '}
                {formatDateTimeUK(row.callback_at)}
                {row.called_by ? ` · marked by ${row.called_by}` : ''}
                {row.call_note ? ` · ${row.call_note}` : ''}
              </p>
              <button
                type="button"
                disabled={callDismissingId === String(row.id)}
                onClick={() => void dismissCallback(String(row.id))}
                className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Close notice
              </button>
            </div>
          ))}
        </div>
      ) : null}

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
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-1.5 ${
            filter === 'trash' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className={`text-sm font-semibold ${filter === 'trash' ? 'text-emerald-950' : 'text-red-900'}`}>
            {selectedVisibleCount} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkDeleting || bulkPurging}
              onClick={() => void handleDeleteSelected()}
              className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                filter === 'trash' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'
              }`}
            >
              {bulkDeleting
                ? filter === 'trash'
                  ? 'Restoring…'
                  : 'Deleting…'
                : filter === 'trash'
                  ? 'Restore selected'
                  : 'Delete selected'}
            </button>
            {filter === 'trash' ? (
              <button
                type="button"
                disabled={bulkDeleting || bulkPurging}
                onClick={() => void handlePurgeSelected()}
                className="min-h-[40px] rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {bulkPurging ? 'Deleting…' : 'Delete permanently'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-slate-500">Loading…</p>
      ) : emptyMessage ? (
        <p className="py-8 text-center text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="leads-screen-fit relative w-full min-w-0 max-w-full">
          <LeadsHorizontalScrollbar scrollRef={bodyRef} placement="top" />
          <div
            ref={bodyRef}
            id="customer-leads-table"
            className="leads-table-scroll w-full min-w-0 max-w-full overflow-x-auto"
          >
            <table className="w-full border-collapse text-left text-sm [&_td]:border [&_td]:border-blue-200/80 [&_th]:border [&_th]:border-blue-300">
              <colgroup>
                <col className="leads-col-check" />
                <col className="leads-col-ref" />
                <col className="leads-col-name" />
                <col className="leads-col-phone" />
                <col className="leads-col-email" />
                <col className="leads-col-service" />
                <col className="leads-col-postcode" />
                <col className="leads-col-price" />
                <col className="leads-col-agreed" />
                <col className="leads-col-offer" />
                <col className="leads-col-status" />
                <col className="leads-col-activity" />
                <col className="leads-col-created" />
                <col className="leads-col-actions" />
              </colgroup>
              <thead className="bg-blue-50 text-xs font-semibold uppercase tracking-wide text-blue-900">
                <tr>
                  <th className="w-px px-2 py-2.5">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all leads on this page"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Reference</th>
                  <th className="w-36 whitespace-nowrap px-3 py-2.5">Name</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Phone</th>
                  <th className="w-full px-3 py-2.5">Email</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-[10px]">Service</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Postcode</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Quote price</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Agreed</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Customer offer</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-[10px]">Last activity</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-[10px]">Created</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowId = String(row.id)
                  const selected = selectedIds.has(rowId)
                  const eff = row.effective_status || row.status
                  const converted = leadIsConverted(row)
                  const trashed = Boolean(row.deleted_at)
                  const countdown = converted ? null : customerLeadMoveCountdown(row.move_date)
                  const phone = row.customer_phone
                  const email = row.customer_email
                  const emailHref = mailHref(email)
                  const busyConvert = convertingId === String(row.id)
                  const busyRevert = revertingId === String(row.id)
                  const zebra = index % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'
                  const urgentBg =
                    countdown?.tone === 'expired' ? 'bg-red-50' : countdown?.highlight ? 'bg-amber-50' : zebra
                  const rowBg = selected ? 'bg-red-50' : urgentBg
                  const edge =
                    countdown?.tone === 'expired'
                      ? 'shadow-[inset_4px_0_0_0_#dc2626]'
                      : countdown?.highlight
                        ? 'shadow-[inset_4px_0_0_0_#d97706]'
                        : ''

                  return (
                    <tr key={row.id} className={`align-middle text-slate-800 ${rowBg} ${edge} hover:bg-blue-50`}>
                      <td className="w-px px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleOne(rowId)}
                          aria-label={`Select ${row.lead_ref || 'lead'}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="w-px px-3 py-2 align-top">
                        <Link
                          to={`/admin/customer-leads/${row.id}`}
                          className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 hover:underline"
                          title={
                            row.quote_ref && row.lead_ref && row.quote_ref !== row.lead_ref
                              ? `Booking ref (same as quote). Internal lead id: ${row.lead_ref}`
                              : undefined
                          }
                        >
                          {customerLeadBookingRef(row) || '—'}
                        </Link>
                        {row.move_date ? (
                          <p className="mt-1 text-[11px] font-semibold text-slate-600">{formatDateUK(row.move_date)}</p>
                        ) : null}
                        {countdown || customerLeadCallbackDue(row, listNow) || customerLeadNeedsFirstCall(row, listNow) || row.called_at || row.callback_at ? (
                          <div className="mt-1 flex flex-col items-start gap-1">
                            {countdown ? <MoveCountdownBadge moveDate={row.move_date} /> : null}
                            <CallBadge row={row} now={listNow} />
                          </div>
                        ) : null}
                      </td>
                      <td className="w-px px-3 py-2">
                        <p
                          className="min-w-0 whitespace-normal break-words leading-snug"
                          title={row.customer_name || undefined}
                        >
                          {row.customer_name || '—'}
                        </p>
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-2">
                        <LeadCallButton phone={phone || ''} compact />
                      </td>
                      <td className="min-w-0 max-w-0 truncate px-3 py-2 lg:max-w-none" title={email || undefined}>
                        {email || '—'}
                      </td>
                      <td className="w-px px-2 py-2 text-[11px] leading-tight text-slate-700">{row.service_type || '—'}</td>
                      <td className="w-px px-3 py-2 align-top">
                        <LeadRoute row={row} />
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-2 tabular-nums">{money(row.estimated_total)}</td>
                      <td className="w-px whitespace-nowrap px-3 py-2 tabular-nums">
                        {row.agreed_price != null ? (
                          <span className={`font-semibold ${customerOfferView(row.customer_offer, row.pending_offer).accepted ? 'text-emerald-700' : 'text-brand-800'}`}>
                            {money(row.agreed_price)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="w-px px-2 py-2">
                        {(() => {
                          const offer = customerOfferView(row.customer_offer, row.pending_offer)
                          if (!row.customer_offer && !offer.pending) return '—'
                          return (
                            <span className="inline-flex flex-col items-start gap-1">
                              {offer.amount != null ? (
                                <span
                                  className={`font-semibold tabular-nums ${
                                    offer.accepted ? 'text-emerald-700' : offer.pending ? 'text-amber-950' : 'text-slate-800'
                                  }`}
                                >
                                  {money(offer.amount)}
                                </span>
                              ) : null}
                              {offer.pending ? (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                                  Pending offer
                                </span>
                              ) : null}
                              {offer.accepted ? (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                                  Offer accepted
                                </span>
                              ) : null}
                              {!offer.pending && !offer.accepted && offer.status ? (
                                <span className="text-[11px] capitalize text-slate-500">
                                  {offer.status.replaceAll('_', ' ')}
                                </span>
                              ) : null}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-2">
                        <StatusBadge status={eff} />
                        {trashed ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Deleted {formatDateTimeUK(row.deleted_at)}
                          </p>
                        ) : null}
                      </td>
                      <td className="w-px px-1.5 py-2 text-[10px] leading-tight text-slate-600" title={formatDateTimeUK(row.last_activity_at)}>
                        {formatDateTimeUK(row.last_activity_at)}
                      </td>
                      <td className="w-px px-1.5 py-2 text-[10px] leading-tight text-slate-500" title={formatDateTimeUK(row.created_at)}>
                        {formatDateTimeUK(row.created_at)}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                        <LeadActionsMenu
                          open={openActionsId === rowId}
                          onOpenChange={(next) => setOpenActionsId(next ? rowId : '')}
                          leadRef={row.lead_ref}
                          emailHref={emailHref}
                          detailsTo={`/admin/customer-leads/${row.id}`}
                          converted={converted}
                          busyConvert={busyConvert}
                          busyRevert={busyRevert}
                          busyDelete={deletingId === rowId}
                          convertDisabled={busyConvert || Boolean(convertingId) || Boolean(revertingId)}
                          revertDisabled={busyRevert || Boolean(convertingId) || Boolean(revertingId)}
                          deleteDisabled={bulkDeleting || bulkPurging || deletingId === rowId || purgingId === rowId}
                          trashed={trashed}
                          busyPurge={purgingId === rowId}
                          onConvert={() => void handleConvertLead(row)}
                          onRevert={() => void handleRevertLead(row)}
                          onDelete={() => handleDeleteLead(row)}
                          onRestore={() => void handleRestoreLead(row)}
                          onPurge={() => void handlePurgeLead(row)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <LeadsHorizontalScrollbar scrollRef={bodyRef} placement="bottom" />
        </div>
      )}
    </div>
  )
}
