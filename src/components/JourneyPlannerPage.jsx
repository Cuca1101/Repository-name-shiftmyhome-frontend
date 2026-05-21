import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchQuotesByIds, fetchQuotesByQuoteRefsFull } from '../lib/data/quotesAdminRepository'
import {
  fetchJourneyWithStops,
  saveJourney,
  sendJourneyToMarketplace,
  updateJourneyRow,
} from '../lib/data/journeysRepository'
import { geocodeAddress, fetchDrivingRouteWaypoints, metersToMiles } from '../lib/mapboxRouteApi'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  buildStopsFromQuotesOrdered,
  computeJourneyTotals,
  formatJourneyDurationHhMm,
  journeyExceedsEightHours,
  sortStopsByMoveDateAndKind,
  sortStopsPickupsFirstAllJobs,
  validatePickupBeforeDeliveryForStops,
} from '../lib/journeyPlannerModel'
import { optimizeStopsGreedyNearest } from '../lib/journeyRouteOptimize'
import {
  buildJourneyMarketplaceTitle,
  buildJourneyRequirementsBadges,
  buildJourneyMoveDateAndRange,
  estimatedWeightKgFromQuotes,
  firstLastPostcodesFromStops,
  isRouteInefficient,
  JOURNEY_VAN_CAPACITY_M3,
  maxVolumeM3FromQuotes,
  straightLineMilesAlongStops,
  sumVolumeM3FromQuotes,
} from '../lib/journeySummary'
import { formatDateUK } from '../lib/formatDateDisplay'
import {
  effectivePlatformReductionPctOfCustomer,
  journeyPlatformProfitGbp,
  suggestJourneyMarketplacePayoutFromQuotes,
  sumQuoteCustomerTotalsGbp,
} from '../lib/journeyFinance'
import { computeMarketplacePayoutFromCustomerTotal } from '../lib/marketplacePayoutMath'
import JourneyRouteMap from './admin-workflow/JourneyRouteMap'
import JourneyPlannerList from './journey-planner/JourneyPlannerList'
import JourneyPlannerHelpPanel from './journey-planner/JourneyPlannerHelpPanel'
import JourneyCompletionGuidance from './journey-planner/JourneyCompletionGuidance'
import JourneyAssignDriverButton from './journey-planner/JourneyAssignDriverButton'
import JourneyRemoveJobModal from './journey-planner/JourneyRemoveJobModal'
import JourneyStopCard from './journey-planner/JourneyStopCard'
import {
  executeRemoveJobFromJourney,
  quotesWithoutQuote,
  stopsWithoutQuote,
} from '../lib/journeyRemoveJob'

const DRAFT_IDS_KEY = 'smh_journey_draft_quote_ids'

/** @param {unknown} vis */
function marketplaceStatusLabel(vis) {
  switch (String(vis || '')) {
    case 'visible_in_marketplace':
      return 'Visible on marketplace'
    case 'hidden_from_partners':
      return 'Hidden from partners (draft)'
    case 'assigned':
      return 'Assigned'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return String(vis || '—')
  }
}

/**
 * @param {Record<string, unknown>} row
 * @returns {import('../lib/journeyPlannerModel.js').JourneyStop}
 */
function dbStopToModel(row) {
  const kind = row.stop_kind === 'delivery' ? 'delivery' : 'pickup'
  const quoteId = row.quote_id != null ? String(row.quote_id) : ''
  return {
    id: String(row.id),
    quoteId,
    kind,
    jobRef: String(row.job_ref || ''),
    address: String(row.address || ''),
    timeWindow: row.time_window != null ? String(row.time_window) : '—',
    customerName: row.customer_name != null ? String(row.customer_name) : '—',
    serviceMinutes: Math.round(Number(row.service_minutes) || 0),
    volumeCrew: row.volume_crew != null ? String(row.volume_crew) : '',
    notes: row.notes != null ? String(row.notes) : '',
    lng: row.lng != null && Number.isFinite(Number(row.lng)) ? Number(row.lng) : null,
    lat: row.lat != null && Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,
  }
}

/**
 * @param {import('../lib/journeyPlannerModel.js').JourneyStop[]} stops
 * @param {string} token
 */
async function geocodeStops(stops, token) {
  if (!token) return stops.map((s) => ({ ...s }))
  const cache = new Map()
  const out = []
  for (const s of stops) {
    const key = String(s.address || '')
      .trim()
      .toLowerCase()
    if (!key || key === '—') {
      out.push({ ...s, lng: null, lat: null })
      continue
    }
    if (cache.has(key)) {
      const c = cache.get(key)
      out.push({ ...s, lng: c?.lng ?? null, lat: c?.lat ?? null })
      continue
    }
    const g = await geocodeAddress(s.address, token)
    cache.set(key, g)
    out.push({ ...s, lng: g?.lng ?? null, lat: g?.lat ?? null })
  }
  return out
}

