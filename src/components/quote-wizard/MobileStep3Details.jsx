import { useMemo, useState } from 'react'
import { Check, ClipboardList, MapPin, Minus, Plus } from 'lucide-react'
import MapboxAddressField from './MapboxAddressField'

const card = 'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm'
const HAS_MAPBOX = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

const PACKING_MATERIALS = [
  { id: 'boxes', label: 'Moving boxes', unit: 'boxes', useApproxBoxes: true },
  { id: 'bubble', label: 'Bubble wrap', unit: 'rolls' },
  { id: 'paper', label: 'Packing paper', unit: 'packs' },
  { id: 'tape', label: 'Tape', unit: 'rolls' },
  { id: 'mattress', label: 'Mattress covers', unit: 'covers' },
]

function parseMaterialQuantities(data) {
  const q = { boxes: 0, bubble: 0, paper: 0, tape: 0, mattress: 0 }
  q.boxes = Math.max(0, Number(data.packingApproxBoxes) || 0)
  const text = (data.packingWhat || '').trim()
  if (!text) return q
  for (const line of text.split('\n')) {
    const m = line.match(/^(.+?):\s*(\d+)/i)
    if (!m) continue
    const label = m[1].toLowerCase()
    const n = parseInt(m[2], 10) || 0
    if (label.includes('bubble')) q.bubble = n
    else if (label.includes('paper')) q.paper = n
    else if (label.includes('tape')) q.tape = n
    else if (label.includes('mattress')) q.mattress = n
    else if (label.includes('box')) q.boxes = n
  }
  return q
}

function buildPackingWhatFromQuantities(quantities) {
  return PACKING_MATERIALS.filter((m) => (quantities[m.id] || 0) > 0)
    .map((m) => `${m.label}: ${quantities[m.id]} ${m.unit}`)
    .join('\n')
}

