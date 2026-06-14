import { Check, MapPin } from 'lucide-react'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import {
  canConfirmDeliveryAddress,
  canConfirmPickupAddress,
  hasMapboxToken,
} from '../../lib/addressConfirmation'

/**
 * Step 3 address review — read-only display with per-address confirm / edit actions.
 * Edit navigates to Step 1 via onGoToStep (existing wizard flow).
 *
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (next: Record<string, unknown>) => void,
 *   onGoToStep?: (step: number) => void,
 *   variant?: 'desktop' | 'mobile',
 *   fieldErrors?: Record<string, string>,
 * }} props
 */
export default function AddressConfirmationSection({
  data,
  onChange,
  onGoToStep,
  variant = 'desktop',
  fieldErrors = {},
}) {
  const isMobile = variant === 'mobile'
  const pickupConfirmed = Boolean(data.pickupAddressConfirmed)
  const deliveryConfirmed = Boolean(data.deliveryAddressConfirmed)
  const addressesConfirmed = pickupConfirmed && deliveryConfirmed
  const canConfirmPickup = canConfirmPickupAddress(data, hasMapboxToken())
  const canConfirmDelivery = canConfirmDeliveryAddress(data, hasMapboxToken())

  function confirmPickup() {
    if (!canConfirmPickup || pickupConfirmed) return
    applyWizardPatch(onChange, { pickupAddressConfirmed: true })
  }

  function confirmDelivery() {
    if (!canConfirmDelivery || deliveryConfirmed) return
    applyWizardPatch(onChange, { deliveryAddressConfirmed: true })
  }

  function editAddresses() {
    applyWizardPatch(onChange, {
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
  const btnConfirm = `${btnPrimary} border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700`
  const btnConfirmDone = `${btnConfirm} ring-2 ring-emerald-400/40`
  const btnEdit = `${btnPrimary} border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50`

  const pickupError = fieldErrors.pickupAddressConfirmed
  const deliveryError = fieldErrors.deliveryAddressConfirmed

  return (
    <div
      className={shell}
      data-quote-field="address-confirmation"
      id="quote-wizard-address-confirmation"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Address confirmation</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Confirm each address is correct before creating the booking.
          </p>
        </div>
        {addressesConfirmed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Both confirmed
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
        <AddressRow
          label="Pickup address"
          address={data.pickupAddress}
          confirmed={pickupConfirmed}
          error={pickupError}
          canConfirm={canConfirmPickup}
          confirmLabel="Confirm pickup address"
          onConfirm={confirmPickup}
        />
        <AddressRow
          label="Delivery address"
          address={data.deliveryAddress}
          confirmed={deliveryConfirmed}
          error={deliveryError}
          canConfirm={canConfirmDelivery}
          confirmLabel="Confirm delivery address"
          onConfirm={confirmDelivery}
        />
      </div>

      <div className={`flex flex-col gap-2 ${isMobile ? 'mt-3' : 'mt-3 sm:flex-row'}`}>
        <button type="button" onClick={editAddresses} className={btnEdit}>
          Correct / Edit addresses
        </button>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   label: string,
 *   address: string | undefined,
 *   confirmed: boolean,
 *   error?: string,
 *   canConfirm: boolean,
 *   confirmLabel: string,
 *   onConfirm: () => void,
 * }} props
 */
function AddressRow({ label, address, confirmed, error, canConfirm, confirmLabel, onConfirm }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-slate-100 bg-white/90 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 flex gap-1.5 text-sm leading-snug text-slate-800">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className={`min-w-0 flex-1 ${address?.trim() ? '' : 'text-slate-400'}`}>
          {address?.trim() || '—'}
        </span>
      </p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!canConfirm || confirmed}
        className={`mt-2 ${confirmed ? 'btnConfirmDone' : ''} inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          confirmed
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
            : 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
        aria-pressed={confirmed}
      >
        {confirmed ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Confirmed
          </>
        ) : (
          confirmLabel
        )}
      </button>
      {!canConfirm && !confirmed && address?.trim() ? (
        <p className="mt-1.5 text-[10px] leading-snug text-amber-800">
          {hasMapboxToken()
            ? 'Enter a full address on step 1 (at least 8 characters), or choose a suggestion.'
            : 'Enter a full address before confirming.'}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
