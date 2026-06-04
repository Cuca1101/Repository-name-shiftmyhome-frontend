import { PARKING_LABELS, WALKING_LABELS } from '../../lib/emailQuotePayload'

const input =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const label = 'mb-1.5 block text-sm font-medium text-slate-700'

/**
 * Access fields that affect pricing (same keys as quote wizard).
 */
export default function AdminAccessDetailsSection({ data, onChange }) {
  function set(k, v) {
    onChange({ ...data, [k]: v })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className={label}>Parking / vehicle access</span>
        <select
          className={input}
          value={data.parkingDistance || 'standard'}
          onChange={(e) => set('parkingDistance', e.target.value)}
        >
          {Object.entries(PARKING_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Walking distance / carry</span>
        <select
          className={input}
          value={data.walkingDistance || 'standard'}
          onChange={(e) => set('walkingDistance', e.target.value)}
        >
          {Object.entries(WALKING_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Flights of stairs (estimate)</span>
        <input
          type="number"
          min={0}
          max={20}
          className={input}
          value={data.stairsFlights ?? 0}
          onChange={(e) => set('stairsFlights', Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Heavy / awkward items notes</span>
        <textarea
          rows={2}
          className={`${input} min-h-[72px] resize-y`}
          value={data.heavyNotes || ''}
          onChange={(e) => set('heavyNotes', e.target.value)}
          placeholder="Piano, safe, American fridge, etc."
        />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Access restrictions</span>
        <textarea
          rows={2}
          className={`${input} min-h-[72px] resize-y`}
          value={data.stairsNotes || ''}
          onChange={(e) => set('stairsNotes', e.target.value)}
          placeholder="Narrow stairs, low bridges, permit parking, etc."
        />
      </label>
    </div>
  )
}
