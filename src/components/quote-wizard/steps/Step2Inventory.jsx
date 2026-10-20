import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronRight, PackagePlus } from 'lucide-react'
import { useQuoteInventoryCatalog } from '../useQuoteInventoryCatalog'
import InlineInventoryQtyControl from '../InlineInventoryQtyControl'
import HighlightedInventoryName from '../HighlightedInventoryName'
import InventorySearchDropdown, {
  InventorySearchDropdownEmpty,
  keepSearchDropdownFocus,
} from '../InventorySearchDropdown'
import { filterAndSortInventorySearchResults } from '../inventorySearchUtils'
import InventorySelectionVolumeRow from '../InventorySelectionVolumeRow'
import { resolveDefaultM3PerUnit } from '../inventoryLineDefaults'
import { applyInventoryLineQuantityDelta, catalogLineForItem } from '../../../lib/inventoryLineQuantity'
import CrewSizeField from '../CrewSizeField'
import MobileStepRefBadge from '../MobileStepRefBadge'
import MobileStep2Inventory from '../MobileStep2Inventory'
import JobDetailsContactSection from '../JobDetailsContactSection'
import {
  CatalogItemLucideIcon,
  CategoryLucideIcon,
  ITEM_VOLUME_HINT,
} from '../inventoryLucideIcons'
import { categoryCardClassName } from '../inventoryCategoryCardStyles'

