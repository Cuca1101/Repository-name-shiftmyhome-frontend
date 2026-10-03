import FloorSelect from './FloorSelect'

const selectClass =
  'box-border h-[52px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

/**
 * Floor and lift, grouped under one address card.
 * @param {{
 *   floorId?: string,
 *   floorValue: number | null,
 *   onFloorChange: (value: number) => void,
 *   floorVariant?: 'default' | 'mobile-card',
 *   floorOpen?: boolean,
 *   onFloorOpenChange?: (open: boolean) => void,
 *   showLift: boolean,
 *   liftId?: string,
 *   liftValue: boolean | null,
 *   onLiftSelect: (value: boolean) => void,
 * }} props
 */
export default function QuoteAccessFields({
  floorId,
  floorValue,
  onFloorChange,
  floorVariant = 'default',
  floorOpen,
  onFloorOpenChange,
  showLift,
  liftId,
  liftValue,
  onLiftSelect,
}) {
  const liftSelect = liftValue === true ? 'yes' : liftValue === false ? 'no' : ''

  return (
    <div className={`mt-3 grid gap-3 ${showLift ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <div className="min-w-0" data-quote-field="floor">
        <FloorSelect
          id={floorId}
          label="Floor"
          value={floorValue}
          onChange={onFloorChange}
          variant={floorVariant}
          open={floorOpen}
          onOpenChange={onFloorOpenChange}
        />
      </div>
      {showLift ? (
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-slate-600">Lift available?</span>
          <select
            id={liftId}
            value={liftSelect}
            onChange={(event) => {
              if (event.target.value === 'yes') onLiftSelect(true)
              else if (event.target.value === 'no') onLiftSelect(false)
            }}
            className={selectClass}
          >
            <option value="">Select</option>
            <option value="no">No lift</option>
            <option value="yes">Lift available</option>
          </select>
        </label>
      ) : null}
    </div>
  )
}
