import MobileStep3Details from '../MobileStep3Details'
import AddressConfirmationSection from '../AddressConfirmationSection'
import PickupDeliveryContactsSection from '../PickupDeliveryContactsSection'
import PackingMaterialsSection from '../PackingMaterialsSection'
import DesktopFurnitureServicesSection from '../DesktopFurnitureServicesSection'
import QuoteWizardPhotosField from '../QuoteWizardPhotosField'

export default function Step3Details({
  data,
  onChange,
  onGoToStep,
  quotePhotoFiles,
  onQuotePhotosAdd,
  onQuotePhotoRemove,
  onQuotePhotosClear,
  quoteRef,
  validationMessage = '',
}) {
  const input =
    'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const label = 'mb-1.5 block text-sm font-medium text-slate-700'

  function set(k, v) {
    onChange({ ...data, [k]: v })
  }

  return (
    <>
      <MobileStep3Details
        quoteRef={quoteRef}
        data={data}
        onChange={onChange}
        onGoToStep={onGoToStep}
        validationMessage={validationMessage}
        quotePhotoFiles={quotePhotoFiles}
        onQuotePhotosAdd={onQuotePhotosAdd}
        onQuotePhotoRemove={onQuotePhotoRemove}
        onQuotePhotosClear={onQuotePhotosClear}
      />

      <div className="hidden space-y-10 md:block">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">Job details & contact</h2>
        <p className="mt-1 text-sm text-slate-600">
          Extras, access notes, and how we reach you â€” weâ€™ll only use your details for this quote.
        </p>
      </div>

      <div
        id="quote-wizard-contact-details-desktop"
        className="scroll-mt-24 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/40 to-white p-5 sm:p-6"
      >
        <h3 className="text-sm font-bold text-slate-900">Your details</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 xxs:gap-4">
          <label className="block sm:col-span-2">
            <span className={label}>Full name</span>
            <input
              id="quote-wizard-fullName-desktop"
              required
              autoComplete="name"
              value={data.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Phone</span>
            <input
              id="quote-wizard-phone-desktop"
              required
              type="tel"
              autoComplete="tel"
              value={data.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <input
              id="quote-wizard-email-desktop"
              required
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(e) => set('email', e.target.value)}
              className={input}
            />
          </label>
        </div>
      </div>

      <PickupDeliveryContactsSection data={data} onChange={onChange} variant="desktop" />

      <AddressConfirmationSection
        data={data}
        onChange={onChange}
        onGoToStep={onGoToStep}
        variant="desktop"
      />


      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Special instructions</h3>
        <label className="mt-3 block">
          <span className="sr-only">Special instructions</span>
          <textarea
            rows={3}
            value={data.specialInstructions}
            onChange={(e) => set('specialInstructions', e.target.value)}
            className={input}
            placeholder="e.g. fragile items, narrow access, parking restrictions…"
          />
        </label>
      </div>

      <div className="space-y-4">
        <DesktopFurnitureServicesSection
          data={data}
          onChange={onChange}
          input={input}
          label={label}
        />
      </div>

      <PackingMaterialsSection data={data} onChange={onChange} variant="desktop" />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Anything else we should know?</h3>
        <p className="mt-1 text-sm text-slate-600">
          Access restrictions, timing notes, fragile items, concierge access, parking details, or anything
          important for the movers.
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Anything else we should know</span>
          <textarea
            rows={3}
            value={data.heavyNotes}
            onChange={(e) => set('heavyNotes', e.target.value)}
            className={input}
            placeholder="e.g. valuable items, appliance disconnection, specific time notes…"
          />
        </label>
      </div>

      <QuoteWizardPhotosField
        variant="desktop"
        inputId="quote-wizard-photos-desktop"
        files={quotePhotoFiles}
        onAddFiles={onQuotePhotosAdd}
        onRemoveAt={onQuotePhotoRemove}
        onClearAll={onQuotePhotosClear}
      />
    </div>
    </>
  )
}
