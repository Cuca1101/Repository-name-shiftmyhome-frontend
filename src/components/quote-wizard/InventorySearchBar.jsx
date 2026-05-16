import { INVENTORY_SEARCH_PLACEHOLDER } from './inventorySearchUtils'

/**
 * Full-width, touch-friendly inventory search — same styling everywhere.
 */
export default function InventorySearchBar({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
}) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search inventory items
      </label>
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={INVENTORY_SEARCH_PLACEHOLDER}
        disabled={disabled}
        className="w-full min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  )
}
