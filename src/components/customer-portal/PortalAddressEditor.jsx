import MapboxAddressField from '../quote-wizard/MapboxAddressField'
import { formatUkPostcode } from '../../lib/customerPortalQuote'

const fieldClass =
  'mt-1 box-border min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

export default function PortalAddressEditor({ wizard, onChange }) {
  return (
    <div id="portal-edit-addresses" className="scroll-mt-32 space-y-4">
      <StopFields side="pickup" title="Collection address" marker="1" markerClass="bg-[#ea580c]" wizard={wizard} onChange={onChange} />
      <StopFields side="delivery" title="Delivery address" marker="2" markerClass="bg-[#059669]" wizard={wizard} onChange={onChange} />
    </div>
  )
}

function StopFields({ side, title, marker, markerClass, wizard, onChange }) {
  function setPart(key, value) {
    onChange((current) => ({ ...current, [`${side}${key}`]: value }))
  }

  return (
    <section className="rounded-2xl bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-3">
        <MapboxAddressField
          label="Search address"
          markerLetter={marker}
          markerClassName={markerClass}
          address={wizard[`${side}Address`] || ''}
          lng={wizard[`${side}Lng`] ?? null}
          lat={wizard[`${side}Lat`] ?? null}
          addressKey={`${side}Address`}
          lngKey={`${side}Lng`}
          latKey={`${side}Lat`}
          onChange={onChange}
          variant="mobile-card"
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm">
          <span className="font-semibold text-slate-700">House number</span>
          <input
            value={wizard[`${side}HouseNumber`] || ''}
            onChange={(event) => setPart('HouseNumber', event.target.value)}
            autoComplete="off"
            inputMode="text"
            className={fieldClass}
          />
        </label>
        <label className="block min-w-0 text-sm">
          <span className="font-semibold text-slate-700">Postcode</span>
          <input
            value={wizard[`${side}Postcode`] || ''}
            onChange={(event) => setPart('Postcode', event.target.value)}
            onBlur={(event) => {
              const formatted = formatUkPostcode(event.target.value)
              if (formatted) setPart('Postcode', formatted)
            }}
            autoComplete="postal-code"
            className={fieldClass}
          />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="font-semibold text-slate-700">Street</span>
        <input
          value={wizard[`${side}Street`] || ''}
          onChange={(event) => setPart('Street', event.target.value)}
          autoComplete="address-line1"
          className={fieldClass}
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="font-semibold text-slate-700">Apartment</span>
        <input
          value={wizard[`${side}FlatDetails`] || ''}
          onChange={(event) => setPart('FlatDetails', event.target.value)}
          placeholder="Flat, floor, or buzzer"
          autoComplete="address-line2"
          className={fieldClass}
        />
      </label>
    </section>
  )
}
