import { useRef } from 'react'
import { ChevronDown, PackagePlus } from 'lucide-react'
import CrewSizeField from './CrewSizeField'
import MobileStepRefBadge from './MobileStepRefBadge'
import MobileStepTitleWithRef from './MobileStepTitleWithRef'
import InventorySearchDropdown, {
  InventorySearchDropdownEmpty,
} from './InventorySearchDropdown'
import InlineInventoryQtyControl from './InlineInventoryQtyControl'
import { CategoryLucideIcon } from './inventoryLucideIcons'
import { categoryCardClassNameMobile } from './inventoryCategoryCardStyles'
import { quoteMobileHelper } from '../../lib/quoteMobileUiClasses'

const card = 'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white shadow-sm md:rounded-xl'

/**
 * App-style mobile Step 2 inventory UI (&lt; md only).
 */
export default function MobileStep2Inventory({
  quoteRef,
  quotePage = false,
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
  customLines = [],
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

      {quotePage ? (
        <div className="px-0.5">
          <MobileStepRefBadge quoteRef={quoteRef} />
        </div>
      ) : null}

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
        <div className="grid grid-cols-2 items-stretch gap-2">
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onCategoryToggle(key)
                  }
                }}
                className={categoryCardClassNameMobile(isOpen)}
              >
                <CategoryLucideIcon
                  categoryKey={key}
                  className={`h-[1.125rem] w-[1.125rem] shrink-0 ${isOpen ? 'text-blue-700' : 'text-slate-600'}`}
                />
                <span className="min-w-0 flex-1 leading-snug">{c.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
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
        <p className="text-sm font-bold text-blue-700">
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
        {customLines.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            {customLines.map((row) => (
              <li
                key={row.lineId}
                className="flex min-h-[52px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2"
              >
                <PackagePlus className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="text-[11px] text-slate-500">Custom · {row.m3.toFixed(2)} m³</p>
                </div>
                <InlineInventoryQtyControl
                  compact
                  quantity={row.quantity}
                  onAdd={() => bump(row.lineId, 1)}
                  onDecrement={() => bump(row.lineId, -1)}
                  onIncrement={() => bump(row.lineId, 1)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
