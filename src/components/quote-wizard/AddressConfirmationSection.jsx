import { Check, MapPin } from 'lucide-react'

/**
 * Step 3 address review — read-only display with confirm / edit actions.
 * Edit navigates to Step 1 via onGoToStep (existing wizard flow).
 */
export default function AddressConfirmationSection({
  data,
  onChange,
  onGoToStep,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile'
  const addressesConfirmed =
    Boolean(data.pickupAddressConfirmed) && Boolean(data.deliveryAddressConfirmed)
  const hasAddresses =
    data.pickupAddress?.trim().length > 2 && data.deliveryAddress?.trim().length > 2

  function confirmAddresses() {
    if (!hasAddresses) return
    onChange({
      ...data,
      pickupAddressConfirmed: true,
      deliveryAddressConfirmed: true,
    })
  }

  function editAddresses() {
    onChange({
      ...data,
      pickupAddressConfirmed: false,
      deliveryAddressConfirmed: false,
    })
    onGoToStep?.(1)
  }

  const shell = isMobile
    ? 'box-border min-w-0 w-full rounded-lg border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-2.5 shadow-sm ring-1 ring-emerald-100/60'
    : 'rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-sm ring-1 ring-emerald-100/60'

  const btnPrimary =
    'inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50'
  const btnConfirm = `${btnPrimary} border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 ${
    addressesConfirmed ? 'ring-2 ring-emerald-400/40' : ''
  }`
  const btnEdit = `${btnPrimary} border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50`

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Address confirmation</h3>
          <p className="mt-0.5 text-xs text-slate-600">Please confirm your addresses are correct</p>
        </div>
        {addressesConfirmed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Confirmed
          </span>
        ) : null}
      </div>

      <div
        className={
          isMobile
            ? 'mt-2.5 space-y-2'
            : 'mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3'
        }
      >
        <AddressRow label="Pickup address" address={data.pickupAddress} />
        <AddressRow label="Delivery address" address={data.deliveryAddress} />
      </div>

      <div className={`flex flex-col gap-2 ${isMobile ? 'mt-3' : 'mt-3 sm:flex-row'}`}>
        <button
          type="button"
          onClick={confirmAddresses}
          disabled={!hasAddresses || addressesConfirmed}
          className={btnConfirm}
          aria-pressed={addressesConfirmed}
        >
          {addressesConfirmed ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Addresses confirmed
            </>
          ) : (
            'Confirm addresses'
          )}
        </button>
        <button type="button" onClick={editAddresses} className={btnEdit}>
          Correct / Edit
        </button>
      </div>
    </div>
  )
}

function AddressRow({ label, address }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white/90 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 flex gap-1.5 text-sm leading-snug text-slate-800">
        <MapPin className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400`} aria-hidden />
        <span className={`min-w-0 flex-1 ${address?.trim() ? '' : 'text-slate-400'}`}>
          {address?.trim() || '—'}
        </span>
      </p>
    </div>
  )
}
