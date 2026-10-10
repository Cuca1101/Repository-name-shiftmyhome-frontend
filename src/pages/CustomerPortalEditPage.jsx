import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PortalAddressEditor from '../components/customer-portal/PortalAddressEditor'
import PortalShell, { usePortalAccess } from '../components/customer-portal/PortalShell'
import { commitPortalChange, getPortalBooking } from '../lib/customerPortalApi'
import { fetchDrivingRoute, geocodeAddress, metersToMiles } from '../lib/mapboxRouteApi'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { HALF_HOUR_SLOTS_TO_20, halfHourSlotsAfter } from '../lib/arrivalTimeSlots'
import {
  existingBalanceGbp,
  formatGbp,
  inventorySignature,
  jobModificationLock,
  londonTodayIso,
} from '../lib/customerPortalModel'
import {
  applyCustomerEdits,
  arrivalColumnsFromWizard,
  bookingChangeRows,
  catalogItems,
  hydratePortalWizard,
  portalAddressChanged,
  composePortalStop,
} from '../lib/customerPortalQuote'
import { previousChargeableTotal, pricePortalBooking } from '../lib/customerPortalPricing'
import { COMPANY_EMAIL, COMPANY_PHONE_DISPLAY, COMPANY_PHONE_TEL } from '../constants/companyContact'