function newLineId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `L-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const INVENTORY_ITEMS_SCROLL = 'quote-inventory-items-scroll'
const MOBILE_INVENTORY_LIST = `mt-1.5 space-y-1 ${INVENTORY_ITEMS_SCROLL}`
const DESKTOP_INVENTORY_LIST = `quote-inventory-item-grid mt-4 ${INVENTORY_ITEMS_SCROLL}`
const INVENTORY_CARD =
  'flex h-full min-h-[4.5rem] min-w-0 items-center gap-3 rounded-xl border px-3 py-3 sm:gap-4 sm:px-4'
const INVENTORY_CARD_ICON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200/80'
const INVENTORY_QTY = 'quote-inventory-qty flex shrink-0 items-center justify-end self-center'

export default function Step2Inventory({
  lines,
  onLinesChange,
  customSizeM3,
  crewSize,
  onCrewSizeChange,
  crewSettings,
  crewRestrictions,
  quoteRef,
  quotePage = false,
  data,
  onChange,
  pricingSettings = null,
  breakdown = null,
  priceWithoutPromo = null,
  contactValidationMessage = '',
  validationMessage = '',
  /** @type {'quote' | 'admin'} */
  layoutVariant = 'quote',
  showCustomerIdentity = false,
  showContact = true,
  matchTablet = false,
}) {
  const isAdminLayout = layoutVariant === 'admin'
  const searchId = useId()
  const crewFieldId = useId()
  const resultsPanelRef = useRef(null)
  const categoriesRef = useRef(null)
  const {
    categoryOrder,
    inventoryByCategory,
    getCatalogItem,
    getFlattenedCatalogEntries,
    loading: catalogLoading,
    source: catalogSource,
  } = useQuoteInventoryCatalog()

  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [customSize, setCustomSize] = useState('medium')
  const [customFormOpen, setCustomFormOpen] = useState(false)

  useEffect(() => {
    if (!categoryOrder.length) return
    setActiveCategory((prev) => (prev && categoryOrder.includes(prev) ? prev : ''))
  }, [categoryOrder])

  function toggleCategory(key) {
    setActiveCategory((prev) => (prev === key ? '' : key))
  }

  const flatCatalogEntries = useMemo(
    () => getFlattenedCatalogEntries(),
    [getFlattenedCatalogEntries],
  )

  const searchResults = useMemo(
    () => filterAndSortInventorySearchResults(flatCatalogEntries, searchQuery),
    [flatCatalogEntries, searchQuery],
  )

  const searchDropdownOpen = searchQuery.trim().length > 0

  const totalM3 = useMemo(() => {
    let t = 0
    for (const row of lines) {
      t += row.quantity * row.m3
    }
    return Math.round(t * 100) / 100
  }, [lines])

  const customLines = useMemo(() => lines.filter((l) => l.isCustom), [lines])

  function addFromCatalog(itemId) {
    const found = getCatalogItem(itemId)
    if (!found) return
    const { item, categoryKey, categoryLabel } = found
    let idx = lines.findIndex((l) => !l.isCustom && l.catalogId != null && String(l.catalogId) === String(itemId))
    if (idx < 0 && item.name) {
      const norm = item.name.trim().toLowerCase()
      idx = lines.findIndex(
        (l) => !l.isCustom && String(l.name ?? '').trim().toLowerCase() === norm,
      )
    }
    if (idx >= 0) {
      const next = [...lines]
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
      onLinesChange(next)
      return
    }
    onLinesChange([
      ...lines,
      {
        lineId: newLineId(),
        catalogId: itemId,
        name: item.name,
        categoryKey,
        categoryLabel,
        quantity: item.defaultQty ?? 1,
        m3: item.m3,
        defaultM3: item.m3,
        weightType: item.weightType,
        mult: item.mult ?? 1,
        heavyFee: item.heavyFee,
        isCustom: false,
      },
    ])
  }

  function bump(lineId, delta) {
    onLinesChange(applyInventoryLineQuantityDelta(lines, lineId, delta))
  }

  function addCustom() {
    const name = customName.trim()
    if (!name) return
    const m3 = customSizeM3?.[customSize] ?? 0.35
    const wt = customSize === 'heavy' ? 'heavy' : customSize === 'large' ? 'large' : 'medium'
    onLinesChange([
      ...lines,
      {
        lineId: newLineId(),
        catalogId: null,
        name,
        categoryKey: null,
        categoryLabel: 'Custom',
        customSizeBand: customSize,
        quantity: 1,
        m3,
        defaultM3: m3,
        weightType: wt,
        mult: 1,
        isCustom: true,
      },
    ])
    setCustomName('')
  }

  function clampM3(n) {
    return Math.round(Math.max(0.01, n) * 100) / 100
  }

  function setLineM3(lineId, nextM3) {
    onLinesChange(
      lines.map((r) => (r.lineId === lineId ? { ...r, m3: clampM3(nextM3) } : r)),
    )
  }

  function resetLineM3(lineId) {
    onLinesChange(
      lines.map((r) => {
        if (r.lineId !== lineId) return r
        const def = resolveDefaultM3PerUnit(r, getCatalogItem)
        return { ...r, m3: def, defaultM3: r.defaultM3 ?? def }
      }),
    )
  }

  function removeAll() {
    onLinesChange([])
  }

  const cat = inventoryByCategory[activeCategory]

  const input =
    'box-border min-h-[36px] w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm leading-snug text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 md:min-h-[48px] md:rounded-xl md:px-3 md:py-2.5'

  function renderCatalogRow(item, highlightQuery, emphasizeMatch) {
    const line = catalogLineForItem(lines, item.id, item.name)
    const qty = line?.quantity ?? 0
    const isSelected = qty > 0
    const volumeHint = ITEM_VOLUME_HINT[item.id]
    const perUnitVol = Number(item.m3) || 0
    const cardTone = emphasizeMatch
      ? 'bg-amber-50/50 ring-1 ring-amber-200/70'
      : 'bg-slate-50/80'

    const nameEl = highlightQuery ? (
      <HighlightedInventoryName name={item.name} query={highlightQuery} />
    ) : (
      item.name
    )
    const volumeEl = (
      <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm">
        {perUnitVol.toFixed(2)} m³ per unit
        {volumeHint ? <span className="text-slate-600"> · {volumeHint}</span> : null}
      </p>
    )
    const qtyControl = (
      <InlineInventoryQtyControl
        catalog={isSelected}
        quantity={qty}
        onAdd={() => addFromCatalog(item.id)}
        onDecrement={() => line && bump(line.lineId, -1)}
        onIncrement={() => (line ? bump(line.lineId, 1) : addFromCatalog(item.id))}
      />
    )
    const selectedTone = isSelected
      ? 'border-brand-200 bg-brand-50/50 ring-1 ring-brand-500/20'
      : `border-slate-100 ${cardTone}`

    return (
      <li key={item.id} className={`${INVENTORY_CARD} ${selectedTone}`}>
        <div className={INVENTORY_CARD_ICON} aria-hidden>
          <CatalogItemLucideIcon itemId={item.id} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="quote-inventory-item-name text-sm font-semibold leading-snug text-slate-900">{nameEl}</p>
          {volumeEl}
        </div>
        <div className={INVENTORY_QTY}>{qtyControl}</div>
      </li>
    )
  }

  function renderSearchResultRow(entry, compact = false) {
    const { item, categoryLabel } = entry
    const line = catalogLineForItem(lines, item.id, item.name)
    const qty = line?.quantity ?? 0
    const highlightQuery = searchQuery.trim()
    const perUnitVol = Number(item.m3) || 0
    return (
      <li
        key={item.id}
        className={`flex min-w-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 ${
          compact ? 'min-h-[44px]' : 'min-h-[48px]'
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-slate-200/80 ${
            compact ? 'h-9 w-9' : 'h-10 w-10'
          }`}
          aria-hidden
        >
          <CatalogItemLucideIcon itemId={item.id} className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="quote-inventory-item-name text-sm font-semibold leading-snug text-slate-900">
            {highlightQuery ? (
              <HighlightedInventoryName name={item.name} query={highlightQuery} />
            ) : (
              item.name
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {categoryLabel}
            <span className="text-slate-400"> · </span>
            {perUnitVol.toFixed(2)} m³
          </p>
        </div>
        <div className={`${INVENTORY_QTY}`} onMouseDown={keepSearchDropdownFocus}>
          <InlineInventoryQtyControl
            compact={compact}
            catalog={Boolean(line?.quantity)}
            quantity={qty}
            onAdd={() => addFromCatalog(item.id)}
            onDecrement={() => line && bump(line.lineId, -1)}
            onIncrement={() => (line ? bump(line.lineId, 1) : addFromCatalog(item.id))}
          />
        </div>
      </li>
    )
  }

  function renderMobileCatalogRow(item, highlightQuery, emphasizeMatch) {
    const line = catalogLineForItem(lines, item.id, item.name)
    const qty = line?.quantity ?? 0
    const isSelected = qty > 0
    const cardTone = emphasizeMatch ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50/80'

    return (
      <li
        key={item.id}
        className={`flex min-h-[52px] min-w-0 items-center gap-2 rounded-lg border px-2 py-2 ${cardTone}`}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-slate-200/80"
          aria-hidden
        >
          <CatalogItemLucideIcon itemId={item.id} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="quote-inventory-item-name text-sm font-medium leading-snug text-slate-900">
            {highlightQuery ? (
              <HighlightedInventoryName name={item.name} query={highlightQuery} />
            ) : (
              item.name
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {(Number(item.m3) || 0).toFixed(2)} m³ per unit
          </p>
        </div>
        <div className={INVENTORY_QTY}>
          <InlineInventoryQtyControl
            compact
            catalog={isSelected}
            quantity={qty}
            onAdd={() => addFromCatalog(item.id)}
            onDecrement={() => line && bump(line.lineId, -1)}
            onIncrement={() => (line ? bump(line.lineId, 1) : addFromCatalog(item.id))}
          />
        </div>
      </li>
    )
  }

  return (
    <>
      <MobileStep2Inventory
        quoteRef={quoteRef}
        quotePage={quotePage}
        totalM3={totalM3}
        categoryOrder={categoryOrder}
        inventoryByCategory={inventoryByCategory}
        catalogLoading={catalogLoading}
        catalogSource={catalogSource}
        lines={lines}
        crewSize={crewSize}
        onCrewSizeChange={onCrewSizeChange}
        crewSettings={crewSettings}
        crewRestrictions={crewRestrictions}
        crewFieldId={crewFieldId}
        validationMessage={validationMessage}
        searchId={searchId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchDropdownOpen={searchDropdownOpen}
        searchResults={searchResults}
        renderSearchResultRow={renderSearchResultRow}
        activeCategory={activeCategory}
        onCategoryToggle={toggleCategory}
        cat={cat}
        customName={customName}
        setCustomName={setCustomName}
        customSize={customSize}
        setCustomSize={setCustomSize}
        addCustom={addCustom}
        customLines={customLines}
        removeAll={removeAll}
        bump={bump}
        renderCatalogRow={renderMobileCatalogRow}
        catalogItemsListClassName={MOBILE_INVENTORY_LIST}
        searchResultsCompact
        customFormOpen={customFormOpen}
        setCustomFormOpen={setCustomFormOpen}
        resultsPanelRef={resultsPanelRef}
        categoriesRef={categoriesRef}
        inputClass={input}
        matchTablet={matchTablet}
      />

    <div
      className={`quote-inventory-panel min-w-0 w-full max-w-full ${matchTablet ? 'hidden' : 'hidden lg:block'} ${isAdminLayout || quotePage ? 'space-y-4' : 'space-y-8'}`}
    >
      {!isAdminLayout && !quotePage ? (
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">Inventory</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose your crew size first — it affects loading time and pricing. Then tap{' '}
            <strong className="font-semibold text-slate-800">Add</strong> or use{' '}
            <strong className="font-semibold text-slate-800">−</strong> /{' '}
            <strong className="font-semibold text-slate-800">+</strong> on each item. Your total volume
            and estimate update live in the summary.
          </p>
          {catalogLoading ? (
            <p className="mt-2 text-xs text-slate-500">Loading item catalogue…</p>
          ) : catalogSource === 'library' ? (
            <p className="mt-2 text-xs text-slate-500">Using your Items Library catalogue.</p>
          ) : null}
        </div>
      ) : isAdminLayout ? (
        <p className="text-sm text-slate-600">
          Choose crew size, then add items. Search and categories use the full width below.
        </p>
      ) : catalogLoading ? (
        <p className="text-xs text-slate-500">Loading item catalogue…</p>
      ) : null}

      {quotePage ? (
        <div className="mb-2 lg:hidden">
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
          className="quote-error rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          role="alert"
          data-quote-error="true"
        >
          {validationMessage}
        </p>
      ) : null}

      <InventorySearchDropdown
        id={searchId}
        value={searchQuery}
        onChange={setSearchQuery}
        catalogLoading={catalogLoading}
        open={searchDropdownOpen}
        className="relative z-30 w-full min-w-0 max-w-full"
      >
        {searchResults.length === 0 ? (
          <InventorySearchDropdownEmpty />
        ) : (
          <ul className="min-w-0 py-0.5">
            {searchResults.map((e) => renderSearchResultRow(e, false))}
          </ul>
        )}
      </InventorySearchDropdown>

      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Browse categories</h3>
      <div className="quote-inventory-category-grid">
        {categoryOrder.map((key) => {
          const c = inventoryByCategory[key]
          if (!c) return null
          const isOpen = activeCategory === key
          return (
            <button
              key={key}
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleCategory(key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleCategory(key)
                }
              }}
              className={categoryCardClassName(isOpen)}
            >
              <CategoryLucideIcon
                categoryKey={key}
                className="h-5 w-5 shrink-0 text-blue-600"
              />
              <span className="quote-inventory-item-name min-w-0 flex-1 leading-snug">{c.label}</span>
              <ChevronRight
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90 text-blue-600' : ''}`}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
      </div>

      {activeCategory ? (
        <div
          ref={resultsPanelRef}
          data-quote-field="inventory"
          className={`relative z-0 mt-4 min-w-0 w-full max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm ${
            isAdminLayout ? 'p-4 sm:p-5' : 'p-3 sm:p-6'
          }`}
        >
          {catalogLoading ? (
            <p className="text-sm text-slate-600">Loading items…</p>
          ) : cat ? (
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">{cat.label}</h3>
              <ul className={DESKTOP_INVENTORY_LIST}>
                {cat.items.map((item) => renderCatalogRow(item, '', false))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No items in this category.</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Can&apos;t find your item?</p>
          <p className="text-xs text-slate-500">Add a custom item with your own details.</p>
        </div>
        <button
          type="button"
          onClick={() => setCustomFormOpen((open) => !open)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700"
          aria-expanded={customFormOpen}
        >
          + Add custom item
        </button>
      </div>
      {customFormOpen ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="quote-inventory-custom-grid">
          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={`mt-1 ${input}`}
              placeholder="e.g. Piano, aquarium"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">Size band</span>
            <select
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              className={`mt-1 ${input}`}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>
          <div className="min-w-0">
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim()}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Add custom
            </button>
          </div>
        </div>
      </div>
      ) : null}

        {customLines.length > 0 ? (
          <ul className="quote-inventory-custom-list mt-5 space-y-3 border-t border-slate-200/80 pt-5">
            {customLines.map((row) => (
              <li key={row.lineId} className={`${INVENTORY_CARD} border-slate-200 bg-white`}>
                <div className={`${INVENTORY_CARD_ICON} bg-slate-50 text-slate-700`} aria-hidden>
                  <PackagePlus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="quote-inventory-item-name text-sm font-semibold leading-snug text-slate-900">
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm">
                    Custom · {row.m3.toFixed(2)} m³ each
                  </p>
                </div>
                <div className={INVENTORY_QTY}>
                  <InlineInventoryQtyControl
                    catalog
                    quantity={row.quantity}
                    onAdd={() => bump(row.lineId, 1)}
                    onDecrement={() => bump(row.lineId, -1)}
                    onIncrement={() => bump(row.lineId, 1)}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/50 to-white p-5 shadow-card ring-1 ring-brand-100/60" aria-hidden="true">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Your selection</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Adjust quantity above; fine-tune volume per item here — totals and price update live.
            </p>
          </div>
          <span className="text-sm font-semibold text-brand-800">
            Total volume: {totalM3.toFixed(2)} m³
          </span>
        </div>
        {lines.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No items yet — add from the categories above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {lines.map((row) => (
              <InventorySelectionVolumeRow
                key={row.lineId}
                name={row.name}
                isCustom={Boolean(row.isCustom)}
                quantity={row.quantity}
                perUnitM3={row.m3}
                defaultPerUnitM3={resolveDefaultM3PerUnit(row, getCatalogItem)}
                onPerUnitM3Change={(v) => setLineM3(row.lineId, v)}
                onResetDefault={() => resetLineM3(row.lineId)}
              />
            ))}
          </ul>
        )}
      </div>

      {showContact && data && onChange ? (
        <JobDetailsContactSection
          data={data}
          onChange={onChange}
          pricingSettings={pricingSettings}
          breakdown={breakdown}
          priceWithoutPromo={priceWithoutPromo}
          validationMessage={contactValidationMessage}
          flexibleContact={isAdminLayout}
          lockSignedInEmail={!isAdminLayout}
          showCustomerIdentity={showCustomerIdentity}
        />
      ) : null}
    </>
  )
}
