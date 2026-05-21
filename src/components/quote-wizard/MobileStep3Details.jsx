import { ClipboardList, Minus, Plus } from 'lucide-react'
import { reassemblySameAsDismantlingPatch } from '../../lib/quoteWizardReassembly'
import AddressConfirmationSection from './AddressConfirmationSection'
import PickupDeliveryContactsSection from './PickupDeliveryContactsSection'
import PackingMaterialsSection from './PackingMaterialsSection'
import QuoteWizardPhotosField from './QuoteWizardPhotosField'
import QuotePromoCodeField from './QuotePromoCodeField'

const card = 'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm'

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


/**
 * Mobile Step 3 details UI (&lt; md only).
 */
export default function MobileStep3Details({
  quoteRef,
  data,
  onChange,
  pricingSettings = null,
  onGoToStep,
  validationMessage,
  quotePhotoFiles = [],
  onQuotePhotosAdd,
  onQuotePhotoRemove,
  onQuotePhotosClear,
}) {
  const input =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
  const label = 'mb-1.5 block text-sm font-medium text-slate-700'

  const assemblyMode = !data.reassembly ? 'none' : data.reassemblySameAsDismantling ? 'same' : 'different'

  function set(patch) {
    onChange({ ...data, ...patch })
  }

  function setAssemblyMode(mode) {
    if (mode === 'none') {
      set({ reassembly: false, reassemblySameAsDismantling: false, reassemblyItemCount: 0 })
      return
    }
    if (mode === 'same') {
      set({
        reassembly: true,
        reassemblySameAsDismantling: true,
        ...reassemblySameAsDismantlingPatch({
          ...data,
          reassembly: true,
          reassemblySameAsDismantling: true,
        }),
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

      <div
        id="quote-wizard-contact-details-mobile"
        data-quote-field="contact-details"
        className={`${card} scroll-mt-24 p-3`}
      >
        <h3 className="text-sm font-bold text-slate-900">Your details</h3>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className={label}>Full name</span>
            <input
              id="quote-wizard-fullName-mobile"
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
              id="quote-wizard-phone-mobile"
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
              id="quote-wizard-email-mobile"
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

      <PickupDeliveryContactsSection data={data} onChange={onChange} variant="mobile" />

      <AddressConfirmationSection
        data={data}
        onChange={onChange}
        onGoToStep={onGoToStep}
        variant="mobile"
      />


      {validationMessage ? (
        <p
          className="quote-error rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
          role="alert"
          data-quote-error="true"
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
                      Object.assign(
                        patch,
                        reassemblySameAsDismantlingPatch({
                          ...data,
                          dismantlingItemCount: n,
                        }),
                      )
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
                  if (data.reassemblySameAsDismantling) {
                    Object.assign(
                      patch,
                      reassemblySameAsDismantlingPatch({ ...data, dismantlingWhat: v }),
                    )
                  }
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

      <PackingMaterialsSection
        data={data}
        onChange={onChange}
        pricingSettings={pricingSettings}
        variant="mobile"
      />

      <QuotePromoCodeField
        data={data}
        onChange={onChange}
        pricingSettings={pricingSettings}
        variant="mobile"
      />

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

      <QuoteWizardPhotosField
        variant="mobile"
        inputId="quote-wizard-photos-mobile"
        files={quotePhotoFiles}
        onAddFiles={onQuotePhotosAdd}
        onRemoveAt={onQuotePhotoRemove}
        onClearAll={onQuotePhotosClear}
      />

    </div>
  )
}

