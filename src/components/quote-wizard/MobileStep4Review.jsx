import MobileQuoteMoveSummary from '../mobile/MobileQuoteMoveSummary'
import MobileStepTitleWithRef from './MobileStepTitleWithRef'

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
    <div data-quote-step="4" className="box-border min-w-0 w-full space-y-1.5 md:hidden">
      <div>
        <MobileStepTitleWithRef
          title="Review & payment"
          quoteRef={quoteRef}
          titleClassName="md:text-lg"
        />
        <p className="mt-1 text-xs leading-snug text-slate-600 md:text-sm">
          Check your move details, then pay securely to confirm your booking.
        </p>
      </div>

      <div className="rounded-lg border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white px-3 py-2.5 text-xs leading-snug text-sky-950 shadow-sm md:rounded-2xl md:px-4 md:py-3 md:text-sm">
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
        showPricing
        breakdown={breakdown}
        crewSettings={crewSettings}
      />

    </div>
  )
}
