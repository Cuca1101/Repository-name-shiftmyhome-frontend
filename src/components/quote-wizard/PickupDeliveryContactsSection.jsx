import { resolveDeliveryContact, resolvePickupContact } from '../../lib/quoteWizardContactFields'
import { quoteMobileInput, quoteMobileLabel } from '../../lib/quoteMobileUiClasses'

/**
 * Step 3 — pickup & delivery contact toggles and optional alternate contacts.
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (patch: Record<string, unknown>) => void,
 *   variant?: 'mobile' | 'desktop',
 * }} props
 */
export default function PickupDeliveryContactsSection({ data, onChange, variant = 'desktop' }) {
  const isMobile = variant === 'mobile'
  const input = isMobile
    ? quoteMobileInput
    : 'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const label = isMobile ? quoteMobileLabel : 'mb-1.5 block text-sm font-medium text-slate-700'
  const card = isMobile
    ? 'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

  const pickupSame = data.pickupContactSameAsCustomer !== false
  const deliverySame = data.deliveryContactSameAsCustomer !== false

  function set(patch) {
    onChange({ ...data, ...patch })
  }

  const pickupResolved = resolvePickupContact(data)
  const deliveryResolved = resolveDeliveryContact(data)

  return (
    <div className={card}>
      <h3 className={`font-bold text-slate-900 ${isMobile ? 'text-xs' : 'text-sm'}`}>Pickup &amp; delivery contacts</h3>
      <p className={`mt-1 leading-relaxed text-slate-600 ${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
        Who should our crew contact at each address? By default we use your booking details.
      </p>
      <div className={`${isMobile ? 'mt-2 space-y-2' : 'mt-4 space-y-3'}`}>
        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 ${
            isMobile ? 'min-h-[40px] p-2.5' : 'min-h-[48px] gap-3 rounded-xl p-4'
          }`}
        >
          <input
            id="pickup-contact-same"
            type="checkbox"
            checked={pickupSame}
            onChange={(e) => set({ pickupContactSameAsCustomer: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium leading-snug text-slate-800">
            Pickup contact is same as booking customer
          </span>
        </label>
        {!pickupSame ? (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-4">
            <label className="block">
              <span className={label}>Pickup contact name</span>
              <input
                type="text"
                autoComplete="name"
                value={data.pickupContactName || ''}
                onChange={(e) => set({ pickupContactName: e.target.value })}
                className={input}
                placeholder="Name at pickup"
              />
            </label>
            <label className="block">
              <span className={label}>Pickup contact phone</span>
              <input
                type="tel"
                autoComplete="tel"
                value={data.pickupContactPhone || ''}
                onChange={(e) => set({ pickupContactPhone: e.target.value })}
                className={input}
                placeholder="Phone at pickup"
              />
            </label>
          </div>
        ) : (
          <p className="text-xs text-slate-600 sm:text-sm">
            Pickup: <span className="font-medium text-slate-800">{pickupResolved.name || '—'}</span>
            {pickupResolved.phone ? ` · ${pickupResolved.phone}` : ''}
          </p>
        )}

        <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <input
            id="delivery-contact-same"
            type="checkbox"
            checked={deliverySame}
            onChange={(e) => set({ deliveryContactSameAsCustomer: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium leading-snug text-slate-800">
            Delivery contact is same as booking customer
          </span>
        </label>
        {!deliverySame ? (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-4">
            <label className="block">
              <span className={label}>Delivery contact name</span>
              <input
                type="text"
                autoComplete="name"
                value={data.deliveryContactName || ''}
                onChange={(e) => set({ deliveryContactName: e.target.value })}
                className={input}
                placeholder="Name at delivery"
              />
            </label>
            <label className="block">
              <span className={label}>Delivery contact phone</span>
              <input
                type="tel"
                autoComplete="tel"
                value={data.deliveryContactPhone || ''}
                onChange={(e) => set({ deliveryContactPhone: e.target.value })}
                className={input}
                placeholder="Phone at delivery"
              />
            </label>
          </div>
        ) : (
          <p className="text-xs text-slate-600 sm:text-sm">
            Delivery: <span className="font-medium text-slate-800">{deliveryResolved.name || '—'}</span>
            {deliveryResolved.phone ? ` · ${deliveryResolved.phone}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
