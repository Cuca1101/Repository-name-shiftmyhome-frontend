import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { fetchAllJourneysForAdmin, fetchJourneyStopsForJourneyIds } from '../lib/data/journeysRepository'
import {
  fetchLatestDriverLivePositionsMap,
  subscribeDriverLivePositions,
} from '../lib/data/driverLivePositionsRepository'
import { getFleetDriversCached, loadFleetDriversForAdmin } from '../lib/adminFleetDrivers'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  filterJourneysForProductionInbox,
  filterQuotesForProductionInbox,
} from '../lib/demoTestRecordDetection'
import { subscribeAdminDataRefresh } from '../lib/adminDataRefresh'
import { formatDateUK } from '../lib/formatDateDisplay'
import { geocodeAddressCached } from '../lib/operationsMapGeocodeCache'
import {
  fetchMapboxDrivingRoute,
  formatDriveDuration,
  operationsRouteCoordCacheKey,
} from '../lib/operationsMapDirections'
import {
  getOperationsRouteLegCached,
  setOperationsRouteLegCached,
} from '../lib/operationsMapRouteCache'
import {
  OPERATIONS_MAP_MODES,
  buildDriverMapFeatures,
  buildJobMapGeoJson,
  buildJourneyMapGeoJson,
  buildOperationsMapWarnings,
  quotesForOperationsMapMode,
  quoteJobRef,
  sumLineCollectionMiles,
  driverDispatchPresentation,
} from '../lib/operationsMapHelpers'
import OperationsMapboxCanvas from './operations-map/OperationsMapboxCanvas'
import OperationsMapJourneySuggestions from './operations-map/OperationsMapJourneySuggestions'
import OperationsMapDriverCards from './operations-map/OperationsMapDriverCards'
import { useAnimatedDrivers } from './operations-map/useAnimatedDrivers'
import { buildActiveRouteProgressGeoJson } from '../lib/operationsMapRouteProgress'
import { buildJourneyBundleSuggestions, buildHeatmapPointsFromJobs } from '../lib/operationsMapJourneySuggestions'
import { buildExtendedDispatchWarnings } from '../lib/operationsMapDispatchWarnings'
import { formatEtaBadge, etaCacheKey } from '../lib/operationsMapEta'
import {
  parseDetailsKeyValues,
  formatMoveArrivalSummary,
  resolveFinancials,
  formatVolumeAndCrew,
} from '../lib/quoteJobAdminModel'
import { getMarketplaceFinancePresentation, quoteAdjustmentsSumGbp } from '../lib/marketplaceQuoteFinance'
import {
  quoteMoveYmd,
  journeyMoveYmd,
  localTodayYmd,
  ymdMatchesDatePreset,
  formatDatePresetLabel,
} from '../lib/operationsMapDateFilter'

/** Same key as JourneyPlannerPage draft persistence */
const JOURNEY_DRAFT_SESSION_KEY = 'smh_journey_draft_quote_ids'

const MODE_LABELS = {
  available: 'Available jobs',
  active: 'Active jobs',
  completed: 'Completed jobs',
  cancelled: 'Cancelled jobs',
  drivers: 'Drivers',
  journeys: 'Journeys',
}

const DATE_PRESET_BUTTONS = /** @type {const} */ ([
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'this_week', label: 'This week' },
  { id: 'custom', label: 'Custom date' },
  { id: 'all', label: 'All dates' },
])

/** @param {string} m */
function titleCaseModeLabel(m) {
  const s = MODE_LABELS[m] || m
  return s.replace(/\b([a-z])/g, (ch) => ch.toUpperCase())
}

const emptyFc = () => ({ type: 'FeatureCollection', features: [] })

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {string} token
 * @param {(partial: Record<string, { pickup: { lng: number, lat: number } | null, delivery: { lng: number, lat: number } | null }>) => void} onProgress
 */
async function geocodeQuotesBatch(quotes, token, onProgress) {
  /** @type {Record<string, { pickup: { lng: number, lat: number } | null, delivery: { lng: number, lat: number } | null }>} */
  const acc = {}
  const list = (quotes || []).slice(0, 120)
  const CHUNK = 5
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK)
    await Promise.all(
      slice.map(async (q) => {
        const id = String(q?.id || '')
        if (!id) return
        const puAddr = String(q?.pickup_address || '').trim()
        const dlAddr = String(q?.delivery_address || '').trim()
        const pickup = puAddr ? await geocodeAddressCached(puAddr, token) : null
        const delivery = dlAddr ? await geocodeAddressCached(dlAddr, token) : null
        acc[id] = { pickup, delivery }
      }),
    )
    onProgress({ ...acc })
  }
  return acc
}