function QtyStepper({ value, onChange, disabled }) {
  const n = Math.max(0, Number(value) || 0)
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={disabled || n <= 0}
        onClick={() => onChange(n - 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 disabled:opacity-40 active:scale-95"
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-slate-900">{n}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(n + 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 active:scale-95"
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function YesNoChoice({ value, onChange }) {
  return (
    <div className="mt-2 flex gap-2">
      {[
        { v: false, label: 'No' },
        { v: true, label: 'Yes' },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          role="radio"
          aria-checked={value === opt.v}
          onClick={() => onChange(opt.v)}
          className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.98] ${
            value === opt.v
              ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function MobileAddressCard({
  title,
  address,
  confirmed,
  editing,
  onConfirm,
  onEdit,
  onDoneEdit,
  addressProps,
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {confirmed && !editing ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Confirmed
          </span>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          {HAS_MAPBOX ? (
            <MapboxAddressField {...addressProps} />
          ) : (
            <textarea
              rows={3}
              value={addressProps.address}
              onChange={(e) =>
                addressProps.onChange({
                  ...addressProps.data,
                  [addressProps.addressKey]: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
              placeholder="Full address"
            />
          )}
          <button
            type="button"
            onClick={onDoneEdit}
            className="w-full min-h-[40px] rounded-xl bg-slate-900 text-sm font-semibold text-white"
          >
            Done editing
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-sm leading-snug text-slate-800">{address || '—'}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmed || !address?.trim()}
              className="min-h-[40px] flex-1 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 disabled:opacity-50"
            >
              Confirm correct
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="min-h-[40px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  )
}


/**
 * Mobile Step 3 details UI (&lt; md only).
 */
export default function MobileStep3Details({
  quoteRef,
  data,
  onChange,
  validationMessage,
}) {
  const input =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
  const label = 'mb-1.5 block text-sm font-medium text-slate-700'

  const [pickupEditing, setPickupEditing] = useState(false)
  const [deliveryEditing, setDeliveryEditing] = useState(false)

  const materialQty = useMemo(() => parseMaterialQuantities(data), [data.packingApproxBoxes, data.packingWhat])

  const assemblyMode = !data.reassembly ? 'none' : data.reassemblySameAsDismantling ? 'same' : 'different'

  function set(patch) {
    onChange({ ...data, ...patch })
  }

  function patchAddress(which, patch) {
    const confirmKey = which === 'pickup' ? 'pickupAddressConfirmed' : 'deliveryAddressConfirmed'
    onChange({ ...data, ...patch, [confirmKey]: false })
  }

  function setMaterialQty(id, qty) {
    const next = { ...materialQty, [id]: Math.max(0, qty) }
    const any = Object.values(next).some((v) => v > 0)
    set({
      packingApproxBoxes: next.boxes,
      packingMaterials: any,
      packingWhat: buildPackingWhatFromQuantities(next),
    })
  }

  function setAssemblyMode(mode) {
    if (mode === 'none') {
      set({ reassembly: false, reassemblySameAsDismantling: false })
      return
    }
    if (mode === 'same') {
      set({
        reassembly: true,
        reassemblySameAsDismantling: true,
        reassemblyItemCount: data.dismantlingItemCount ?? 0,
        reassemblyWhat: data.dismantlingWhat ?? '',
      })
      return
    }
    set({ reassembly: true, reassemblySameAsDismantling: false })
  }

  function setDismantlingYes(yes) {
    if (!yes) {
      set({
        dismantling: false,
        dismantlingItemCount: 0,
        dismantlingWhat: '',
        ...(data.reassemblySameAsDismantling
          ? { reassembly: false, reassemblySameAsDismantling: false }
          : {}),
      })
      return
    }
    set({ dismantling: true })
  }

  return (
    <div className="min-w-0 space-y-3 md:hidden">
      <div className={`${card} flex items-center gap-3 p-3`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <ClipboardList className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quote reference</p>
          <p className="truncate font-mono text-sm font-bold text-brand-800">{quoteRef}</p>
        </div>
      </div>

      <div className={`${card} p-3`}>
        <h3 className="text-sm font-bold text-slate-900">Your details</h3>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className={label}>Full name</span>
            <input
              required
              autoComplete="name"
              value={data.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Phone number</span>
            <input
              required
              type="tel"
              autoComplete="tel"
              value={data.phone}
              onChange={(e) => set({ phone: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Email address</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(e) => set({ email: e.target.value })}
              className={input}
            />
          </label>
        </div>
      </div>

      <div className={`${card} p-3`}>
        <h3 className="text-sm font-bold text-slate-900">Address confirmation</h3>
        <p className="mt-1 text-xs text-slate-600">Please confirm both addresses are correct.</p>
        <div className="mt-3 space-y-3">
          <MobileAddressCard
            title="Pickup address"
            address={data.pickupAddress}
            confirmed={Boolean(data.pickupAddressConfirmed)}
            editing={pickupEditing}
            onConfirm={() => set({ pickupAddressConfirmed: true })}
            onEdit={() => setPickupEditing(true)}
            onDoneEdit={() => setPickupEditing(false)}
            addressProps={{
              label: 'Pickup address',
              markerLetter: 'A',
              markerClassName: 'bg-brand-600',
              placeholder: 'Search pickup address',
              address: data.pickupAddress,
              lng: data.pickupLng,
              lat: data.pickupLat,
              addressKey: 'pickupAddress',
              lngKey: 'pickupLng',
              latKey: 'pickupLat',
              data,
              onChange: (next) => patchAddress('pickup', next),
            }}
          />
          <MobileAddressCard
            title="Delivery address"
            address={data.deliveryAddress}
            confirmed={Boolean(data.deliveryAddressConfirmed)}
            editing={deliveryEditing}
            onConfirm={() => set({ deliveryAddressConfirmed: true })}
            onEdit={() => setDeliveryEditing(true)}
            onDoneEdit={() => setDeliveryEditing(false)}
            addressProps={{
              label: 'Delivery address',
              markerLetter: 'B',
              markerClassName: 'bg-emerald-600',
              placeholder: 'Search delivery address',
              address: data.deliveryAddress,
              lng: data.deliveryLng,
              lat: data.deliveryLat,
              addressKey: 'deliveryAddress',
              lngKey: 'deliveryLng',
              latKey: 'deliveryLat',
              data,
              onChange: (next) => patchAddress('delivery', next),
            }}
          />
        </div>
      </div>

      {validationMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
          role="alert"
        >
          {validationMessage}
        </p>
      ) : null}

      <div className={`${card} p-3`}>
        <label className="block">
          <span className="text-sm font-bold text-slate-900">Special instructions</span>
          <textarea
            rows={3}
            value={data.specialInstructions}
            onChange={(e) => set({ specialInstructions: e.target.value })}
            className={`${input} mt-2`}
            placeholder="e.g. fragile items, narrow access, parking restrictions…"
          />
        </label>
      </div>

      <div className={`${card} p-3`}>
        <p className="text-sm font-bold text-slate-900">Do you need help dismantling furniture?</p>
        <YesNoChoice value={Boolean(data.dismantling)} onChange={setDismantlingYes} />
        {data.dismantling ? (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-sm font-medium text-slate-700">How many items need dismantling?</p>
              <div className="mt-2">
                <QtyStepper
                  value={data.dismantlingItemCount ?? 0}
                  onChange={(n) => {
                    const patch = { dismantlingItemCount: n }
                    if (data.reassemblySameAsDismantling) {
                      patch.reassemblyItemCount = n
                    }
                    set(patch)
                  }}
                />
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Which items need dismantling? (optional)</span>
              <input
                value={data.dismantlingWhat ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  const patch = { dismantlingWhat: v }
                  if (data.reassemblySameAsDismantling) patch.reassemblyWhat = v
                  set(patch)
                }}
                className={`${input} mt-1`}
                placeholder="e.g. wardrobe, bed frame, dining table"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className={`${card} p-3`}>
        <p className="text-sm font-bold text-slate-900">Do you need help assembling furniture?</p>
        <div className="mt-2 space-y-2">
          {[
            { id: 'none', label: 'No' },
            { id: 'same', label: 'Yes, same items as dismantling', disabled: !data.dismantling },
            { id: 'different', label: 'Yes, different items' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => setAssemblyMode(opt.id)}
              className={`flex w-full min-h-[44px] items-center rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
                assemblyMode === opt.id
                  ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {assemblyMode === 'different' ? (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-sm font-medium text-slate-700">How many items need assembling?</p>
              <div className="mt-2">
                <QtyStepper
                  value={data.reassemblyItemCount ?? 0}
                  onChange={(n) => set({ reassemblyItemCount: n })}
                />
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Which items need assembling?</span>
              <input
                value={data.reassemblyWhat ?? ''}
                onChange={(e) => set({ reassemblyWhat: e.target.value })}
                className={`${input} mt-1`}
                placeholder="e.g. wardrobe, bed frame, shelving unit"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className={`${card} p-3`}>
        <p className="text-sm font-bold text-slate-900">Do you need packing materials?</p>
        <p className="mt-1 text-xs text-slate-600">Select materials and set quantities. Use + / − to adjust.</p>
        <ul className="mt-3 space-y-2">
          {PACKING_MATERIALS.map((m) => {
            const qty = materialQty[m.id] || 0
            const selected = qty > 0
            return (
              <li
                key={m.id}
                className={`rounded-xl border p-3 transition ${
                  selected ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{m.label}</p>
                    <p className="text-[11px] text-slate-500">{m.unit}</p>
                  </div>
                  <QtyStepper value={qty} onChange={(n) => setMaterialQty(m.id, n)} />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className={`${card} p-3`}>
        <label className="block">
          <span className="text-sm font-bold text-slate-900">Anything else we should know?</span>
          <textarea
            rows={3}
            value={data.heavyNotes}
            onChange={(e) => set({ heavyNotes: e.target.value })}
            className={`${input} mt-2`}
            placeholder="e.g. valuable items, appliance disconnection, specific time notes…"
          />
        </label>
      </div>

    </div>
  )
}

