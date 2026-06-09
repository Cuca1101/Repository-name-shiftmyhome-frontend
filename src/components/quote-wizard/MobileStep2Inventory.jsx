import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import CrewSizeField from './CrewSizeField'
import MobileStepTitleWithRef from './MobileStepTitleWithRef'
import InventorySearchDropdown, {
  InventorySearchDropdownEmpty,
} from './InventorySearchDropdown'
import { CategoryLucideIcon } from './inventoryLucideIcons'
import { quoteMobileHelper } from '../../lib/quoteMobileUiClasses'

const card = 'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white shadow-sm md:rounded-xl'

/**
 * App-style mobile Step 2 inventory UI (&lt; md only).
 */
export default function MobileStep2Inventory({
  quoteRef,
  totalM3,
  categoryOrder,
  inventoryByCategory,
  catalogLoading = false,
  catalogSource = 'fallback',
  lines,
  crewSize,
  onCrewSizeChange,
  crewSettings,
  crewRestrictions,
  crewFieldId,
  validationMessage,
  searchId,
  searchQuery,
  setSearchQuery,
  activeCategory,
  onCategoryToggle,
  searchDropdownOpen,
  searchResults,
  renderSearchResultRow,
  cat,
  customName,
  setCustomName,
  customSize,
  setCustomSize,
  addCustom,
  removeAll,
  bump,
  renderCatalogRow,
  catalogItemsListClassName = 'mt-1.5 space-y-1',
  categoryHeadingClassName = 'text-xs font-bold uppercase tracking-wide text-slate-500',
  searchResultsCompact = true,
  resultsPanelRef,
  categoriesRef,
  inputClass,
}) {
  const catalogSectionRef = categoriesRef || useRef(null)

  return (
    <div data-quote-step="2" className="box-border min-w-0 w-full max-w-full space-y-1.5 md:hidden">
      <div className="px-0.5">
        <MobileStepTitleWithRef title="Items" quoteRef={quoteRef} titleClassName="md:text-lg" />
        <p className={`mt-0.5 ${quoteMobileHelper}`}>
          Add items from the categories below. Your selections appear in the move summary below.
        </p>
        {catalogLoading ? (
          <p className="mt-1 text-[11px] text-slate-500">Loading item catalogue…</p>
        ) : catalogSource === 'library' ? (
          <p className="mt-1 text-[11px] text-slate-500">Using your Items Library catalogue.</p>
        ) : null}
      </div>

      <CrewSizeField
        id={crewFieldId}
        value={crewSize}
        onChange={onCrewSizeChange}
        crewSettings={crewSettings}
        invalid={Boolean(validationMessage && /crew size/i.test(validationMessage))}
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

      <div ref={catalogSectionRef} data-quote-field="inventory" className={`${card} p-2.5 md:p-3`}>
        <div className="grid grid-cols-2 gap-2">
          {categoryOrder.map((key) => {
            const c = inventoryByCategory[key]
            if (!c) return null
            const isOpen = activeCategory === key
            return (
              <button
                key={key}
                type="button"
                aria-expanded={isOpen}
                onClick={() => onCategoryToggle(key)}
                className={`flex min-h-[44px] w-full items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold shadow-sm transition active:scale-[0.98] ${
                  isOpen
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <CategoryLucideIcon categoryKey={key} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 leading-snug">{c.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-brand-600' : ''}`}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>

        <InventorySearchDropdown
          id={searchId}
          value={searchQuery}
          onChange={setSearchQuery}
          catalogLoading={catalogLoading}
          open={searchDropdownOpen}
          className="relative z-30 mt-2"
        >
          {searchResults.length === 0 ? (
            <InventorySearchDropdownEmpty />
          ) : (
            <ul className="min-w-0 py-0.5">
              {searchResults.map((e) => renderSearchResultRow(e, searchResultsCompact))}
            </ul>
          )}
        </InventorySearchDropdown>

        {activeCategory ? (
          <div ref={resultsPanelRef} className="relative z-0 mt-3 min-w-0">
            {catalogLoading ? (
              <p className="text-sm text-slate-600">Loading items…</p>
            ) : cat ? (
              <div>
                <h3 className={categoryHeadingClassName}>{cat.label}</h3>
                <ul className={catalogItemsListClassName}>
                  {cat.items.map((item) => renderCatalogRow(item, '', false))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No items in this category.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className={`${card} p-3`}>
        <p className="text-sm text-slate-600">
          If you can&apos;t find your item in the inventory, add it manually.
        </p>
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="sr-only">Item name</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={inputClass}
              placeholder="Item name, e.g. Piano, aquarium"
            />
          </label>
          <div className="flex min-w-0 flex-col gap-2 xxs:flex-row">
            <select
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              className={`${inputClass} min-w-0 flex-1`}
              aria-label="Item size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="heavy">Heavy</option>
            </select>
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim()}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.99] xxs:w-auto"
            >
              Add custom item
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
