import QuoteReviewPriceCalendar from './QuoteReviewPriceCalendar'

import Step3Details from './steps/Step3Details'



/**

 * Step 3 — choose date/price slot and optional move extras (payment is Step 4).

 */

export default function Step3ReviewLayout({

  quoteRef,

  wizard,

  onWizardChange,

  breakdown,

  serviceType,

  settings,

  lineItems,

  heavyItemCount,

  onGoToStep,

}) {

  const calendarProps = {

    wizard,

    onWizardChange,

    breakdown,

    pricingSettings: settings,

    serviceType,

    lineItems,

    heavyItemCount,

    compact: true,

    showSelectedTotal: false,

  }



  return (

    <div data-quote-step="3" className="min-w-0 max-w-full space-y-3 overflow-x-hidden md:space-y-4">

      <header className="min-w-0">

        <h2 className="text-lg font-bold text-slate-900 md:text-2xl">Review your move</h2>

        <p className="mt-1 text-xs leading-snug text-slate-600 md:text-sm">

          Pick your preferred date, add any extras, then continue to confirm and pay.

        </p>

        <p className="mt-1 font-mono text-[10px] font-semibold text-brand-800 md:text-xs">

          {quoteRef}

        </p>

      </header>



      <QuoteReviewPriceCalendar {...calendarProps} />



      <Step3Details

        data={wizard}

        onChange={onWizardChange}

        pricingSettings={settings}

        onGoToStep={onGoToStep}

        quoteRef={quoteRef}

        hideContactSection

      />

    </div>

  )

}