export default function CustomerPortalEditPage() {
  const access = usePortalAccess()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [booking, setBooking] = useState(null)
  const [wizard, setWizard] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [serverView, setServerView] = useState(null)
  const [serverChanges, setServerChanges] = useState(null)
  const [routeMiles, setRouteMiles] = useState(null)
  const [routeNote, setRouteNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const dirtyRef = useRef(false)
  const addressMode = location.hash === '#portal-edit-addresses'

  useEffect(() => {
    let cancelled = false
    if (access.mode === 'anonymous') return undefined
    Promise.all([getPortalBooking(id, access), fetchPricingSettings().catch(() => null)])
      .then(([payload, pricing]) => {
        if (cancelled) return
        const next = hydratePortalWizard(payload.booking)
        setBooking(payload.booking)
        setWizard(next)
        setBaseline(next)
        setSettings(pricing)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not open this booking.')
      })
    return () => {
      cancelled = true
    }
  }, [id, access.mode, access.customerId])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash || !wizard) return
    document.getElementById(hash)?.scrollIntoView({ block: 'start' })
  }, [location.hash, wizard])

  useEffect(() => {
    function onLeave(event) {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    function onClick(event) {
      const link = event.target.closest('a[href]')
      if (!link || !dirtyRef.current) return
      if (link.getAttribute('href')?.startsWith('#')) return
      if (!window.confirm('Leave without saving these changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  useEffect(() => {
    if (!addressMode || !baseline || !wizard || !portalAddressChanged(baseline, wizard)) {
      setRouteMiles(null)
      setRouteNote('')
      return undefined
    }
    const sameRoute = stopQuery(baseline, 'pickup') === stopQuery(wizard, 'pickup')
      && stopQuery(baseline, 'delivery') === stopQuery(wizard, 'delivery')
    if (sameRoute) {
      setRouteMiles(null)
      setRouteNote('')
      return undefined
    }
    const token = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
    if (!token) {
      setRouteNote('The driving route will be checked when you review the change.')
      return undefined
    }
    let cancelled = false
    setRouteNote('Checking the route…')
    const timer = window.setTimeout(async () => {
      const pickup = await geocodeAddress(stopQuery(wizard, 'pickup'), token)
      const delivery = await geocodeAddress(stopQuery(wizard, 'delivery'), token)
      const route = pickup && delivery ? await fetchDrivingRoute(pickup, delivery, token) : null
      if (cancelled) return
      if (!route || !(Number(route.distanceMeters) > 0)) {
        setRouteMiles(null)
        setRouteNote('We could not place this route yet. You can still review it before saving.')
        return
      }
      setRouteMiles(metersToMiles(route.distanceMeters))
      setRouteNote('')
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [addressMode, baseline, wizard])

  const lock = booking ? jobModificationLock(booking) : null
  const serviceType = booking?.service_type || booking?.service || 'House Removals'
  const previous = booking ? previousChargeableTotal(booking) : null
  const addressDirty = Boolean(baseline && wizard && portalAddressChanged(baseline, wizard))
  const scheduleDirty = Boolean(
    baseline && wizard && (
      baseline.moveDate !== wizard.moveDate
      || arrivalColumnsFromWizard(baseline).arrivalWindow !== arrivalColumnsFromWizard(wizard).arrivalWindow
      || inventorySignature(baseline.inventoryLines) !== inventorySignature(wizard.inventoryLines)
    ),
  )
  dirtyRef.current = addressMode ? addressDirty : scheduleDirty

  const localPrice = useMemo(() => {
    if (!settings || !wizard) return null
    const pricedWizard = addressMode
      ? { ...wizard, distanceMiles: routeMiles != null ? routeMiles : baseline?.distanceMiles }
      : wizard
    return pricePortalBooking({ settings, serviceType, wizard: pricedWizard })
  }, [settings, serviceType, wizard, addressMode, routeMiles, baseline])

  const localView = localPrice && previous != null && (!addressMode || routeMiles != null)
    ? {
        previousTotal: previous,
        nextTotal: localPrice.total,
        delta: Math.round((localPrice.total - previous) * 100) / 100,
        existingBalance: existingBalanceGbp(booking, previous),
        chargeGbp: Math.max(0, Math.round((localPrice.total - previous) * 100) / 100),
      }
    : null
  const shown = serverView || localView

  const changes = serverChanges || (baseline && wizard
    ? bookingChangeRows(
        {
          dateLabel: baseline.moveDate,
          arrivalLabel: arrivalColumnsFromWizard(baseline).arrivalWindow,
          lines: baseline.inventoryLines,
          total: shown?.previousTotal ?? previous ?? 0,
          pickupLabel: addressMode ? stopLabel(baseline, 'pickup') : '',
          deliveryLabel: addressMode ? stopLabel(baseline, 'delivery') : '',
          miles: addressMode ? Number(baseline.distanceMiles) || 0 : undefined,
        },
        {
          dateLabel: wizard.moveDate,
          arrivalLabel: arrivalColumnsFromWizard(wizard).arrivalWindow,
          lines: wizard.inventoryLines,
          total: shown?.nextTotal ?? previous ?? 0,
          pickupLabel: addressMode ? stopLabel(wizard, 'pickup') : '',
          deliveryLabel: addressMode ? stopLabel(wizard, 'delivery') : '',
          miles: addressMode ? Number(routeMiles ?? baseline.distanceMiles) || 0 : undefined,
        },
      )
    : [])

  function clearReview() {
    setServerView(null)
    setServerChanges(null)
    setNotice('')
  }

  function patchWizard(partial) {
    clearReview()
    setWizard((current) => ({ ...current, ...partial }))
  }

  function onAddressChange(updater) {
    clearReview()
    setWizard(updater)
  }

  function setQty(index, quantity) {
    clearReview()
    setWizard((current) => {
      const inventoryLines = current.inventoryLines.map((line, i) => (
        i === index ? { ...line, quantity } : line
      )).filter((line) => line.quantity > 0)
      return { ...current, inventoryLines }
    })
  }

  function addItem(item) {
    clearReview()
    setWizard((current) => {
      const inventoryLines = [...(current.inventoryLines || [])]
      const found = inventoryLines.findIndex((line) => String(line.name).toLowerCase() === String(item.name).toLowerCase())
      if (found >= 0) inventoryLines[found] = { ...inventoryLines[found], quantity: Number(inventoryLines[found].quantity) + 1 }
      else inventoryLines.push({ ...item, quantity: 1, m3: item.m3, mult: item.mult || 1 })
      return { ...current, inventoryLines }
    })
  }

  async function confirmChange() {
    if (!wizard || !booking) return
    const edited = applyCustomerEdits(baseline, addressMode ? { ...wizard, addressEdit: true } : wizard)
    if (!edited.ok) {
      setError(edited.error)
      return
    }
    setSaving(true)
    setError('')
    try {
      const expected = serverView ? serverView.nextTotal : (addressMode ? null : localPrice?.total)
      const body = {
        moveDate: wizard.moveDate,
        arrivalWindow: wizard.arrivalWindow,
        exactArrivalTime: wizard.exactArrivalTime,
        flexibleArrivalFrom: wizard.flexibleArrivalFrom,
        flexibleArrivalUntil: wizard.flexibleArrivalUntil,
        inventoryLines: wizard.inventoryLines,
      }
      if (addressMode) {
        Object.assign(body, {
          addressEdit: true,
          pickupAddress: wizard.pickupAddress,
          pickupHouseNumber: wizard.pickupHouseNumber,
          pickupStreet: wizard.pickupStreet,
          pickupTown: wizard.pickupTown,
          pickupPostcode: wizard.pickupPostcode,
          pickupFlatDetails: wizard.pickupFlatDetails,
          deliveryAddress: wizard.deliveryAddress,
          deliveryHouseNumber: wizard.deliveryHouseNumber,
          deliveryStreet: wizard.deliveryStreet,
          deliveryTown: wizard.deliveryTown,
          deliveryPostcode: wizard.deliveryPostcode,
          deliveryFlatDetails: wizard.deliveryFlatDetails,
        })
      }
      const result = await commitPortalChange(id, body, expected, access)
      if (result?.preview && result.decision) {
        setServerView(result.decision)
        setServerChanges(result.changes || null)
        setNotice(addressMode
          ? 'Check the old and new addresses, then confirm.'
          : 'The price was recalculated. Check the new total, then confirm again.')
        return
      }
      if (result?.checkoutUrl) {
        dirtyRef.current = false
        window.location.assign(result.checkoutUrl)
        return
      }
      if (result?.decision?.outcome === 'pending_approval' || result?.status === 'pending_approval' || result?.status === 'paid_needs_review') {
        dirtyRef.current = false
        navigate(`/portal/bookings/${id}`, { replace: true, state: { pending: true } })
        return
      }
      if (result?.decision?.outcome === 'unavailable' || result?.decision?.outcome === 'blocked') {
        setError(reasonText(result.decision.reason))
        return
      }
      dirtyRef.current = false
      navigate(`/portal/bookings/${id}`, { replace: true })
    } catch (err) {
      setError(err?.message || 'Could not save the change.')
    } finally {
      setSaving(false)
    }
  }

  const matches = query.trim().length > 1
    ? catalogItems().filter((item) => String(item.name).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  return (
    <PortalShell
      title="Change booking | ShiftMyHome"
      description="Change the date or items on your ShiftMyHome booking."
      path={`/portal/bookings/${id || ''}/edit`}
    >
      <Link to={access.portalTo(`/portal/bookings/${id}`)} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800">
        Back to booking
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{addressMode ? 'Edit addresses' : 'Change booking'}</h1>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}
      {!wizard ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
      {lock?.contact ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm">
          <p>This booking has already started or finished. Contact the team to change it.</p>
          <a className="mt-2 block font-semibold text-brand-700" href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE_DISPLAY}</a>
          <a className="mt-1 block font-semibold text-brand-700" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
        </div>
      ) : null}
      {wizard && !lock?.locked ? (
        <div className="mt-4 space-y-4 pb-28 sm:pb-4">
          {addressMode ? (
            <PortalAddressEditor wizard={wizard} onChange={onAddressChange} />
          ) : (
            <>
          <label id="portal-edit-date" className="block scroll-mt-32 rounded-2xl bg-white p-4 text-sm">
            <span className="font-bold">Move date</span>
            <input
              type="date"
              min={londonTodayIso()}
              value={wizard.moveDate || ''}
              onChange={(event) => patchWizard({ moveDate: event.target.value })}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
            />
          </label>
          <fieldset className="rounded-2xl bg-white p-4 text-sm">
            <legend className="font-bold">Collection window</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className={`min-h-12 rounded-xl px-3 text-base ${wizard.arrivalWindow === 'flex_window' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => patchWizard({ arrivalWindow: 'flex_window' })}>Flexible</button>
              <button type="button" className={`min-h-12 rounded-xl px-3 text-base ${wizard.arrivalWindow === 'exact' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => patchWizard({ arrivalWindow: 'exact' })}>Exact time</button>
            </div>
            {wizard.arrivalWindow === 'exact' ? (
              <select className="mt-3 min-h-12 w-full rounded-xl border px-3 py-3 text-base" value={wizard.exactArrivalTime || ''} onChange={(event) => patchWizard({ exactArrivalTime: event.target.value })}>
                <option value="">Choose a time</option>
                {HALF_HOUR_SLOTS_TO_20.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className="min-h-12 rounded-xl border px-3 py-3 text-base" value={wizard.flexibleArrivalFrom || ''} onChange={(event) => patchWizard({ flexibleArrivalFrom: event.target.value })}>
                  <option value="">From</option>
                  {HALF_HOUR_SLOTS_TO_20.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                <select className="min-h-12 rounded-xl border px-3 py-3 text-base" value={wizard.flexibleArrivalUntil || ''} onChange={(event) => patchWizard({ flexibleArrivalUntil: event.target.value })}>
                  <option value="">Until</option>
                  {halfHourSlotsAfter(wizard.flexibleArrivalFrom).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </div>
            )}
          </fieldset>
          <section id="portal-edit-items" className="scroll-mt-32 rounded-2xl bg-white p-4">
            <h2 className="text-sm font-bold">Items</h2>
            <ul className="mt-3 space-y-2">
              {(wizard.inventoryLines || []).map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">{line.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button type="button" className="h-11 w-11 rounded-lg border text-base" onClick={() => setQty(index, Number(line.quantity) - 1)}>-</button>
                    <span className="w-6 text-center">{line.quantity}</span>
                    <button type="button" className="h-11 w-11 rounded-lg border text-base" onClick={() => setQty(index, Number(line.quantity) + 1)}>+</button>
                  </span>
                </li>
              ))}
            </ul>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Add an item"
              className="mt-3 min-h-12 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
            />
            {matches.length ? (
              <ul className="mt-2 space-y-1">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="min-h-11 w-full rounded-lg px-2 py-2 text-left text-base hover:bg-slate-50" onClick={() => { addItem(item); setQuery('') }}>
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
            </>
          )}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="font-bold">Review</h2>
            {routeNote ? <p className="mt-2 text-slate-600">{routeNote}</p> : null}
            {changes.length === 0 ? <p className="mt-2 text-slate-500">No changes yet.</p> : (
              <ul className="mt-2 space-y-3">
                {changes.map((row) => (
                  <li key={row.label} className="break-words">
                    <span className="flex items-center gap-2 font-semibold">
                      {row.label === 'Collection' || row.label === 'Delivery' ? (
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.label === 'Delivery' ? 'bg-[#059669]' : 'bg-[#ea580c]'}`} aria-hidden />
                      ) : null}
                      {row.label}
                    </span>
                    <span className="mt-1 block text-slate-500">Current: {row.previous}</span>
                    <span className="mt-1 block">New: {row.next}</span>
                  </li>
                ))}
              </ul>
            )}
            {shown ? (
              <div className="mt-3 space-y-1">
                <p>Previous price {formatGbp(shown.previousTotal)}</p>
                <p>New price {formatGbp(shown.nextTotal)}</p>
                <p>Difference {formatGbp(shown.delta)}</p>
                {shown.chargeGbp > 0 ? <p>Extra to pay now {formatGbp(shown.chargeGbp)}</p> : null}
                <p>Existing balance {formatGbp(shown.existingBalance)} stays separate.</p>
                {shown.outcome === 'pending_approval' ? <p className="font-bold">Pending approval. This is not confirmed yet.</p> : null}
              </div>
            ) : addressMode && addressDirty && !routeNote ? (
              <p className="mt-2 text-slate-600">The route is unchanged. The price stays the same.</p>
            ) : !addressMode ? (
              <p className="mt-2 text-slate-500">Price will appear once pricing settings load.</p>
            ) : null}
            <button
              type="button"
              disabled={saving || (addressMode ? !addressDirty : changes.length === 0)}
              onClick={confirmChange}
              className="mt-4 min-h-12 w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Checking…' : serverView?.outcome === 'pending_approval' ? 'Submit for approval' : serverView ? 'Confirm this price' : addressMode ? 'Review addresses' : 'Confirm change'}
            </button>
          </section>
        </div>
      ) : null}
    </PortalShell>
  )
}

function stopLabel(source, side) {
  return composePortalStop({
    houseNumber: source?.[`${side}HouseNumber`],
    street: source?.[`${side}Street`],
    town: source?.[`${side}Town`],
    flat: source?.[`${side}FlatDetails`],
    postcode: source?.[`${side}Postcode`],
    fallback: source?.[`${side}Address`],
  })
}

function stopQuery(wizard, side) {
  return composePortalStop({
    houseNumber: wizard[`${side}HouseNumber`],
    street: wizard[`${side}Street`],
    town: wizard[`${side}Town`],
    postcode: wizard[`${side}Postcode`],
    flat: '',
    fallback: wizard[`${side}Address`],
  })
}

function reasonText(reason) {
  if (reason === 'date_full') return 'That date is fully booked. Choose another day.'
  if (reason === 'date_past') return 'Choose today or a later date.'
  if (reason === 'started' || reason === 'completed') return 'This booking can no longer be changed online.'
  if (reason === 'no_change') return 'There is nothing to update.'
  return 'This change cannot be confirmed.'
}
