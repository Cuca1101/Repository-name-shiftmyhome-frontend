import { useEffect, useState } from 'react'
import { saveCustomerLeadMoveDetails } from '../../lib/customerLeadBookingConvert'
import { leadWizardSteps, moveDetailsFormFromLead } from '../../lib/customerLeadMoveSync'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { ARRIVAL_LABELS } from '../../lib/emailQuotePayload'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { floorNeedsLiftQuestion, formatAccessLiftLabel } from '../../lib/floorAccess'
import { FLOOR_OPTIONS, formatFloorLabel } from '../quote-wizard/FloorSelect'

const PROPERTY_TYPES = ['House', 'Flat / apartment', 'Bungalow', 'Commercial', 'Other']
const ARRIVAL_OPTIONS = ['flex', 'flex_window', 'morning', 'midday', 'evening', 'exact']

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal'
const labelClass = 'block text-sm font-semibold text-slate-800'
const secondaryBtn =
  'inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'
const primaryBtn =
  'inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50'

function InfoRow({ label, value }) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </div>
  )
}

function floorText(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? formatFloorLabel(n) : String(value)
}

/**
 * @param {{
 *   lead: Record<string, unknown>,
 *   disabled?: boolean,
 *   onSaved: (lead: Record<string, unknown>) => void,
 * }} props
 */
