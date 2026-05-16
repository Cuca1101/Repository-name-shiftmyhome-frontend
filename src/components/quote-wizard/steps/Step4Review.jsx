import { useState } from 'react'
import QuoteStripePayment from '../QuoteStripePayment'
import { formatDateUK } from '../../../lib/formatDateDisplay'
import {
  formatWizardArrivalTitle,
  formatWizardServiceExtrasBlock,
} from '../../../lib/emailQuotePayload'

function SectionEditButton({ label, step, onGoToStep }) {
  return (
    <button
      type="button"
      onClick={() => onGoToStep(step)}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-brand-100 active:bg-brand-100 sm:min-h-[40px] sm:w-auto sm:shrink-0"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
        />
      </svg>
      <span>{label}</span>
    </button>
  )
}

export default function Step4Review({
  serviceType,
  quoteRef,
  wizard,
  breakdown,
  submitting,
  payLoading,
  payError,
  cardPayment,
  onClearCardPayment,
  onSubmit,
  onPay,
  onGoToStep,
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const combinedNotes = [
    wizard.stairsNotes && `Stairs/access: ${wizard.stairsNotes}`,
    wizard.heavyNotes && `Heavy items: ${wizard.heavyNotes}`,
    wizard.specialInstructions && `Instructions: ${wizard.specialInstructions}`,
  ]
    .filter(Boolean)
    .join('\n')

  const serviceExtrasText = formatWizardServiceExtrasBlock(wizard).trim()

  const busy = submitting || payLoading
  const cardFormOpen = Boolean(cardPayment?.clientSecret)

  function tryPay(kind) {
    if (!confirmed) {
      setConfirmError(
        'Please confirm that your details are correct before paying.',
      )
      return
    }
    setConfirmError('')
    onPay(kind)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Review & price</h2>
        <p className="mt-1 text-sm text-slate-600">
          Check everything looks right, then submit your enquiry or pay securely by card on this page. Your estimate uses
          live pricing from our admin settings.
        </p>
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm leading-relaxed text-sky-950">
          <p className="font-medium text-sky-900">Need to change something?</p>
          <p className="mt-1 text-sky-900/90">
            You can go back and edit your details before submitting — use the edit buttons on each section below. Your
            quote reference stays the same and your price updates automatically when you return to this step.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Addresses &amp; route</h3>
          <SectionEditButton label="Edit addresses & access" step={1} onGoToStep={onGoToStep} />
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-600">Quote ref</dt>
            <dd className="font-mono font-semibold text-brand-800">{quoteRef}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-600">Service</dt>
            <dd className="font-medium text-slate-900">{serviceType}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-600">Crew size</dt>
            <dd className="font-medium text-slate-900">
              {Number(wizard.crewSize) > 0
                ? `${Number(wizard.crewSize)} ${Number(wizard.crewSize) === 1 ? 'Man' : 'Men'}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-600">Pickup</dt>
            <dd className="mt-1 text-slate-900">{wizard.pickupAddress || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Delivery</dt>
            <dd className="mt-1 text-slate-900">{wizard.deliveryAddress || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-600">Distance</dt>
            <dd className="font-medium tabular-nums">
              {Number(wizard.distanceMiles) > 0 ? `${Number(wizard.distanceMiles).toFixed(1)} miles` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Move date</dt>
            <dd className="font-medium">{formatDateUK(wizard.moveDate)}</dd>
          </div>
          <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-slate-600">Arrival</dt>
            <dd className="max-w-[min(100%,20rem)] text-right font-medium leading-snug text-slate-900">
              {formatWizardArrivalTitle(wizard)}
            </dd>
          </div>
          {wizard.arrivalWindow === 'exact' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Exact time requests are subject to route availability.
            </p>
          )}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Inventory</h3>
          <SectionEditButton label="Edit inventory" step={2} onGoToStep={onGoToStep} />
        </div>
        {wizard.inventoryLines.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No items listed.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {wizard.inventoryLines.map((l) => (
              <li key={l.lineId} className="flex justify-between gap-2 py-2">
                <span className="text-slate-800">
                  {l.name} × {l.quantity}
                </span>
                <span className="tabular-nums text-slate-600">
                  {(l.quantity * l.m3 * (l.mult || 1)).toFixed(2)} m³
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm font-semibold text-brand-800">
          Total volume: {breakdown?.totalCubicMetres?.toFixed(2) ?? '0.00'} m³
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Details &amp; extras</h3>
          <SectionEditButton label="Edit details / extras" step={3} onGoToStep={onGoToStep} />
        </div>
        {serviceExtrasText ? (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {serviceExtrasText}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No packing / dismantling / reassembly requested.</p>
        )}
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Parking: {wizard.parkingDistance}</li>
          <li>Walking distance: {wizard.walkingDistance}</li>
          <li>Stairs (flights): {wizard.stairsFlights}</li>
        </ul>
        {combinedNotes && (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
            {combinedNotes}
          </pre>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-card ring-1 ring-emerald-100 sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Estimated price breakdown</h3>
        {breakdown ? (
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-slate-600">
                {breakdown.basePriceUsesPerManPricing &&
                breakdown.crewSizeUsedInPricing != null &&
                breakdown.basePricePerManUnit != null
                  ? `Base price (${breakdown.crewSizeUsedInPricing} × £${breakdown.basePricePerManUnit.toFixed(2)} per man)`
                  : 'Base price'}
              </span>
              <span className="tabular-nums font-medium">£{breakdown.basePrice.toFixed(2)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-slate-600">Distance</span>
              <span className="tabular-nums font-medium">£{breakdown.distancePrice.toFixed(2)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-slate-600">Volume</span>
              <span className="tabular-nums font-medium">£{breakdown.volumePrice.toFixed(2)}</span>
            </li>
            {breakdown.accessLines.map((l) => (
              <li key={l.label} className="flex justify-between gap-4">
                <span className="text-slate-600">{l.label}</span>
                <span className="tabular-nums font-medium">£{l.amount.toFixed(2)}</span>
              </li>
            ))}
            {breakdown.extrasLines.map((l) => (
              <li key={`e-${l.label}`} className="flex justify-between gap-4">
                <span className="text-slate-600">{l.label}</span>
                <span className="tabular-nums font-medium">£{l.amount.toFixed(2)}</span>
              </li>
            ))}
            {breakdown.surchargeLines.map((l) => (
              <li key={`s-${l.label}`} className="flex justify-between gap-4">
                <span className="text-slate-600">{l.label}</span>
                <span className="tabular-nums font-medium">£{l.amount.toFixed(2)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4 border-t border-emerald-100 pt-3 text-base font-bold text-slate-900">
              <span>Estimated total</span>
              <span className="text-emerald-700">£{breakdown.estimatedTotal.toFixed(2)}</span>
            </li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Calculating…</p>
        )}
        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          Total shown is a live estimate from what you've entered. We'll confirm the final amount with you before the
          move — typically after we've reviewed access and your inventory list.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <p className="text-sm font-semibold text-slate-900">Pay with card (secure)</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Pay here on this page — no redirect to another site. We recommend securing your move with the{' '}
          <strong className="font-semibold text-slate-800">£50 deposit</strong> first — your online estimate can change
          if anything was missed or incorrect. Pay the full estimated total only if you are confident everything is
          accurate.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked)
              setConfirmError('')
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            I confirm that all details provided are correct and I understand the price may change if information is
            missing or incorrect.
          </span>
        </label>
        {confirmError && <p className="mt-2 text-sm text-red-700">{confirmError}</p>}
        {payError && <p className="mt-2 text-sm text-red-700">{payError}</p>}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => tryPay('deposit')}
            disabled={busy || !breakdown || cardFormOpen}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 disabled:opacity-50 sm:min-h-[56px] sm:text-base"
          >
            {payLoading && !cardFormOpen
              ? 'Preparing secure form…'
              : 'Pay £50 deposit (recommended)'}
          </button>
          <button
            type="button"
            onClick={() => tryPay('full')}
            disabled={busy || !breakdown || cardFormOpen}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {payLoading && !cardFormOpen
              ? 'Preparing secure form…'
              : `Pay full estimated total (£${breakdown ? breakdown.estimatedTotal.toFixed(2) : '—'})`}
          </button>
          <p className="text-center text-xs text-slate-500">
            Full payment uses today&apos;s estimate only — choose deposit if the figure might change.
          </p>
        </div>

        {cardFormOpen && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-800">Enter card details</p>
            <QuoteStripePayment
              clientSecret={cardPayment.clientSecret}
              customerEmail={(wizard.email || '').trim()}
              amountLabel={cardPayment.amountLabel}
              onCancel={onClearCardPayment}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !breakdown}
        className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 py-4 text-base font-bold text-white shadow-lg transition hover:from-brand-700 hover:to-emerald-700 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Submit quote request'}
      </button>
    </div>
  )
}
