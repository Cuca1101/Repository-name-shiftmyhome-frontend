import { useRef } from 'react'
import { ClipboardList } from 'lucide-react'
import CrewSizeField from './CrewSizeField'
import InventorySearchBar from './InventorySearchBar'
import { INVENTORY_SEARCH_EMPTY_MESSAGE } from './inventorySearchUtils'
import { CategoryLucideIcon } from './inventoryLucideIcons'

const card = 'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm'

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
  crewFieldId,
  crewHintId,
  validationMessage,
  searchId,
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  isSearchMode,
  searchGrouped,
  cat,
  customName,
  setCustomName,
  customSize,
  setCustomSize,
  addCustom,
  removeAll,
  bump,
  renderCatalogRow,
  resultsPanelRef,
  categoriesRef,
  inputClass,
}) {
  const catalogSectionRef = categoriesRef || useRef(null)

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

      <CrewSizeField
        id={crewFieldId}
        descriptionId={crewHintId}
        value={crewSize}
        onChange={onCrewSizeChange}
        crewSettings={crewSettings}
        invalid={Boolean(validationMessage && /crew size/i.test(validationMessage))}
      />

      <div className="px-0.5">
        <h2 className="text-lg font-bold text-slate-900">Inventory</h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-600">
          Add items from the categories below. Your selections appear in the move summary below.
        </p>
        {catalogLoading ? (
          <p className="mt-1 text-[11px] text-slate-500">Loading item catalogue…</p>
        ) : catalogSource === 'library' ? (
          <p className="mt-1 text-[11px] text-slate-500">Using your Items Library catalogue.</p>
        ) : null}
      </div>

      {validationMessage ? (
        <p
          className="quote-error rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
          role="alert"
          data-quote-error="true"
        >
          {validationMessage}
        </p>
      ) : null}

      <div ref={catalogSectionRef} data-quote-field="inventory" className={`${card} min-w-0 p-3`}>
        <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-2.5 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryOrder.map((key) => {
            const c = inventoryByCategory[key]
            if (!c) return null
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={`inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
                  activeCategory === key
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <CategoryLucideIcon categoryKey={key} className="h-4 w-4 shrink-0" />
                {c.label}
              </button>
            )
          })}
        </div>

        <InventorySearchBar id={searchId} value={searchQuery} onChange={setSearchQuery} className="mt-2" />

        <div ref={resultsPanelRef} className="mt-3 min-w-0">
          {isSearchMode ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Search results</h3>
              {searchGrouped.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600" role="status">
                  {INVENTORY_SEARCH_EMPTY_MESSAGE}
                </p>
              ) : (
                <div className="mt-2 space-y-4">
                  {searchGrouped.map(({ categoryKey, label, entries }) => (
                    <div key={categoryKey}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <ul className="mt-1.5 space-y-1">
                        {entries.map(({ item }) => renderCatalogRow(item, searchQuery.trim(), true))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : catalogLoading ? (
            <p className="mt-3 text-sm text-slate-600">Loading items…</p>
          ) : cat ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{cat.label}</h3>
              <ul className="mt-1.5 space-y-1">{cat.items.map((item) => renderCatalogRow(item, '', false))}</ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No items in this category.</p>
          )}
        </div>
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
          <div className="flex gap-2">
            <select
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              className={inputClass}
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
              className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add custom item
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