export default function CustomerLeadMoveDetailsEditor({ lead, disabled = false, onSaved }) {
  const { step1 } = leadWizardSteps(lead)
  const saved = moveDetailsFormFromLead(lead)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setEditing(false)
    setMessage('')
    setForm(moveDetailsFormFromLead(lead))
  }, [lead?.id])

  function patch(next) {
    setForm((current) => ({ ...current, ...next }))
    setMessage('')
  }

  function startEdit() {
    const ok = window.confirm('Are you sure you want to edit the move details?')
    if (!ok) return
    setForm(moveDetailsFormFromLead(lead))
    setMessage('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const result = await saveCustomerLeadMoveDetails({ lead, form })
      setEditing(false)
      setMessage(
        result.quoteUpdated
          ? 'Saved on this lead and on the booking. The saved price is unchanged.'
          : 'Saved on this lead. The saved price is unchanged.',
      )
      onSaved(result.lead)
    } catch (error) {
      setMessage(error?.message || 'Could not save the move details.')
    } finally {
      setSaving(false)
    }
  }

  const distanceMiles = Number(step1.distanceMiles)
  const distanceLabel = Number.isFinite(distanceMiles) && distanceMiles > 0 ? `${distanceMiles.toFixed(1)} miles` : ''
  const serviceOptions = SERVICE_TYPES.includes(form.serviceType) || !form.serviceType
    ? SERVICE_TYPES
    : [form.serviceType, ...SERVICE_TYPES]
  const arrivalOptions = ARRIVAL_OPTIONS.includes(form.arrivalWindow) || !form.arrivalWindow
    ? ARRIVAL_OPTIONS
    : [form.arrivalWindow, ...ARRIVAL_OPTIONS]
  const pickupFloor = form.pickupFloor === '' ? null : Number(form.pickupFloor)
  const deliveryFloor = form.deliveryFloor === '' ? null : Number(form.deliveryFloor)

  return (
    <section className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Move details</h3>
      {editing ? (
        <div className="mt-3 space-y-3">
          <label className={labelClass}>
            Service
            <select className={fieldClass} value={form.serviceType} disabled={saving} onChange={(event) => patch({ serviceType: event.target.value })}>
              <option value="">Choose service</option>
              {serviceOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Pickup
            <textarea className={fieldClass} rows={2} value={form.pickupAddress} disabled={saving} onChange={(event) => patch({ pickupAddress: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Pickup property
              <select className={fieldClass} value={form.pickupPropertyType} disabled={saving} onChange={(event) => patch({ pickupPropertyType: event.target.value })}>
                <option value="">Choose property</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Pickup floor
              <select className={fieldClass} value={form.pickupFloor} disabled={saving} onChange={(event) => patch({ pickupFloor: event.target.value })}>
                <option value="">Choose floor</option>
                {FLOOR_OPTIONS.map((floor) => (
                  <option key={floor.value} value={String(floor.value)}>{floor.label}</option>
                ))}
              </select>
            </label>
          </div>
          {floorNeedsLiftQuestion(pickupFloor) ? (
            <label className={labelClass}>
              Pickup lift
              <select className={fieldClass} value={form.pickupLift} disabled={saving} onChange={(event) => patch({ pickupLift: event.target.value })}>
                <option value="">Choose</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ) : null}
          <label className={labelClass}>
            Delivery
            <textarea className={fieldClass} rows={2} value={form.deliveryAddress} disabled={saving} onChange={(event) => patch({ deliveryAddress: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Delivery property
              <select className={fieldClass} value={form.deliveryPropertyType} disabled={saving} onChange={(event) => patch({ deliveryPropertyType: event.target.value })}>
                <option value="">Choose property</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Delivery floor
              <select className={fieldClass} value={form.deliveryFloor} disabled={saving} onChange={(event) => patch({ deliveryFloor: event.target.value })}>
                <option value="">Choose floor</option>
                {FLOOR_OPTIONS.map((floor) => (
                  <option key={floor.value} value={String(floor.value)}>{floor.label}</option>
                ))}
              </select>
            </label>
          </div>
          {floorNeedsLiftQuestion(deliveryFloor) ? (
            <label className={labelClass}>
              Delivery lift
              <select className={fieldClass} value={form.deliveryLift} disabled={saving} onChange={(event) => patch({ deliveryLift: event.target.value })}>
                <option value="">Choose</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ) : null}
          <label className={labelClass}>
            Move date
            <input type="date" className={fieldClass} value={form.moveDate} disabled={saving} onChange={(event) => patch({ moveDate: event.target.value })} />
          </label>
          <label className={labelClass}>
            Arrival
            <select className={fieldClass} value={form.arrivalWindow} disabled={saving} onChange={(event) => patch({ arrivalWindow: event.target.value })}>
              <option value="">Choose arrival</option>
              {arrivalOptions.map((key) => (
                <option key={key} value={key}>{ARRIVAL_LABELS[key] || key}</option>
              ))}
            </select>
          </label>
          {form.arrivalWindow === 'exact' ? (
            <label className={labelClass}>
              Exact time
              <input type="time" className={fieldClass} value={form.exactArrivalTime} disabled={saving} onChange={(event) => patch({ exactArrivalTime: event.target.value })} />
            </label>
          ) : null}
          {form.arrivalWindow === 'flex_window' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                From
                <input type="time" className={fieldClass} value={form.flexibleArrivalFrom} disabled={saving} onChange={(event) => patch({ flexibleArrivalFrom: event.target.value })} />
              </label>
              <label className={labelClass}>
                Until
                <input type="time" className={fieldClass} value={form.flexibleArrivalUntil} disabled={saving} onChange={(event) => patch({ flexibleArrivalUntil: event.target.value })} />
              </label>
            </div>
          ) : null}
          <InfoRow label="Distance (mi)" value={distanceLabel || null} />
          <p className="text-xs text-slate-500">Saving does not email the customer or change the saved price. Distance stays as it is.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={disabled || saving} onClick={() => void handleSave()} className={primaryBtn}>
              {saving ? 'Saving…' : 'Save move details'}
            </button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setMessage('') }} className={secondaryBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <InfoRow label="Service" value={step1.serviceType || lead.service_type} />
          <InfoRow label="Pickup" value={step1.pickupAddress || lead.pickup_address} />
          <InfoRow label="Pickup property" value={step1.pickupPropertyType} />
          <InfoRow label="Pickup floor" value={floorText(step1.pickupFloor)} />
          <InfoRow label="Pickup lift" value={formatAccessLiftLabel(step1.pickupFloor, step1.pickupLift)} />
          <InfoRow label="Delivery" value={step1.deliveryAddress || lead.delivery_address} />
          <InfoRow label="Delivery property" value={step1.deliveryPropertyType} />
          <InfoRow label="Delivery floor" value={floorText(step1.deliveryFloor)} />
          <InfoRow label="Delivery lift" value={formatAccessLiftLabel(step1.deliveryFloor, step1.deliveryLift)} />
          <InfoRow label="Move date" value={step1.moveDate ? formatDateUK(step1.moveDate) : null} />
          <InfoRow label="Arrival" value={step1.arrivalSummary} />
          <InfoRow label="Distance (mi)" value={distanceLabel || null} />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="button" disabled={disabled} onClick={startEdit} className={secondaryBtn}>
              Edit
            </button>
            {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          </div>
        </div>
      )}
      {editing && message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </section>
  )
}
