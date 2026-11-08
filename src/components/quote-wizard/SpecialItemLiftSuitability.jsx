import { floorNeedsLiftQuestion } from '../../lib/floorAccess'
import { inventoryHasSpecialStairItems } from '../../lib/inventoryPricing'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'

const fieldset =
  'rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 sm:px-4'
const legend = 'mb-1.5 block text-xs font-medium leading-snug text-amber-950 sm:text-sm'
const option = 'flex items-center gap-2 text-sm text-amber-950'
const radio = 'h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500'
const note = 'mt-2 text-xs leading-relaxed text-amber-900/90'

/**
 * When inventory includes special-stair items (e.g. upright piano), lift Yes alone
 * does not waive floors — suitability for size/weight must be confirmed.
 *
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (patch: Record<string, unknown>) => void,
 *   side: 'pickup' | 'delivery',
 *   className?: string,
 * }} props
 */
export default function SpecialItemLiftSuitability({ data, onChange, side, className = '' }) {
  const lines = Array.isArray(data?.inventoryLines) ? data.inventoryLines : []
  const engineLines = lines.map((l) => ({
    quantity: l.quantity,
    specialStairFeePerFloor: l.specialStairFeePerFloor ?? l.special_stair_fee_per_floor,
  }))
  if (!inventoryHasSpecialStairItems(engineLines)) return null

  const floor = side === 'pickup' ? data.pickupFloor : data.deliveryFloor
  const lift = side === 'pickup' ? data.pickupLift : data.deliveryLift
  if (!floorNeedsLiftQuestion(floor) || lift !== true) return null

  const field =
    side === 'pickup' ? 'pickupLiftSuitableForSpecialItems' : 'deliveryLiftSuitableForSpecialItems'
  const value = data?.[field]
  const label = side === 'pickup' ? 'collection' : 'delivery'

  function setSuitable(next) {
    applyWizardPatch(onChange, { [field]: next })
  }

  const unclear = value !== true
  const stairsFlights = Math.max(0, Number(data.stairsFlights) || 0)

  return (
    <fieldset className={`${fieldset} ${className}`.trim()} data-quote-field={`${side}-special-lift`}>
      <legend className={legend}>
        Is the lift at {label} suitable for the size and weight of the special item(s) (e.g. piano)?
      </legend>
      <div className="flex flex-wrap gap-4">
        <label className={option}>
          <input
            type="radio"
            className={radio}
            checked={value === true}
            onChange={() => setSuitable(true)}
          />
          Yes — confirmed suitable
        </label>
        <label className={option}>
          <input
            type="radio"
            className={radio}
            checked={value === false}
            onChange={() => setSuitable(false)}
          />
          No / not sure
        </label>
      </div>
      {unclear || stairsFlights > 0 ? (
        <p className={note}>
          Checking “Lift” alone does not confirm the item fits. For difficult or unclear access, upload
          photos and wait for manual verification before confirming the price. Special stair fees stay
          on until suitability is confirmed
          {stairsFlights > 0 ? ' and there are no extra stair flights on the route' : ''}.
        </p>
      ) : (
        <p className={note}>
          Confirmed suitable lift with no extra stair flights — special stair floors at this address are
          waived.
        </p>
      )}
    </fieldset>
  )
}