export default function OperationsMapPage() {
  const navigate = useNavigate()
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const directionsRunIdRef = useRef(0)

  const collectVisibleRouteLegs = useCallback((wanted, coords) => {
    /** @type {Record<string, { coordinates: number[][], durationSeconds: number, distanceMeters: number }>} */
    const trimmed = {}
    for (const q of wanted) {
      const id = String(q?.id ?? '')
      if (!id) continue
      const c = coords[id]
      if (!c?.pickup || !c?.delivery) continue
      const key = operationsRouteCoordCacheKey(id, c.pickup, c.delivery)
      const entry = getOperationsRouteLegCached(key)
      if (entry?.coordinates?.length >= 2) trimmed[id] = entry
    }
    return trimmed
  }, [])
  const [mode, setMode] = useState('available')
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [journeys, setJourneys] = useState([])
  const [journeyStops, setJourneyStops] = useState([])
  const [loading, setLoading] = useState(true)
  const [geoBusy, setGeoBusy] = useState(false)
  const [directionsBusy, setDirectionsBusy] = useState(false)
  const [routeLegByQuoteId, setRouteLegByQuoteId] = useState(
    () =>
      /** @type {Record<string, { coordinates: number[][], durationSeconds: number, distanceMeters: number }>} */ ({}),
  )
  const [coordsByQuoteId, setCoordsByQuoteId] = useState({})
  const [liveByDriverKey, setLiveByDriverKey] = useState({})
  const [selectedQuoteIds, setSelectedQuoteIds] = useState(() => new Set())
  const [drawerQuoteId, setDrawerQuoteId] = useState('')
  const [drawerJourneyId, setDrawerJourneyId] = useState('')
  const [drawerDriverId, setDrawerDriverId] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [hideCompletedTint, setHideCompletedTint] = useState(false)
  const [datePreset, setDatePreset] = useState('today')
  const [customMoveYmd, setCustomMoveYmd] = useState(() => localTodayYmd())
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [etaByDriverId, setEtaByDriverId] = useState(/** @type {Record<string, { label: string, pickup?: { label: string, delayed?: boolean }, delivery?: { label: string, delayed?: boolean } }>} */ ({}))
  const etaCacheRef = useRef(new Map())
  const etaRunRef = useRef(0)
  const [dispatchToast, setDispatchToast] = useState('')

  const loadCore = useCallback(async () => {
    setLoading(true)
    try {
      const [q, j, jr] = await Promise.all([
        fetchQuotesForAdmin('all', ''),
        fetchAllJobs(),
        fetchAllJourneysForAdmin(200),
      ])
      setQuotes(filterQuotesForProductionInbox(Array.isArray(q) ? q : []))
      setJobs(Array.isArray(j) ? j : [])
      setJourneys(filterJourneysForProductionInbox(Array.isArray(jr) ? jr : []))
      const ids = (Array.isArray(jr) ? jr : []).map((x) => String(x?.id || '').trim()).filter(Boolean)
      const stops = await fetchJourneyStopsForJourneyIds(ids)
      setJourneyStops(Array.isArray(stops) ? stops : [])
    } catch {
      setQuotes([])
      setJobs([])
      setJourneys([])
      setJourneyStops([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCore()
  }, [loadCore])

  useEffect(() => subscribeAdminDataRefresh(loadCore), [loadCore])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined
    const channel = supabase
      .channel('ops-map-quotes-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        void loadCore()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => {
        void loadCore()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadCore])

  useEffect(() => {
    let cancelled = false
    async function loadLive() {
      const m = await fetchLatestDriverLivePositionsMap()
      if (!cancelled) setLiveByDriverKey(m)
    }
    void loadLive()
    const unsub = subscribeDriverLivePositions(({ new: row }) => {
      if (!row?.driver_key) return
      setLiveByDriverKey((prev) => ({
        ...prev,
        [String(row.driver_key)]: row,
      }))
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const anchorYmd = useMemo(() => localTodayYmd(), [loading])

  const modeFilteredQuotes = useMemo(() => {
    if (mode === 'drivers' || mode === 'journeys') return []
    let list = quotesForOperationsMapMode(mode, quotes, jobs)
    if (mode === 'completed' && hideCompletedTint) {
      list = []
    }
    return list
  }, [mode, quotes, jobs, hideCompletedTint])

  const filteredJobQuotes = useMemo(() => {
    if (datePreset === 'all') return modeFilteredQuotes
    return modeFilteredQuotes.filter((q) =>
      ymdMatchesDatePreset(quoteMoveYmd(q), datePreset, customMoveYmd, anchorYmd),
    )
  }, [modeFilteredQuotes, datePreset, customMoveYmd, anchorYmd])

  const filteredJourneys = useMemo(() => {
    if (datePreset === 'all') return journeys
    return journeys.filter((j) =>
      ymdMatchesDatePreset(journeyMoveYmd(j), datePreset, customMoveYmd, anchorYmd),
    )
  }, [journeys, datePreset, customMoveYmd, anchorYmd])

  const activeQuotesAll = useMemo(() => quotesForOperationsMapMode('active', quotes, jobs), [quotes, jobs])

  const activeQuotesForMap = useMemo(() => {
    if (datePreset === 'all') return activeQuotesAll
    return activeQuotesAll.filter((q) =>
      ymdMatchesDatePreset(quoteMoveYmd(q), datePreset, customMoveYmd, anchorYmd),
    )
  }, [activeQuotesAll, datePreset, customMoveYmd, anchorYmd])

  const showingSummary = useMemo(() => {
    const modeTitle = titleCaseModeLabel(mode)
    const datePart = formatDatePresetLabel(datePreset, customMoveYmd)
    return `Showing: ${modeTitle} — ${datePart}`
  }, [mode, datePreset, customMoveYmd])

  useEffect(() => {
    const visibleIds = new Set(filteredJobQuotes.map((q) => String(q?.id || '')))
    setSelectedQuoteIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      if (next.size !== prev.size) return next
      for (const id of prev) {
        if (!next.has(id)) return next
      }
      return prev
    })
    if (drawerQuoteId && !visibleIds.has(String(drawerQuoteId))) {
      setDrawerQuoteId('')
    }
  }, [filteredJobQuotes, drawerQuoteId])

  useEffect(() => {
    if (mode !== 'journeys' || !drawerJourneyId) return
    const ok = filteredJourneys.some((j) => String(j.id) === String(drawerJourneyId))
    if (!ok) setDrawerJourneyId('')
  }, [mode, drawerJourneyId, filteredJourneys])

  const quotesToGeocode = useMemo(() => {
    if (mode === 'drivers') return activeQuotesForMap
    return filteredJobQuotes
  }, [mode, filteredJobQuotes, activeQuotesForMap])

  useEffect(() => {
    if (!token || quotesToGeocode.length === 0) {
      setCoordsByQuoteId({})
      return
    }
    let cancelled = false
    setGeoBusy(true)
    void (async () => {
      const merged = await geocodeQuotesBatch(quotesToGeocode, token, (partial) => {
        if (!cancelled) setCoordsByQuoteId(partial)
      })
      if (!cancelled) setCoordsByQuoteId(merged)
      if (!cancelled) setGeoBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token, quotesToGeocode])

  /** Mapbox Directions: road geometry + duration only — no straight-line fallback */
  useEffect(() => {
    const showJobs =
      mode === 'available' ||
      mode === 'active' ||
      mode === 'completed' ||
      mode === 'cancelled'
    if (!token || !showJobs) {
      directionsRunIdRef.current += 1
      setRouteLegByQuoteId({})
      setDirectionsBusy(false)
      return
    }

    const runId = ++directionsRunIdRef.current
    const CONCURRENCY = 4

    void (async () => {
      const wanted = filteredJobQuotes
      if (wanted.length === 0) {
        if (runId === directionsRunIdRef.current) {
          setRouteLegByQuoteId({})
          setDirectionsBusy(false)
        }
        return
      }

      if (runId !== directionsRunIdRef.current) return
      setDirectionsBusy(true)

      /** @type {{ id: string, pu: { lng: number, lat: number }, dl: { lng: number, lat: number }, key: string }[]} */
      const toFetch = []
      for (const q of wanted) {
        const id = String(q?.id ?? '')
        if (!id) continue
        const c = coordsByQuoteId[id]
        if (!c?.pickup || !c?.delivery) continue
        const key = operationsRouteCoordCacheKey(id, c.pickup, c.delivery)
        if (getOperationsRouteLegCached(key) === undefined) {
          toFetch.push({ id, pu: c.pickup, dl: c.delivery, key })
        }
      }

      const publish = () => {
        if (runId !== directionsRunIdRef.current) return
        setRouteLegByQuoteId(collectVisibleRouteLegs(wanted, coordsByQuoteId))
      }

      publish()

      try {
        for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
          if (runId !== directionsRunIdRef.current) return
          const slice = toFetch.slice(i, i + CONCURRENCY)
          await Promise.all(
            slice.map(async (item) => {
              const res = await fetchMapboxDrivingRoute(item.pu, item.dl, token)
              if (res?.coordinates?.length >= 2) {
                setOperationsRouteLegCached(item.key, {
                  coordinates: res.coordinates,
                  durationSeconds: res.durationSeconds,
                  distanceMeters: res.distanceMeters,
                })
              } else {
                setOperationsRouteLegCached(item.key, null)
              }
            }),
          )
          publish()
        }
      } finally {
        if (runId === directionsRunIdRef.current) {
          setDirectionsBusy(false)
        }
      }
    })()

    return undefined
  }, [token, mode, filteredJobQuotes, coordsByQuoteId, collectVisibleRouteLegs])

  const jobGeo = useMemo(() => {
    if (mode === 'drivers' || mode === 'journeys') {
      return {
        legs: emptyFc(),
        pickups: emptyFc(),
        deliveries: emptyFc(),
        jobPoints: emptyFc(),
      }
    }
    return buildJobMapGeoJson(filteredJobQuotes, coordsByQuoteId, mode, routeLegByQuoteId)
  }, [mode, filteredJobQuotes, coordsByQuoteId, routeLegByQuoteId])

  const journeyGeo = useMemo(
    () => buildJourneyMapGeoJson(filteredJourneys, journeyStops),
    [filteredJourneys, journeyStops],
  )

  const [driversList, setDriversList] = useState(() => getFleetDriversCached())

  useEffect(() => {
    let cancelled = false
    void loadFleetDriversForAdmin().then((list) => {
      if (!cancelled) setDriversList(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const driverGeo = useMemo(() => {
    return buildDriverMapFeatures(driversList, activeQuotesForMap, jobs, liveByDriverKey, coordsByQuoteId)
  }, [driversList, activeQuotesForMap, jobs, liveByDriverKey, coordsByQuoteId])

  const animatedDriversRaw = useAnimatedDrivers(driversList, liveByDriverKey, activeQuotesForMap)

  const driverPosByName = useMemo(() => {
    /** @type {Record<string, { lng: number, lat: number }>} */
    const out = {}
    for (const d of animatedDriversRaw) {
      const name = String(d.name || '').trim().toLowerCase()
      if (name) out[name] = { lng: d.lng, lat: d.lat }
    }
    return out
  }, [animatedDriversRaw])

  const routeProgressGeo = useMemo(() => {
    if (mode !== 'active') return { traveled: emptyFc(), remaining: emptyFc() }
    return buildActiveRouteProgressGeoJson(routeLegByQuoteId, filteredJobQuotes, coordsByQuoteId, driverPosByName)
  }, [mode, routeLegByQuoteId, filteredJobQuotes, coordsByQuoteId, driverPosByName])

  const useRouteProgress =
    mode === 'active' &&
    (routeProgressGeo.traveled.features.length > 0 || routeProgressGeo.remaining.features.length > 0)

  const heatmapGeo = useMemo(
    () => buildHeatmapPointsFromJobs(filteredJobQuotes, coordsByQuoteId),
    [filteredJobQuotes, coordsByQuoteId],
  )

  const journeySuggestions = useMemo(
    () => buildJourneyBundleSuggestions(filteredJobQuotes, coordsByQuoteId),
    [filteredJobQuotes, coordsByQuoteId],
  )

  const animatedDrivers = useMemo(() => {
    return animatedDriversRaw.map((d) => {
      const eta = etaByDriverId[d.driverId]
      const label = eta?.label || eta?.pickup?.label || eta?.delivery?.label || '—'
      return { ...d, etaLabel: label !== '—' ? label : undefined }
    })
  }, [animatedDriversRaw, etaByDriverId])

  const driverCardsData = useMemo(() => {
    return animatedDrivers.map((d) => ({
      driverId: d.driverId,
      name: d.name,
      status: d.status,
      dispatchStatus: d.status,
      activeJobRef: d.activeJobRef,
      etaLabel: d.etaLabel || etaByDriverId[d.driverId]?.label || '—',
      online: d.online,
      speedMph: d.speedMph,
      lastGpsAt: d.lastGpsAt,
    }))
  }, [animatedDrivers, etaByDriverId])

  useEffect(() => {
    if (!token) return
    const runId = ++etaRunRef.current
    void (async () => {
      /** @type {Record<string, { label: string, pickup?: { label: string }, delivery?: { label: string } }>} */
      const next = {}
      for (const d of driversList) {
        if (runId !== etaRunRef.current) return
        const id = String(d.id)
        const live = liveByDriverKey[id]
        if (!live || !Number.isFinite(Number(live.lng))) continue
        const from = { lng: Number(live.lng), lat: Number(live.lat) }
        const nameNorm = String(d.name || '').trim().toLowerCase()
        const assigned = activeQuotesForMap.filter(
          (q) => String(q.assigned_driver_name || '').trim().toLowerCase() === nameNorm,
        )
        const job = assigned[0]
        if (!job) {
          next[id] = { label: '—' }
          continue
        }
        const c = coordsByQuoteId[String(job.id)]
        if (!c?.pickup) {
          next[id] = { label: '—' }
          continue
        }
        const key = etaCacheKey(id, 'pickup', from, c.pickup)
        let sec = etaCacheRef.current.get(key)
        if (sec == null) {
          const res = await fetchMapboxDrivingRoute(from, c.pickup, token)
          sec = res?.durationSeconds ?? null
          etaCacheRef.current.set(key, sec)
        }
        const label = formatEtaBadge(sec || 0)
        next[id] = { label, pickup: { label } }
      }
      if (runId === etaRunRef.current) setEtaByDriverId(next)
    })()
  }, [token, driversList, liveByDriverKey, activeQuotesForMap, coordsByQuoteId])

  const warnings = useMemo(() => {
    const base = buildOperationsMapWarnings({
      mode,
      quotes,
      jobs,
      journeys,
      journeyStops,
      coordsByQuoteId,
      visibleJobQuotes:
        mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
          ? filteredJobQuotes
          : null,
      visibleJourneys: mode === 'journeys' ? filteredJourneys : null,
    })
    const ext = buildExtendedDispatchWarnings({
      quotes,
      jobs,
      coordsByQuoteId,
      visibleJobQuotes: filteredJobQuotes,
      driversList,
      liveByDriverKey,
      activeQuotesForMap,
      etaByDriverId,
    })
    return [...new Set([...base, ...ext])].slice(0, 18)
  }, [
    mode,
    quotes,
    jobs,
    journeys,
    journeyStops,
    coordsByQuoteId,
    filteredJobQuotes,
    filteredJourneys,
    driversList,
    liveByDriverKey,
    activeQuotesForMap,
    etaByDriverId,
  ])

  useEffect(() => {
    if (!warnings.length) return
    const top = warnings[0]
    if (!top) return
    setDispatchToast(top)
    const t = window.setTimeout(() => setDispatchToast(''), 5000)
    return () => window.clearTimeout(t)
  }, [warnings.join('|')])

  const stats = useMemo(() => {
    const visibleJobs =
      mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled'
        ? filteredJobQuotes.length
        : 0
    const driversVisible =
      mode === 'drivers' ? driverGeo.features.length : driversList.filter((d) => d.status === 'Active').length
    const journeysVisible = mode === 'journeys' ? filteredJourneys.length : 0
    const milesJobs = sumLineCollectionMiles(jobGeo.legs)
    const milesJ = sumLineCollectionMiles(journeyGeo.lines)
    return {
      visibleJobs,
      driversVisible,
      journeysVisible,
      totalMiles: Math.round((milesJobs + milesJ) * 10) / 10,
    }
  }, [mode, filteredJobQuotes.length, driverGeo, driversList.length, filteredJourneys.length, jobGeo.legs, journeyGeo.lines])

  const drawerQuote = useMemo(
    () => quotes.find((q) => String(q.id) === drawerQuoteId),
    [quotes, drawerQuoteId],
  )
  const drawerJourney = useMemo(
    () => journeys.find((j) => String(j.id) === drawerJourneyId),
    [journeys, drawerJourneyId],
  )
  const drawerDriver = useMemo(
    () => driversList.find((d) => String(d.id) === drawerDriverId),
    [driversList, drawerDriverId],
  )

  const drawerJobMeta = useMemo(() => {
    if (!drawerQuote) return null
    const kv = parseDetailsKeyValues(drawerQuote.details)
    const moveYmd = quoteMoveYmd(drawerQuote)
    const move = moveYmd ? formatDateUK(moveYmd) : '—'
    const dateTime = formatMoveArrivalSummary(drawerQuote, kv) || move
    const fin = resolveFinancials(drawerQuote, quoteAdjustmentsSumGbp(drawerQuote))
    const finM = getMarketplaceFinancePresentation(drawerQuote)
    const customer =
      fin?.customerTotal != null && Number.isFinite(Number(fin.customerTotal))
        ? `£${Number(fin.customerTotal).toFixed(2)}`
        : '—'
    const payout =
      finM?.marketplacePayout != null && Number.isFinite(Number(finM.marketplacePayout))
        ? `£${Number(finM.marketplacePayout).toFixed(2)}`
        : '—'
    const volume = formatVolumeAndCrew(drawerQuote)

    const qId = String(drawerQuote.id)
    const driveLeg = routeLegByQuoteId[qId]
    const drivePickupToDelivery =
      driveLeg?.coordinates?.length >= 2 &&
      typeof driveLeg.durationSeconds === 'number' &&
      driveLeg.durationSeconds > 0 &&
      typeof driveLeg.distanceMeters === 'number' &&
      driveLeg.distanceMeters > 0
        ? {
            timeLabel: formatDriveDuration(driveLeg.durationSeconds),
            milesLabel: `${(driveLeg.distanceMeters / 1609.344).toFixed(1)} mi`,
          }
        : null

    return { dateTime, customer, payout, volume, drivePickupToDelivery }
  }, [drawerQuote, routeLegByQuoteId])

  const openJobAssignmentTab = useCallback(
    (quoteId) => {
      navigate(`/admin/available-jobs/${encodeURIComponent(String(quoteId))}?tab=assignment`)
    },
    [navigate],
  )

  const onPickQuote = useCallback((id) => {
    setDrawerQuoteId(id)
    setDrawerJourneyId('')
    setDrawerDriverId('')
  }, [])
  const onPickJourney = useCallback((id) => {
    setDrawerJourneyId(id)
    setDrawerQuoteId('')
    setDrawerDriverId('')
  }, [])
  const onPickDriver = useCallback((id) => {
    setDrawerDriverId(id)
    setDrawerQuoteId('')
    setDrawerJourneyId('')
  }, [])

  function toggleSelectQuote(id) {
    const sid = String(id)
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  function addSelectionToPlannerFromIds(quoteIds) {
    if (!quoteIds?.length) return
    try {
      sessionStorage.setItem(JOURNEY_DRAFT_SESSION_KEY, JSON.stringify(quoteIds))
    } catch {
      /* ignore */
    }
    navigate('/admin/journey-planner', { state: { quoteIds } })
  }

  function addSelectionToPlanner() {
    if (selectedQuoteIds.size === 0) return
    addSelectionToPlannerFromIds([...selectedQuoteIds])
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Operations map</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Live logistics view for jobs, journeys, and drivers. Pickup → delivery corridors, journey bundles, and GPS
            hooks for the driver app (Supabase Realtime on{' '}
            <code className="rounded bg-slate-100 px-1">driver_live_positions</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadCore()}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh data
          </button>
          <Link
            to="/admin/available-jobs"
            className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Open jobs table
          </Link>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Operations map filters"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-2 shadow-sm ring-1 ring-slate-900/[0.04]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {OPERATIONS_MAP_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMode(m)
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              mode === m
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
        {mode === 'completed' ? (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={hideCompletedTint}
              onChange={(e) => setHideCompletedTint(e.target.checked)}
            />
            Hide completed routes
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm ring-1 ring-slate-900/[0.04]"
          role="group"
          aria-label="Move date filter"
        >
          <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Move date</span>
          {DATE_PRESET_BUTTONS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setDatePreset(b.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                datePreset === b.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
          {datePreset === 'custom' ? (
            <label className="ml-1 flex min-h-[44px] items-center gap-2 text-xs font-semibold text-slate-600 sm:min-h-0">
              <span className="sr-only">Custom move date</span>
              <input
                type="date"
                value={customMoveYmd}
                onChange={(e) => {
                  const v = e.target.value
                  setCustomMoveYmd(v || localTodayYmd())
                  setDatePreset('custom')
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm sm:py-1"
              />
            </label>
          ) : null}
          <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            Show heatmap
          </label>
        </div>
        <p className="text-sm font-semibold leading-snug text-slate-800 sm:max-w-[min(100%,28rem)] sm:text-right">
          {showingSummary}
        </p>
      </div>

      <div className="relative flex min-h-[560px] flex-1 flex-col gap-3 lg:flex-row">
        <div className="relative flex min-h-[560px] flex-1 flex-col">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/40 backdrop-blur-sm">
              <p className="rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-slate-800 shadow-lg">
                Loading operations data…
              </p>
            </div>
          ) : null}
          {geoBusy || directionsBusy ? (
            <div className="absolute left-4 top-4 z-10 rounded-full bg-amber-500/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
              {geoBusy ? 'Geocoding addresses…' : 'Fetching road routes…'}
            </div>
          ) : null}
          {!loading &&
          !geoBusy &&
          !directionsBusy &&
          (mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled') &&
          filteredJobQuotes.length > 0 &&
          jobGeo.jobPoints.features.length === 0 ? (
            <div className="absolute inset-x-4 top-14 z-10 rounded-xl border border-amber-300/80 bg-amber-950/90 px-4 py-3 text-sm text-amber-50 shadow-lg">
              Jobs are loaded but could not be placed on the map yet (geocoding may still be running, or addresses
              could not be resolved). Try <strong>Refresh data</strong> or zoom the map.
            </div>
          ) : null}
          {!loading && mode === 'journeys' && !geoBusy && filteredJourneys.length === 0 ? (
            <div className="absolute inset-x-4 top-14 z-10 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-200 shadow-lg">
              No journeys found for this date/filter.
            </div>
          ) : null}
          {!loading &&
          (mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled') &&
          filteredJobQuotes.length === 0 ? (
            <div className="absolute inset-x-4 top-14 z-10 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-200 shadow-lg">
              No jobs found for this date/filter.
            </div>
          ) : null}
          {!isSupabaseConfigured ? (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Connect Supabase to load jobs and journeys on the map.
            </div>
          ) : null}

          <OperationsMapboxCanvas
            token={token}
            mode={mode}
            jobLegs={jobGeo.legs}
            jobPoints={jobGeo.jobPoints}
            journeyLines={journeyGeo.lines}
            journeyStops={journeyGeo.points}
            drivers={driverGeo}
            animatedDrivers={animatedDrivers}
            routeTraveled={routeProgressGeo.traveled}
            routeRemaining={routeProgressGeo.remaining}
            heatmapPoints={heatmapGeo}
            showHeatmap={showHeatmap}
            useRouteProgress={useRouteProgress}
            selectedQuoteIds={[...selectedQuoteIds]}
            focusedQuoteId={drawerQuoteId}
            focusedDriverId={drawerDriverId}
            onPickQuote={onPickQuote}
            onPickJourney={onPickJourney}
            onPickDriver={onPickDriver}
          />
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[min(100%,320px)]">
          {mode === 'drivers' ? (
            <OperationsMapDriverCards
              drivers={driverCardsData}
              focusedDriverId={drawerDriverId}
              onPickDriver={onPickDriver}
            />
          ) : null}
          {mode === 'available' || mode === 'active' || mode === 'completed' || mode === 'cancelled' ? (
            <OperationsMapJourneySuggestions
              suggestions={journeySuggestions}
              onCreateJourney={(ids) => {
                setSelectedQuoteIds(new Set(ids))
                addSelectionToPlannerFromIds(ids)
              }}
              onAddToPlanner={(ids) => {
                setSelectedQuoteIds(new Set(ids))
                addSelectionToPlannerFromIds(ids)
              }}
            />
          ) : null}
        </div>

        {(drawerQuote || drawerJourney || drawerDriver) && (
          <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-900/[0.05] lg:w-[340px]">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Selection</h3>
              <button
                type="button"
                onClick={() => {
                  setDrawerQuoteId('')
                  setDrawerJourneyId('')
                  setDrawerDriverId('')
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            {drawerQuote ? (
              <div className="mt-3 space-y-3">
                <p className="font-mono text-xs font-bold text-brand-700">{quoteJobRef(drawerQuote)}</p>
                <p className="text-lg font-bold text-slate-900">{String(drawerQuote.full_name || '').trim() || '—'}</p>
                {drawerJobMeta ? (
                  <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    <div>
                      <dt className="font-semibold text-slate-500">Date / time</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">{drawerJobMeta.dateTime}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Volume</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">{drawerJobMeta.volume}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Customer total</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">{drawerJobMeta.customer}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Marketplace payout</dt>
                      <dd className="mt-0.5 font-medium text-emerald-800">{drawerJobMeta.payout}</dd>
                    </div>
                    {coordsByQuoteId[String(drawerQuote.id)]?.pickup &&
                    coordsByQuoteId[String(drawerQuote.id)]?.delivery ? (
                      drawerJobMeta.drivePickupToDelivery ? (
                        <div>
                          <dt className="font-semibold text-slate-500">Colectare → livrare (condus)</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">
                            {drawerJobMeta.drivePickupToDelivery.timeLabel} ·{' '}
                            {drawerJobMeta.drivePickupToDelivery.milesLabel}
                          </dd>
                          <dd className="mt-0.5 text-[10px] font-normal leading-snug text-slate-500">
                            Estimativ Mapbox (condus); fără trafic în timp real.
                          </dd>
                        </div>
                      ) : directionsBusy ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
                          Se încarcă ruta și timpul între colectare și livrare…
                        </div>
                      ) : (
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                          Rută rutieră indisponibilă (token / Directions). Pinurile rămân pe hartă.
                        </div>
                      )
                    ) : null}
                  </dl>
                ) : null}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup</p>
                  <p className="text-xs text-slate-700">{String(drawerQuote.pickup_address || '—')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Delivery</p>
                  <p className="text-xs text-slate-700">{String(drawerQuote.delivery_address || '—')}</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    to={`/admin/available-jobs/${encodeURIComponent(String(drawerQuote.id))}`}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    View details
                  </Link>
                  <button
                    type="button"
                    onClick={() => openJobAssignmentTab(String(drawerQuote.id))}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Assign driver
                  </button>
                  <button
                    type="button"
                    onClick={() => openJobAssignmentTab(String(drawerQuote.id))}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    Send to marketplace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleSelectQuote(String(drawerQuote.id))
                    }}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
                  >
                    {selectedQuoteIds.has(String(drawerQuote.id)) ? 'Remove from selection' : 'Add to Journey Planner'}
                  </button>
                </div>
              </div>
            ) : null}
            {drawerJourney ? (
              <div className="mt-3 space-y-3">
                <p className="font-mono text-xs font-bold text-violet-700">
                  {drawerJourney.journey_ref != null ? String(drawerJourney.journey_ref) : String(drawerJourney.id).slice(0, 8)}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {(drawerJourney.summary_title && String(drawerJourney.summary_title)) ||
                    (drawerJourney.title && String(drawerJourney.title)) ||
                    'Journey'}
                </p>
                <Link
                  to={`/admin/journey-planner?journey=${encodeURIComponent(String(drawerJourney.id))}`}
                  className="mt-2 block rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Open journey planner
                </Link>
              </div>
            ) : null}
            {drawerDriver ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p className="text-lg font-bold text-slate-900">{String(drawerDriver.name || '')}</p>
                <p className="text-xs text-slate-500">{String(drawerDriver.email || '')}</p>
                {(() => {
                  const live = liveByDriverKey[String(drawerDriver.id)] || null
                  const assigned = activeQuotesForMap.filter(
                    (q) =>
                      String(q.assigned_driver_name || '')
                        .trim()
                        .toLowerCase() === String(drawerDriver.name || '').trim().toLowerCase(),
                  )
                  const etaEntry = etaByDriverId[String(drawerDriver.id)]
                  const pres = driverDispatchPresentation(
                    drawerDriver,
                    live,
                    assigned,
                    etaEntry?.label || etaEntry?.pickup?.label || '—',
                  )
                  const jobRefs = assigned.map((q) => quoteJobRef(q)).slice(0, 8).join(', ') || '—'
                  return (
                    <dl className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Status</dt>
                        <dd className="font-semibold text-slate-900">{pres.status}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Last GPS</dt>
                        <dd className="font-medium text-slate-800">{pres.updated}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">ETA</dt>
                        <dd className="font-medium text-slate-800">{pres.eta}</dd>
                      </div>
                      <div className="pt-1 text-slate-600">
                        <span className="font-semibold text-slate-700">Jobs:</span> {jobRefs}
                      </div>
                    </dl>
                  )
                })()}
                <p className="text-xs">
                  Live positions use driver registry <strong>id</strong> as{' '}
                  <code className="rounded bg-slate-100 px-1">driver_key</code> in Supabase.
                </p>
                <Link
                  to="/admin/drivers"
                  className="mt-2 inline-block rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Open drivers
                </Link>
              </div>
            ) : null}
          </aside>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 shadow-lg">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left sm:px-5"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Selection &amp; stats</span>
          <span className="text-xs font-semibold text-slate-300">{panelOpen ? 'Collapse' : 'Expand'}</span>
        </button>
        {panelOpen ? (
          <div className="border-t border-white/10 px-4 pb-4 pt-2 sm:px-5">
            <div className="flex flex-wrap gap-2">
              {[...selectedQuoteIds].map((id) => {
                const q = quotes.find((x) => String(x.id) === id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSelectQuote(id)}
                    className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                  >
                    {q ? quoteJobRef(q) : id.slice(0, 8)} ✕
                  </button>
                )
              })}
              {selectedQuoteIds.size === 0 ? (
                <p className="text-xs text-slate-400">Click jobs on the map and add them here for multi-stop planning.</p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectedQuoteIds.size === 0}
                onClick={addSelectionToPlanner}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
              >
                Build Journey ({selectedQuoteIds.size})
              </button>
              <button
                type="button"
                disabled={selectedQuoteIds.size === 0}
                onClick={() => setSelectedQuoteIds(new Set())}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
              >
                Clear selection
              </button>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="font-semibold text-slate-400">Jobs visible</dt>
                <dd className="mt-1 text-lg font-bold text-white">{stats.visibleJobs}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="font-semibold text-slate-400">
                  {mode === 'drivers' ? 'Drivers on map' : 'Active drivers (reg.)'}
                </dt>
                <dd className="mt-1 text-lg font-bold text-white">{stats.driversVisible}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="font-semibold text-slate-400">Journeys loaded</dt>
                <dd className="mt-1 text-lg font-bold text-white">{stats.journeysVisible}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="font-semibold text-slate-400">Straight-line miles (view)</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-300">{stats.totalMiles} mi</dd>
              </div>
              <div className="rounded-xl bg-amber-500/15 px-3 py-2 ring-1 ring-amber-400/30 sm:col-span-2 lg:col-span-1">
                <dt className="font-semibold text-amber-200">Warnings</dt>
                <dd className="mt-1 max-h-24 overflow-y-auto text-[11px] font-medium leading-snug text-amber-50">
                  {warnings.length ? (
                    <ul className="list-inside list-disc space-y-0.5">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    'No automated warnings.'
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  )
}
