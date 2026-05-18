import MobileQuoteMoveSummary from '../mobile/MobileQuoteMoveSummary'

/**
 * Mobile-only Step 4 review & payment (&lt; md).
 */
export default function MobileStep4Review({
  quoteRef,
  wizard,
  serviceType,
  breakdown,
  totalM3,
  crewSettings,
  onDistanceFromRoute,
}) {
  return (
    <div className="min-w-0 space-y-3 md:hidden">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Review &amp; payment</h2>
        <p className="mt-1 text-sm leading-snug text-slate-600">
          Check your move details, then pay securely to confirm your booking.
        </p>
      </div>

      <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white px-4 py-3 text-sm leading-snug text-sky-950 shadow-sm">
        <p className="font-semibold text-sky-900">Need to change something?</p>
        <p className="mt-1 text-sky-900/90">
          Go back to earlier steps to edit — your quote reference stays the same and your estimate
          updates when you return here.
        </p>
      </div>

      <MobileQuoteMoveSummary
        quoteRef={quoteRef}
        wizard={wizard}
        serviceType={serviceType}
        onDistanceFromRoute={onDistanceFromRoute}
        pickupLng={wizard.pickupLng}
        pickupLat={wizard.pickupLat}
        deliveryLng={wizard.deliveryLng}
        deliveryLat={wizard.deliveryLat}
        pickupAddress={wizard.pickupAddress}
        deliveryAddress={wizard.deliveryAddress}
        pickupPropertyType={wizard.pickupPropertyType}
        deliveryPropertyType={wizard.deliveryPropertyType}
        pickupFloor={wizard.pickupFloor}
        deliveryFloor={wizard.deliveryFloor}
        pickupLift={wizard.pickupLift}
        deliveryLift={wizard.deliveryLift}
        distanceMiles={wizard.distanceMiles}
        moveDate={wizard.moveDate}
        inventoryLines={wizard.inventoryLines}
        totalM3={totalM3}
        showPricing={false}
        breakdown={breakdown}
        crewSettings={crewSettings}
      />

    </div>
  )
}