export default function JourneyPlannerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()

  const journeyIdFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('journey')?.trim() || ''
  }, [location.search])

  const addIdsFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    const raw = sp.get('add')
    if (!raw?.trim()) return []
    return raw
      .split(',')
      .map((x) => decodeURIComponent(x.trim()))
      .filter(Boolean)
  }, [location.search])

  const stateIdsJson = useMemo(
    () => (Array.isArray(location.state?.quoteIds) ? JSON.stringify(location.state.quoteIds) : ''),
    [location.state],
  )

  const selectedQuoteIds = useMemo(() => {
    if (journeyIdFromUrl) return []
    const fromState = location.state?.quoteIds
    if (Array.isArray(fromState) && fromState.length > 0) {
      return fromState.map(String).filter(Boolean)
    }
    const sp = new URLSearchParams(location.search).get('ids')
    if (sp?.trim()) return sp.split(',').map((x) => x.trim()).filter(Boolean)
    try {
      const raw = sessionStorage.getItem(DRAFT_IDS_KEY)
      const p = raw ? JSON.parse(raw) : null
      if (Array.isArray(p) && p.length > 0) return p.map(String).filter(Boolean)
    } catch {
      /* ignore */
    }
    return []
  }, [location.search, stateIdsJson, journeyIdFromUrl])

  const idsKey = selectedQuoteIds.join(',')
  const loadContextKey = `${journeyIdFromUrl}|${idsKey}`

  const [quotes, setQuotes] = useState([])
  const [stops, setStops] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [routeGeometry, setRouteGeometry] = useState(null)
  const [totalDriveSeconds, setTotalDriveSeconds] = useState(0)
  const [totalMiles, setTotalMiles] = useState(0)
  const [routingErr, setRoutingErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveMsgIsError, setSaveMsgIsError] = useState(false)
  const [savedJourneyId, setSavedJourneyId] = useState('')
  const [journeyRefDisplay, setJourneyRefDisplay] = useState('')
  const [marketplaceListed, setMarketplaceListed] = useState(false)
  const [journeyPayoutInput, setJourneyPayoutInput] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(true)
  const [sendingMarketplace, setSendingMarketplace] = useState(false)
  const [summaryTitleOverride, setSummaryTitleOverride] = useState('')
  const [journeyRecord, setJourneyRecord] = useState(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [scheduleOrderWarning, setScheduleOrderWarning] = useState('')
  const [scheduleOptimizing, setScheduleOptimizing] = useState(false)
  const [draggingStopIndex, setDraggingStopIndex] = useState(null)
  const [expandedStopIds, setExpandedStopIds] = useState(() => new Set())
  const [removingJob, setRemovingJob] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(
    /** @type {{ quoteId: string, jobRef: string, customerName: string } | null} */ (null),
  )
  const [payoutManuallySet, setPayoutManuallySet] = useState(false)
  const [adjustPriceOpen, setAdjustPriceOpen] = useState(false)
  const [adjustDraft, setAdjustDraft] = useState('')
  const [adjustPctDraft, setAdjustPctDraft] = useState('')
  const baselineCapturedForKey = useRef('')
  const originalStopsBaselineRef = useRef(
    /** @type {import('../lib/journeyPlannerModel.js').JourneyStop[] | null} */ (null),
  )

  const applyRouteForStops = useCallback(
    async (stopList) => {
      setRoutingErr('')
      setRouteGeometry(null)
      setTotalDriveSeconds(0)
      setTotalMiles(0)
      if (!stopList.length) return
      setStops(stopList)
      const geo = await geocodeStops(stopList, token)
      setStops(geo)
      const coords = geo
        .map((s) => ({ lng: s.lng, lat: s.lat }))
        .filter((c) => c.lng != null && c.lat != null && Number.isFinite(c.lng) && Number.isFinite(c.lat))
      if (coords.length < 2) {
        setRoutingErr('Need at least two geocoded addresses to draw a road route.')
        return
      }
      if (!token) {
        setRoutingErr('Add VITE_MAPBOX_TOKEN for driving times and map route.')
        return
      }
      const route = await fetchDrivingRouteWaypoints(coords, token)
      if (!route) {
        setRoutingErr('Could not fetch driving route from Mapbox.')
        return
      }
      setRouteGeometry(route.geometry?.type === 'LineString' ? route.geometry : null)
      setTotalDriveSeconds(route.durationSeconds || 0)
      setTotalMiles(metersToMiles(route.distanceMeters || 0))
    },
    [token],
  )

  const attemptApplyStops = useCallback(
    async (next) => {
      const v = validatePickupBeforeDeliveryForStops(next)
      if (!v.ok) {
        setScheduleOrderWarning(v.message || 'Invalid stop order: each delivery must follow its pickup.')
        return false
      }
      setScheduleOrderWarning('')
      await applyRouteForStops(next)
      return true
    },
    [applyRouteForStops],
  )

  useEffect(() => {
    baselineCapturedForKey.current = ''
    originalStopsBaselineRef.current = null
    setScheduleOrderWarning('')
  }, [loadContextKey])

  useEffect(() => {
    if (loading || stops.length === 0) return
    if (baselineCapturedForKey.current === loadContextKey) return
    baselineCapturedForKey.current = loadContextKey
    originalStopsBaselineRef.current = stops.map((s) => ({ ...s }))
  }, [loading, stops, loadContextKey])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (journeyIdFromUrl) {
        setLoading(true)
        setLoadErr('')
        setSaveMsg('')
        setSaveMsgIsError(false)
        setJourneyRecord(null)
        try {
          const { journey, stops: dbStops } = await fetchJourneyWithStops(journeyIdFromUrl)
          if (cancelled) return
          if (!journey?.id) {
            setLoadErr('Journey not found.')
            setQuotes([])
            setStops([])
            setRouteGeometry(null)
            setSavedJourneyId('')
            setJourneyRefDisplay('')
            setMarketplaceListed(false)
            setJourneyRecord(null)
            setPayoutManuallySet(false)
            return
          }
          const orderedIds = []
          const seen = new Set()
          for (const s of dbStops) {
            const qid = s.quote_id != null ? String(s.quote_id).trim() : ''
            if (qid && !seen.has(qid)) {
              seen.add(qid)
              orderedIds.push(qid)
            }
          }
          let rows = await fetchQuotesByIds(orderedIds)
          if (rows.length === 0 && dbStops.length > 0) {
            const orderedRefs = []
            const seenR = new Set()
            for (const s of dbStops) {
              const r = s.job_ref != null ? String(s.job_ref).trim() : ''
              if (r && !seenR.has(r)) {
                seenR.add(r)
                orderedRefs.push(r)
              }
            }
            rows = await fetchQuotesByQuoteRefsFull(orderedRefs)
          }
          if (cancelled) return

          const refToQuoteId = new Map(rows.map((q) => [String(q.quote_ref || '').trim(), String(q.id)]))
          let modelStops = dbStops.map(dbStopToModel).map((s) => {
            const qid = String(s.quoteId || '').trim()
            if (qid) return s
            const fromRef = refToQuoteId.get(String(s.jobRef || '').trim())
            return fromRef ? { ...s, quoteId: fromRef } : s
          })
          const existingQuoteIds = new Set(rows.map((q) => String(q.id)))
          const extraIds = addIdsFromUrl.filter((id) => !existingQuoteIds.has(String(id)))
          if (extraIds.length > 0) {
            const extraQuotes = await fetchQuotesByIds(extraIds)
            const extraStops = buildStopsFromQuotesOrdered(extraQuotes)
            rows = [...rows, ...extraQuotes]
            modelStops = [...modelStops, ...extraStops]
          }

          setQuotes(rows)
          setSavedJourneyId(String(journey.id))
          setJourneyRefDisplay(journey.journey_ref != null ? String(journey.journey_ref) : '')
          setMarketplaceListed(String(journey.marketplace_visibility) === 'visible_in_marketplace')
          setJourneyRecord(journey)

          const manual = Boolean(journey.journey_payout_manually_set)
          setPayoutManuallySet(manual)
          const payout =
            journey.marketplace_payout_price != null && Number.isFinite(Number(journey.marketplace_payout_price))
              ? Number(journey.marketplace_payout_price)
              : null
          if (payout != null) {
            setJourneyPayoutInput(String(payout))
          } else if (!manual) {
            const suggested = suggestJourneyMarketplacePayoutFromQuotes(rows)
            setJourneyPayoutInput(suggested ? String(suggested.payout.toFixed(2)) : '')
          } else {
            setJourneyPayoutInput('')
          }
          setSummaryTitleOverride(
            journey.summary_title != null && String(journey.summary_title).trim()
              ? String(journey.summary_title).trim()
              : '',
          )
          await applyRouteForStops(modelStops)
          if (!cancelled && extraIds.length > 0) {
            navigate(`/admin/journey-planner?journey=${encodeURIComponent(String(journey.id))}`, { replace: true })
          }
        } catch (e) {
          if (!cancelled) setLoadErr(e?.message || 'Failed to load journey.')
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      if (!idsKey) {
        setQuotes([])
        setStops([])
        setRouteGeometry(null)
        setTotalDriveSeconds(0)
        setTotalMiles(0)
        setSavedJourneyId('')
        setJourneyRefDisplay('')
        setMarketplaceListed(false)
        setJourneyPayoutInput('')
        setSummaryTitleOverride('')
        setJourneyRecord(null)
        setPayoutManuallySet(false)
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadErr('')
      setSaveMsg('')
      setSaveMsgIsError(false)
      try {
        const rows = await fetchQuotesByIds(selectedQuoteIds)
        if (cancelled) return
        if (rows.length === 0) {
          setLoadErr('No matching jobs found. They may no longer be in Available Jobs.')
          setQuotes([])
          setStops([])
          setRouteGeometry(null)
          return
        }
        setQuotes(rows)
        setSavedJourneyId('')
        setJourneyRefDisplay('')
        setMarketplaceListed(false)
        setPayoutManuallySet(false)
        const suggested = suggestJourneyMarketplacePayoutFromQuotes(rows)
        setJourneyPayoutInput(suggested ? String(suggested.payout.toFixed(2)) : '')
        setSummaryTitleOverride('')
        const built = buildStopsFromQuotesOrdered(rows)
        await applyRouteForStops(built)
      } catch (e) {
        if (!cancelled) setLoadErr(e?.message || 'Failed to load jobs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [journeyIdFromUrl, idsKey, applyRouteForStops, selectedQuoteIds, addIdsFromUrl, navigate])

  useEffect(() => {
    if (journeyIdFromUrl) return
    if (selectedQuoteIds.length > 0) {
      try {
        sessionStorage.setItem(DRAFT_IDS_KEY, JSON.stringify(selectedQuoteIds))
      } catch {
        /* ignore */
      }
    }
  }, [selectedQuoteIds, journeyIdFromUrl])

  const quotesById = useMemo(() => {
    /** @type {Record<string, Record<string, unknown>>} */
    const m = {}
    for (const q of quotes) {
      if (q?.id != null) m[String(q.id)] = q
    }
    return m
  }, [quotes])

  const totals = useMemo(
    () => computeJourneyTotals(stops, totalDriveSeconds),
    [stops, totalDriveSeconds],
  )

  const journeyPayoutNumeric = useMemo(() => {
    const raw = String(journeyPayoutInput).trim()
    if (!raw) return null
    const n = parseFloat(raw.replace(/,/g, ''))
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [journeyPayoutInput])

  const customerTotalGbp = useMemo(() => {
    const fromQuotes = sumQuoteCustomerTotalsGbp(quotes)
    if (fromQuotes != null) return fromQuotes
    const raw = journeyRecord?.admin_customer_total_gbp
    if (raw != null && Number.isFinite(Number(raw))) return Number(raw)
    return null
  }, [quotes, journeyRecord])

  const platformMarginGbp = useMemo(
    () => journeyPlatformProfitGbp(customerTotalGbp, journeyPayoutNumeric),
    [customerTotalGbp, journeyPayoutNumeric],
  )

  const suggestedJourneyPayout = useMemo(() => suggestJourneyMarketplacePayoutFromQuotes(quotes), [quotes])

  const platformReductionPct = useMemo(
    () => effectivePlatformReductionPctOfCustomer(customerTotalGbp, journeyPayoutNumeric),
    [customerTotalGbp, journeyPayoutNumeric],
  )

  const persistPayoutAndManual = useCallback(
    async (n, manual = true) => {
      const capped = Math.round(Math.max(0, n) * 100) / 100
      setJourneyPayoutInput(String(capped.toFixed(2)))
      setPayoutManuallySet(manual)
      if (savedJourneyId && isSupabaseConfigured) {
        const { savedRemote } = await updateJourneyRow(savedJourneyId, {
          marketplace_payout_price: capped,
          journey_payout_manually_set: manual,
          admin_customer_total_gbp: customerTotalGbp ?? null,
        })
        if (!savedRemote) {
          setSaveMsgIsError(true)
          setSaveMsg('Could not persist payout — check Supabase policies.')
        }
      }
      setJourneyRecord((prev) =>
        prev && typeof prev === 'object'
          ? {
              ...prev,
              marketplace_payout_price: capped,
              journey_payout_manually_set: manual,
              admin_customer_total_gbp: customerTotalGbp ?? prev.admin_customer_total_gbp,
            }
          : prev,
      )
      setListRefreshKey((k) => k + 1)
    },
    [savedJourneyId, customerTotalGbp],
  )

  function openAdjustPriceModal() {
    setAdjustDraft(journeyPayoutInput)
    const rp = effectivePlatformReductionPctOfCustomer(customerTotalGbp, journeyPayoutNumeric)
    setAdjustPctDraft(rp != null ? String(rp.toFixed(1)) : '')
    setAdjustPriceOpen(true)
  }

  function applyQuickPlatformShareInModal(pct) {
    if (customerTotalGbp == null) return
    const calc = computeMarketplacePayoutFromCustomerTotal(customerTotalGbp, 'percentage', pct)
    if (!calc) return
    setAdjustDraft(String(calc.marketplacePayout.toFixed(2)))
    setAdjustPctDraft(String(pct))
  }

  function applyTypedPlatformPctInModal() {
    const v = parseFloat(String(adjustPctDraft).trim().replace(/,/g, ''))
    if (!Number.isFinite(v) || v < 0 || v > 100 || customerTotalGbp == null) return
    applyQuickPlatformShareInModal(v)
  }

  async function saveAdjustPriceModal() {
    const n = parseFloat(String(adjustDraft).replace(/,/g, ''))
    if (!Number.isFinite(n) || n < 0) {
      setSaveMsgIsError(true)
      setSaveMsg('Enter a valid marketplace payout (GBP).')
      return
    }
    setSaveMsg('')
    setSaveMsgIsError(false)
    await persistPayoutAndManual(n, true)
    setAdjustPriceOpen(false)
  }

  const adjustPreviewPayout = useMemo(() => {
    const raw = String(adjustDraft).trim()
    if (!raw) return null
    const n = parseFloat(raw.replace(/,/g, ''))
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [adjustDraft])

  const adjustPreviewReductionPct = useMemo(
    () => effectivePlatformReductionPctOfCustomer(customerTotalGbp, adjustPreviewPayout),
    [customerTotalGbp, adjustPreviewPayout],
  )

  const adjustPreviewProfit = useMemo(
    () => journeyPlatformProfitGbp(customerTotalGbp, adjustPreviewPayout),
    [customerTotalGbp, adjustPreviewPayout],
  )

  const mapStops = useMemo(
    () =>
      stops.map((s, i) => ({
        lng: Number(s.lng),
        lat: Number(s.lat),
        sequence: i + 1,
        kind: s.kind,
      })),
    [stops],
  )

  const autoTitle = useMemo(() => buildJourneyMarketplaceTitle(quotes, totals), [quotes, totals])
  const displayTitle = (summaryTitleOverride || '').trim() || autoTitle

  const requirementBadges = useMemo(
    () => buildJourneyRequirementsBadges({ quotes, jobsCount: totals.jobsCount }),
    [quotes, totals.jobsCount],
  )

  const { moveDate, timeRangeSummary } = useMemo(() => buildJourneyMoveDateAndRange(quotes), [quotes])
  const { fromPostcode, toPostcode } = useMemo(() => firstLastPostcodesFromStops(stops), [stops])
  const maxVolM3 = useMemo(() => maxVolumeM3FromQuotes(quotes), [quotes])
  const sumVolM3 = useMemo(() => sumVolumeM3FromQuotes(quotes), [quotes])
  const estWeightKg = useMemo(() => estimatedWeightKgFromQuotes(quotes), [quotes])
  const straightMi = useMemo(() => straightLineMilesAlongStops(stops), [stops])
  const inefficient = useMemo(
    () => isRouteInefficient(totalMiles, straightMi),
    [totalMiles, straightMi],
  )
  const overCapacity = sumVolM3 > JOURNEY_VAN_CAPACITY_M3
  const overEight = journeyExceedsEightHours(totals.totalDurationSeconds)
  const stopOrderValidation = useMemo(() => validatePickupBeforeDeliveryForStops(stops), [stops])

  function moveStop(index, delta) {
    const j = index + delta
    if (j < 0 || j >= stops.length) return
    const next = [...stops]
    const a = next[index]
    const b = next[j]
    next[index] = b
    next[j] = a
    void attemptApplyStops(next)
  }

  function moveStopToTop(index) {
    if (index <= 0) return
    const next = [...stops]
    const [row] = next.splice(index, 1)
    next.unshift(row)
    void attemptApplyStops(next)
  }

  function moveStopToBottom(index) {
    if (index >= stops.length - 1) return
    const next = [...stops]
    const [row] = next.splice(index, 1)
    next.push(row)
    void attemptApplyStops(next)
  }

  function reorderDragDrop(fromIndex, insertBeforeIndex) {
    if (fromIndex === insertBeforeIndex) return
    const next = [...stops]
    const [moved] = next.splice(fromIndex, 1)
    let at = insertBeforeIndex
    if (fromIndex < insertBeforeIndex) at = insertBeforeIndex - 1
    at = Math.max(0, Math.min(at, next.length))
    next.splice(at, 0, moved)
    void attemptApplyStops(next)
  }

  function requestRemoveJobFromJourney(quoteId, meta) {
    const qid = String(quoteId || '').trim()
    if (!qid) return
    setRemoveTarget({
      quoteId: qid,
      jobRef: meta?.jobRef || '',
      customerName: meta?.customerName || '',
    })
  }

  async function confirmRemoveJobFromJourney() {
    if (!removeTarget) return
    const qid = removeTarget.quoteId
    setRemovingJob(true)
    setSaveMsg('')
    setSaveMsgIsError(false)
    try {
      if (!savedJourneyId || !journeyRecord) {
        const nextStops = stopsWithoutQuote(stops, qid)
        const nextQuotes = quotesWithoutQuote(quotes, qid)
        setQuotes(nextQuotes)
        setScheduleOrderWarning('')
        await applyRouteForStops(nextStops)
        setSaveMsg('Job removed from this draft. Save the journey to persist.')
        setRemoveTarget(null)
        return
      }

      const result = await executeRemoveJobFromJourney({
        journeyId: savedJourneyId,
        journey: journeyRecord,
        quoteId: qid,
        stops,
        quotes,
        mapboxToken: token,
        withdrawFromMarketplaceIfListed: marketplaceListed,
      })

      if (result.marketplaceWithdrawn) {
        setMarketplaceListed(false)
      }

      const { journey: j, stops: dbStops } = await fetchJourneyWithStops(savedJourneyId)
      if (j) setJourneyRecord(j)

      const orderedIds = []
      const seen = new Set()
      for (const s of dbStops) {
        const sid = s.quote_id != null ? String(s.quote_id).trim() : ''
        if (sid && !seen.has(sid)) {
          seen.add(sid)
          orderedIds.push(sid)
        }
      }
      const rows = orderedIds.length > 0 ? await fetchQuotesByIds(orderedIds) : []
      setQuotes(rows)

      const refToQuoteId = new Map(rows.map((q) => [String(q.quote_ref || '').trim(), String(q.id)]))
      const modelStops = dbStops.map(dbStopToModel).map((s) => {
        const sqid = String(s.quoteId || '').trim()
        if (sqid) return s
        const fromRef = refToQuoteId.get(String(s.jobRef || '').trim())
        return fromRef ? { ...s, quoteId: fromRef } : s
      })

      setScheduleOrderWarning('')
      await applyRouteForStops(modelStops)

      if (!result.empty && !journeyRecord?.journey_payout_manually_set) {
        const suggested = suggestJourneyMarketplacePayoutFromQuotes(rows)
        if (suggested) setJourneyPayoutInput(String(suggested.payout.toFixed(2)))
      }

      setSaveMsg(
        result.empty
          ? 'Job removed. Journey is empty — add jobs or delete this draft.'
          : `Job removed.${result.marketplaceWithdrawn ? ' Withdrawn from marketplace.' : ''} Totals updated.`,
      )
      setListRefreshKey((k) => k + 1)
      setRemoveTarget(null)
    } catch (e) {
      setSaveMsgIsError(true)
      setSaveMsg(e?.message || 'Could not remove job.')
    } finally {
      setRemovingJob(false)
    }
  }

  async function onOptimize() {
    if (!stops.length) return
    setScheduleOptimizing(true)
    setScheduleOrderWarning('')
    try {
      const geo = await geocodeStops(stops, token)
      const opt = optimizeStopsGreedyNearest(geo)
      await attemptApplyStops(opt)
    } finally {
      setScheduleOptimizing(false)
    }
  }

  function onReverseRoute() {
    void attemptApplyStops([...stops].reverse())
  }

  function onPickupsFirst() {
    void attemptApplyStops(sortStopsPickupsFirstAllJobs(stops))
  }

  function onSortByTimeWindow() {
    void attemptApplyStops(sortStopsByMoveDateAndKind(stops, quotes))
  }

  function resetScheduleToBaseline() {
    const base = originalStopsBaselineRef.current
    const next =
      base && base.length > 0
        ? base.map((s) => ({ ...s }))
        : quotes.length > 0
          ? buildStopsFromQuotesOrdered(quotes)
          : []
    if (!next.length) return
    setScheduleOrderWarning('')
    void attemptApplyStops(next)
  }

  function parsePayoutNumber() {
    return journeyPayoutNumeric
  }

  function buildSavePayload(journeyId) {
    const payout = parsePayoutNumber()
    return {
      journeyId: journeyId || null,
      title: displayTitle,
      summaryTitle: displayTitle,
      stops,
      totalDriveSeconds: totals.totalDriveSeconds,
      totalServiceSeconds: totals.totalServiceSeconds,
      totalDurationSeconds: totals.totalDurationSeconds,
      totalMiles,
      jobsCount: totals.jobsCount,
      quotes,
      fromPostcode: fromPostcode || null,
      toPostcode: toPostcode || null,
      moveDate: moveDate || null,
      timeRangeSummary: timeRangeSummary || null,
      maxVolumeM3: maxVolM3 > 0 ? maxVolM3 : null,
      estimatedWeightKg: estWeightKg,
      journeyPayoutPrice: payout,
      journeyPayoutManuallySet: payoutManuallySet,
      adminCustomerTotalGbp: customerTotalGbp,
      requirementsTags: requirementBadges,
    }
  }

  async function onSave() {
    setSaveMsg('')
    setSaveMsgIsError(false)
    if (!isSupabaseConfigured) {
      setSaveMsgIsError(true)
      setSaveMsg('Connect Supabase and run migrations (journeys / journey_stops) to save.')
      return
    }
    if (!stops.length) {
      setSaveMsgIsError(true)
      setSaveMsg('Nothing to save — add jobs with pickup and delivery stops first.')
      return
    }
    const orderCheck = validatePickupBeforeDeliveryForStops(stops)
    if (!orderCheck.ok) {
      setSaveMsgIsError(true)
      setSaveMsg(orderCheck.message || 'Invalid stop order.')
      return
    }
    if (stops.some((s) => !String(s.quoteId || '').trim())) {
      setSaveMsgIsError(true)
      setSaveMsg('Every stop must be linked to a job. Fix stops or reload the journey.')
      return
    }
    setSaving(true)
    try {
      const res = await saveJourney(buildSavePayload(savedJourneyId))
      if (res?.id) {
        setSavedJourneyId(res.id)
        if (res.journey_ref) setJourneyRefDisplay(res.journey_ref)
        setSaveMsg('Journey saved.')
        setScheduleOrderWarning('')
        setListRefreshKey((k) => k + 1)
        try {
          sessionStorage.removeItem(DRAFT_IDS_KEY)
        } catch {
          /* ignore */
        }
        navigate(`/admin/journey-planner?journey=${encodeURIComponent(res.id)}`, { replace: true })
      } else {
        setSaveMsgIsError(true)
        setSaveMsg('Could not save journey — check Supabase policies and migrations 019/020.')
      }
    } catch (e) {
      setSaveMsgIsError(true)
      setSaveMsg(e?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function onSendMarketplace() {
    setSaveMsg('')
    setSaveMsgIsError(false)
    if (!isSupabaseConfigured) {
      setSaveMsgIsError(true)
      setSaveMsg('Connect Supabase to send journeys to the marketplace.')
      return
    }
    if (marketplaceListed) {
      setSaveMsgIsError(true)
      setSaveMsg('This journey is already on the marketplace.')
      return
    }
    if (!savedJourneyId) {
      setSaveMsgIsError(true)
      setSaveMsg('Save the journey first — use “Save journey”, then send to the marketplace.')
      return
    }
    if (!stops.length) {
      setSaveMsgIsError(true)
      setSaveMsg('Add at least one job with pickup and delivery stops before sending.')
      return
    }
    const orderCheck = validatePickupBeforeDeliveryForStops(stops)
    if (!orderCheck.ok) {
      setSaveMsgIsError(true)
      setSaveMsg(orderCheck.message || 'Invalid stop order.')
      return
    }
    const quoteIds = [...new Set(stops.map((s) => String(s.quoteId || '').trim()).filter(Boolean))]
    if (quoteIds.length === 0) {
      setSaveMsgIsError(true)
      setSaveMsg('No linked job IDs on stops. Save the journey from the planner with valid quote links.')
      return
    }
    const payoutVal = parsePayoutNumber()
    if (payoutVal == null) {
      setSaveMsgIsError(true)
      setSaveMsg('Enter journey payout (GBP) before sending — use the suggested value or set your own.')
      return
    }
    setSendingMarketplace(true)
    try {
      await saveJourney(buildSavePayload(savedJourneyId))
      await sendJourneyToMarketplace(savedJourneyId, quoteIds, payoutVal)
      setMarketplaceListed(true)
      setListRefreshKey((k) => k + 1)
      setJourneyRecord((prev) =>
        prev && typeof prev === 'object'
          ? {
              ...prev,
              marketplace_visibility: 'visible_in_marketplace',
              marketplace_payout_price: payoutVal,
              journey_payout_manually_set: payoutManuallySet,
            }
          : prev,
      )
      setSaveMsg('Journey sent to the marketplace as one bundle. Linked jobs stay attached; they are not duplicated.')
    } catch (e) {
      setSaveMsgIsError(true)
      setSaveMsg(e?.message || 'Could not send journey to marketplace.')
    } finally {
      setSendingMarketplace(false)
    }
  }

  const showGalleryOnly = !journeyIdFromUrl && !idsKey

  if (showGalleryOnly) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Journey planner</h2>
            <p className="mt-1 text-sm text-slate-600">
              Build multi-stop bundles from Available Jobs, save a journey, then open it for the operational view or
              edit stops and payout before marketplace publish.
            </p>
          </div>
          <Link
            to="/admin/available-jobs"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Available Jobs
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <JourneyPlannerList refreshKey={listRefreshKey} />
          <JourneyPlannerHelpPanel className="lg:sticky lg:top-4 lg:self-start" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden />
        Loading journey…
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        {loadErr}{' '}
        <button type="button" className="ml-2 font-semibold underline" onClick={() => navigate('/admin/available-jobs')}>
          Back to Available Jobs
        </button>
      </div>
    )
  }

  const payoutNum = parsePayoutNumber()
  const payoutDisplay =
    payoutNum != null ? `£${payoutNum.toFixed(2)}` : 'Not set — add before partners accept'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Journey planner</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Multi-stop bundle for partners: one marketplace card, original jobs stay linked. Use the{' '}
            <strong>Journey schedule</strong> below to reorder stops (pickup must stay before each delivery); save when
            ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {savedJourneyId ? (
            <Link
              to={`/admin/journey-planner/view/${encodeURIComponent(savedJourneyId)}`}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Journey view
            </Link>
          ) : null}
          <Link
            to="/admin/journey-planner"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            All journeys
          </Link>
          <button
            type="button"
            onClick={() => navigate('/admin/available-jobs')}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Available Jobs
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                {journeyRefDisplay ? `Reference ${journeyRefDisplay}` : 'Draft journey (save to allocate reference)'}
              </p>
              {marketplaceListed ? (
                <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  On marketplace
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-200">
                  Not listed
                </span>
              )}
            </div>
            <p className="max-w-md text-right text-[11px] font-medium text-slate-400">
              {journeyRecord
                ? marketplaceStatusLabel(journeyRecord.marketplace_visibility)
                : savedJourneyId
                  ? 'Saved journey'
                  : 'Unsaved draft — save to create journey record and link stops'}
            </p>
          </div>
          {editMode ? (
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Journey title</span>
              <input
                value={summaryTitleOverride}
                onChange={(e) => setSummaryTitleOverride(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-base font-bold text-white placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              />
            </label>
          ) : (
            <h3 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{displayTitle}</h3>
          )}
          <p className="mt-2 text-sm font-medium text-slate-200">
            {fromPostcode || '—'} → {toPostcode || '—'}
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 sm:p-5">
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Move date</p>
            <p className="mt-1 text-sm font-bold">{moveDate ? formatDateUK(moveDate) : '—'}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Time windows</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-100">{timeRangeSummary}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total miles</p>
            <p className="mt-1 text-sm font-bold">{totalMiles > 0 ? `${totalMiles.toFixed(1)} mi` : '—'}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total duration</p>
            <p className="mt-1 text-sm font-bold">{formatJourneyDurationHhMm(totals.totalDurationSeconds)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Drive {formatJourneyDurationHhMm(totals.totalDriveSeconds)} · Stops{' '}
              {formatJourneyDurationHhMm(totals.totalServiceSeconds)}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. driving time</p>
            <p className="mt-1 text-sm font-bold">{formatJourneyDurationHhMm(totals.totalDriveSeconds)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jobs</p>
            <p className="mt-1 text-sm font-bold">{totals.jobsCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total volume (combined)</p>
            <p className="mt-1 text-sm font-bold">{sumVolM3 > 0 ? `${sumVolM3} m³` : '—'}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Max volume (per job)</p>
            <p className="mt-1 text-sm font-bold">{maxVolM3 > 0 ? `${maxVolM3} m³` : '—'}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. weight</p>
            <p className="mt-1 text-sm font-bold">{estWeightKg != null ? `${estWeightKg} kg` : '—'}</p>
          </div>
          <div className="rounded-xl bg-sky-500/15 px-3 py-2.5 ring-1 ring-sky-400/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">Customer total (jobs)</p>
            <p className="mt-1 text-sm font-bold text-sky-50">
              {customerTotalGbp != null ? `£${customerTotalGbp.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Platform reduction</p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {platformReductionPct != null ? `${platformReductionPct.toFixed(1)}%` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">Share of combined customer total</p>
          </div>
          <div className="rounded-xl bg-violet-500/15 px-3 py-2.5 ring-1 ring-violet-400/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-100">Platform margin</p>
            <p className="mt-1 text-sm font-bold text-violet-50">
              {platformMarginGbp != null ? `£${platformMarginGbp.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Journey payout</p>
            {editMode ? (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  value={journeyPayoutInput}
                  onChange={(e) => {
                    setJourneyPayoutInput(e.target.value)
                    setPayoutManuallySet(true)
                  }}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-sm font-bold text-white"
                  placeholder="0.00"
                />
                {suggestedJourneyPayout ? (
                  <p className="mt-1 text-[10px] text-emerald-100/90">
                    {payoutManuallySet ? 'Suggested from default rules (reference): ' : 'Suggested from default marketplace rules: '}
                    £{suggestedJourneyPayout.payout.toFixed(2)} ({suggestedJourneyPayout.deductionLabel})
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-lg font-bold text-emerald-100">{payoutDisplay}</p>
            )}
          </div>
        </div>
        {requirementBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
            {requirementBadges.map((b) => (
              <span
                key={b}
                className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100"
              >
                {b}
              </span>
            ))}
          </div>
        ) : null}
        <div className="border-t border-white/10 bg-black/20 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dispatch</p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex w-full flex-col gap-2 sm:max-w-xs">
              <JourneyAssignDriverButton
                variant="primary"
                className="[&_button]:bg-white [&_button]:text-slate-900 [&_button]:hover:bg-slate-100"
                journey={journeyRecord}
                journeyId={savedJourneyId}
                quotes={quotes}
                stops={stops}
                onAssigned={async () => {
                  const ids = [...new Set(stops.map((s) => s.quoteId).filter(Boolean))]
                  if (ids.length > 0) {
                    const rows = await fetchQuotesByIds(ids)
                    setQuotes(rows)
                  }
                  if (savedJourneyId) {
                    const { journey: j } = await fetchJourneyWithStops(savedJourneyId)
                    if (j) setJourneyRecord(j)
                  }
                  setListRefreshKey((k) => k + 1)
                }}
              />
              {savedJourneyId ? (
                <Link
                  to={`/admin/journey-planner/view/${encodeURIComponent(savedJourneyId)}`}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-white/25 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/10"
                >
                  Journey view
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || stops.length === 0}
                onClick={() => void onSave()}
                className="min-h-[44px] rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-45"
              >
                {saving ? 'Saving…' : 'Save journey'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode((editing) => {
                    if (!editing) setSummaryTitleOverride(displayTitle)
                    return !editing
                  })
                }}
                className="min-h-[44px] rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                {editMode ? 'Done editing' : 'Edit journey'}
              </button>
              <button
                type="button"
                onClick={() => openAdjustPriceModal()}
                className="min-h-[44px] rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Adjust price
              </button>
              {savedJourneyId ? (
                <Link
                  to={`/admin/available-jobs?extendJourney=${encodeURIComponent(savedJourneyId)}`}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Add jobs
                </Link>
              ) : null}
              <button
                type="button"
                disabled={
                  sendingMarketplace ||
                  marketplaceListed ||
                  stops.length === 0 ||
                  !savedJourneyId ||
                  journeyPayoutNumeric == null
                }
                onClick={() => void onSendMarketplace()}
                className="min-h-[44px] rounded-xl border border-emerald-400/60 bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-45"
              >
                {sendingMarketplace ? 'Sending…' : 'Send to marketplace'}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:px-5">
          <JourneyCompletionGuidance variant="dark" />
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pricing summary</p>
        <p className="mt-1 font-semibold text-slate-900">
          Customer total (all jobs):{' '}
          <span className="text-slate-950">{customerTotalGbp != null ? `£${customerTotalGbp.toFixed(2)}` : '—'}</span>
          {' · '}
          Platform reduction:{' '}
          <span className="text-slate-950">
            {platformReductionPct != null ? `${platformReductionPct.toFixed(1)}%` : '—'}
          </span>
          {' · '}
          Journey payout:{' '}
          <span className="text-emerald-800">{payoutNum != null ? `£${payoutNum.toFixed(2)}` : '—'}</span>
          {' · '}
          Platform margin:{' '}
          <span className="text-violet-800">{platformMarginGbp != null ? `£${platformMarginGbp.toFixed(2)}` : '—'}</span>
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journey time</p>
        <p className="mt-1 font-semibold text-slate-900">
          Total (drive + stops): {formatJourneyDurationHhMm(totals.totalDurationSeconds)} · Drive{' '}
          {formatJourneyDurationHhMm(totals.totalDriveSeconds)} · Stops{' '}
          {formatJourneyDurationHhMm(totals.totalServiceSeconds)}
        </p>
      </div>

      {overEight ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Warning: this journey exceeds 8 hours ({formatJourneyDurationHhMm(totals.totalDurationSeconds)}).
        </div>
      ) : null}
      {overCapacity ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Warning: combined volume ({sumVolM3} m³) exceeds a typical single-lorry capacity benchmark (
          {JOURNEY_VAN_CAPACITY_M3} m³). Max per job is {maxVolM3} m³.
        </div>
      ) : null}
      {inefficient && straightMi != null ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Warning: road route ({totalMiles} mi) is much longer than straight-line order ({straightMi} mi) — check for
          backtracking or consider optimizing.
        </div>
      ) : null}

      {routingErr ? <p className="text-sm text-amber-800">{routingErr}</p> : null}
      {saveMsg ? (
        <p className={`text-sm font-medium ${saveMsgIsError ? 'text-red-800' : 'text-emerald-800'}`}>{saveMsg}</p>
      ) : null}

      <JourneyRouteMap stops={mapStops} routeGeometry={routeGeometry} />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setScheduleOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <h4 className="text-base font-bold text-slate-900">Journey schedule</h4>
            <p className="text-xs text-slate-500">{stops.length} stops · pickup / delivery order</p>
          </div>
          <span className="text-sm font-semibold text-brand-700">{scheduleOpen ? 'Collapse' : 'Expand'}</span>
        </button>
        {scheduleOpen ? (
          <div className="border-t border-slate-100 px-4 pb-5 pt-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Schedule tools</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={stops.length < 2 || scheduleOptimizing}
                  onClick={() => void onOptimize()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {scheduleOptimizing ? 'Optimizing…' : 'Optimize route'}
                </button>
                <button
                  type="button"
                  disabled={stops.length < 2 || scheduleOptimizing}
                  onClick={onReverseRoute}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Reverse route
                </button>
                <button
                  type="button"
                  disabled={stops.length < 2 || scheduleOptimizing}
                  onClick={onPickupsFirst}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Sort pickups first
                </button>
                <button
                  type="button"
                  disabled={stops.length < 2 || scheduleOptimizing || quotes.length === 0}
                  onClick={onSortByTimeWindow}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Sort by move date
                </button>
                <button
                  type="button"
                  disabled={stops.length === 0 || scheduleOptimizing}
                  onClick={resetScheduleToBaseline}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-40"
                >
                  Reset to original order
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Optimize uses road distance (Mapbox). Sort by move date uses each job&apos;s move date, then pickup
              before delivery. Invalid reorders are blocked and do not change the list.
            </p>
            {!stopOrderValidation.ok ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
                Stop order invalid: {stopOrderValidation.message} Fix order before saving or sending to the
                marketplace.
              </div>
            ) : null}
            {scheduleOrderWarning ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                <span>{scheduleOrderWarning}</span>
                <button
                  type="button"
                  onClick={() => setScheduleOrderWarning('')}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
            <ul className="mt-3 space-y-2">
            {stops.map((s, i) => {
              const quote = s.quoteId ? quotesById[s.quoteId] : null
              const open = expandedStopIds.has(s.id)
              return (
              <li
                key={s.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = parseInt(e.dataTransfer.getData('text/plain'), 10)
                  if (!Number.isFinite(from)) return
                  reorderDragDrop(from, i)
                  setDraggingStopIndex(null)
                }}
                className={draggingStopIndex === i ? 'rounded-xl ring-2 ring-brand-500' : ''}
              >
                <JourneyStopCard
                  stop={s}
                  index={i}
                  quote={quote}
                  open={open}
                  onToggle={() => {
                    setExpandedStopIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(s.id)) next.delete(s.id)
                      else next.add(s.id)
                      return next
                    })
                  }}
                  mode="editor"
                  onRemoveJob={requestRemoveJobFromJourney}
                  editorActions={{
                    onMoveUp: () => moveStop(i, -1),
                    onMoveDown: () => moveStop(i, 1),
                    onMoveTop: () => moveStopToTop(i),
                    onMoveBottom: () => moveStopToBottom(i),
                    canMoveUp: i > 0,
                    canMoveDown: i < stops.length - 1,
                    removingJob,
                  }}
                  dragHandle={
                    <span
                      title="Drag to reorder"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(i))
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggingStopIndex(i)
                      }}
                      onDragEnd={() => setDraggingStopIndex(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-grab select-none rounded border border-dashed border-slate-300 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-slate-500 hover:border-slate-400 active:cursor-grabbing"
                      aria-label="Drag to reorder stop"
                    >
                      ⋮⋮
                    </span>
                  }
                />
              </li>
            )})}
            </ul>
            <div
              className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-[11px] font-medium text-slate-500"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = parseInt(e.dataTransfer.getData('text/plain'), 10)
                if (!Number.isFinite(from)) return
                reorderDragDrop(from, stops.length)
                setDraggingStopIndex(null)
              }}
            >
              Drop here to move to end of route
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <JourneyPlannerList refreshKey={listRefreshKey} compact />
        <JourneyPlannerHelpPanel className="lg:sticky lg:top-4 lg:self-start" />
      </div>

      {adjustPriceOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-price-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdjustPriceOpen(false)
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="adjust-price-title" className="text-lg font-bold text-slate-900">
              Adjust marketplace payout
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Stored as journey payout (partners see this price only). Original customer totals stay internal to admin.
            </p>
            <dl className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Original customer total</dt>
                <dd className="font-semibold text-slate-900">
                  {customerTotalGbp != null ? `£${customerTotalGbp.toFixed(2)}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Platform reduction (preview)</dt>
                <dd className="font-semibold text-slate-900">
                  {adjustPreviewReductionPct != null ? `${adjustPreviewReductionPct.toFixed(1)}%` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Marketplace payout (preview)</dt>
                <dd className="font-semibold text-emerald-800">
                  {adjustPreviewPayout != null ? `£${adjustPreviewPayout.toFixed(2)}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Est. platform profit</dt>
                <dd className="font-semibold text-violet-900">
                  {adjustPreviewProfit != null ? `£${adjustPreviewProfit.toFixed(2)}` : '—'}
                </dd>
              </div>
            </dl>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fixed payout (£)</span>
              <input
                type="text"
                inputMode="decimal"
                value={adjustDraft}
                onChange={(e) => setAdjustDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </label>
            <div className="mt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform share (% of customer)</span>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={adjustPctDraft}
                  onChange={(e) => setAdjustPctDraft(e.target.value)}
                  className="min-w-[5rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                  placeholder="%"
                />
                <button
                  type="button"
                  disabled={customerTotalGbp == null}
                  onClick={() => applyTypedPlatformPctInModal()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                >
                  Apply %
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Quick: platform keeps this share of the combined customer total; payout is the remainder.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={customerTotalGbp == null}
                    onClick={() => applyQuickPlatformShareInModal(pct)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    −{pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setAdjustPriceOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveAdjustPriceModal()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Save payout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <JourneyRemoveJobModal
        open={removeTarget != null}
        jobRef={removeTarget?.jobRef || ''}
        customerName={removeTarget?.customerName || ''}
        listedOnMarketplace={marketplaceListed}
        removing={removingJob}
        onClose={() => !removingJob && setRemoveTarget(null)}
        onConfirm={confirmRemoveJobFromJourney}
      />
    </div>
  )
}
