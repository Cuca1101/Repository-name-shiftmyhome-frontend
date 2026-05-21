import { useEffect, useId, useRef, useState } from 'react'
import {
  INVENTORY_SEARCH_NO_MATCHES,
  INVENTORY_SEARCH_PLACEHOLDER,
} from './inventorySearchUtils'

/**
 * Search input with results panel attached directly underneath.
 */
export default function InventorySearchDropdown({
  id: idProp,
  value,
  onChange,
  disabled = false,
  catalogLoading = false,
  /** @type {boolean} */
  open,
  /** @type {React.ReactNode} */
  children,
  className = '',
  listClassName = '',
}) {
  const autoId = useId()
  const id = idProp || autoId
  const listId = `${id}-listbox`
  const rootRef = useRef(null)
  const [focused, setFocused] = useState(false)

  const showPanel = open && (focused || value.trim().length > 0)

  useEffect(() => {
    if (!showPanel) return
    function onDocPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [showPanel])

  const inputRound = showPanel ? 'rounded-t-xl rounded-b-none border-b-0' : 'rounded-xl'

  return (
    <div ref={rootRef} className={`relative z-30 w-full min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search inventory items
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        disabled={disabled}
        placeholder={INVENTORY_SEARCH_PLACEHOLDER}
        className={`w-full min-h-[48px] border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 ${inputRound}`}
      />

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 top-full max-h-[min(20rem,50vh)] overflow-y-auto overflow-x-hidden rounded-b-xl border-2 border-t-0 border-slate-200 bg-white shadow-lg ring-4 ring-brand-500/10 ${listClassName}`}
        >
          {catalogLoading ? (
            <p className="px-3 py-4 text-sm text-slate-600">Loading items…</p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  )
}

/** @param {{ message?: string }} props */
export function InventorySearchDropdownEmpty({ message = INVENTORY_SEARCH_NO_MATCHES }) {
  return (
    <p className="px-3 py-4 text-sm text-slate-600" role="status" aria-live="polite">
      {message}
    </p>
  )
}

/**
 * Prevent input blur before button click inside the dropdown.
 * @param {React.MouseEvent} e
 */
export function keepSearchDropdownFocus(e) {
  e.preventDefault()
}
