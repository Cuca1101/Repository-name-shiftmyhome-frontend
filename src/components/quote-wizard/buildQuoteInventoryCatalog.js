import { isLegacyItemsLibraryCategory } from '../../lib/data/cleanupLegacyItemsLibraryCategories'
import { isValidLibraryRow } from '../../lib/data/itemsLibraryValidation'
import {
  CATEGORY_ORDER,
  INVENTORY_BY_CATEGORY,
  OTHER_ITEMS_CATEGORY_KEY,
} from './inventoryCatalog'

function ensureCategoryOrder(categoryOrder, inventoryByCategory) {
  const order = []
  for (const key of CATEGORY_ORDER) {
    if (inventoryByCategory[key] || INVENTORY_BY_CATEGORY[key]) {
      if (!order.includes(key)) order.push(key)
    }
  }
  for (const key of categoryOrder) {
    if (!order.includes(key) && inventoryByCategory[key]) order.push(key)
  }
  if (!order.includes(OTHER_ITEMS_CATEGORY_KEY) && INVENTORY_BY_CATEGORY.other) {
    order.push(OTHER_ITEMS_CATEGORY_KEY)
  }
  return order
}

/**
 * Fill gaps from inventoryCatalog.js without overriding Admin library rows
 * (matched by item name within the same category label).
 * @param {Record<string, CatalogCategory>} inventoryByCategory
 */
export function mergeFallbackCatalogGaps(inventoryByCategory) {
  for (const key of CATEGORY_ORDER) {
    const fallback = INVENTORY_BY_CATEGORY[key]
    if (!fallback) continue
    if (!inventoryByCategory[key]) {
      inventoryByCategory[key] = {
        label: fallback.label,
        items: fallback.items.map((item) => ({ ...item })),
      }
      continue
    }
    const existingNames = new Set(
      inventoryByCategory[key].items.map((item) => String(item.name || '').trim().toLowerCase()),
    )
    for (const item of fallback.items) {
      const nameKey = String(item.name || '').trim().toLowerCase()
      if (!nameKey || existingNames.has(nameKey)) continue
      existingNames.add(nameKey)
      inventoryByCategory[key].items.push({ ...item })
    }
  }
  return inventoryByCategory
}

/**
 * @typedef {{ id: string, name: string, m3: number, weightType: string, mult?: number, defaultQty?: number }} CatalogItem
 * @typedef {{ label: string, items: CatalogItem[] }} CatalogCategory
 */

/**
 * @param {string} label
 */
function slugCategoryKey(label) {
  return `lib-${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/**
 * @param {string} label
 */
export function categoryKeyForLabel(label) {
  const norm = String(label ?? '')
    .trim()
    .toLowerCase()
  for (const key of CATEGORY_ORDER) {
    const cat = INVENTORY_BY_CATEGORY[key]
    if (cat && cat.label.trim().toLowerCase() === norm) return key
  }
  return slugCategoryKey(label || 'general')
}

/**
 * @param {Array<{ id: string, name: string, category?: string, cubic_metres?: number, weight_type?: string, handling_multiplier?: number, default_quantity?: number }>} rows
 * @returns {{ categoryOrder: string[], inventoryByCategory: Record<string, CatalogCategory>, source: 'library' } | null}
 */
export function buildQuoteInventoryCatalogFromLibrary(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null

  /** @type {Map<string, CatalogCategory>} */
  const byKey = new Map()

  for (const row of rows) {
    if (!isValidLibraryRow(row) || !row.id || !row.name) continue

    const categoryLabel = String(row.category ?? '').trim() || 'General'
    if (isLegacyItemsLibraryCategory(categoryLabel)) continue
    const key = categoryKeyForLabel(categoryLabel)
    if (!byKey.has(key)) {
      byKey.set(key, { label: categoryLabel, items: [] })
    }
    const defaultQty = Math.max(1, parseInt(String(row.default_quantity ?? 1), 10) || 1)
    byKey.get(key).items.push({
      id: String(row.id),
      name: String(row.name),
      m3: Math.max(0.01, Number(row.cubic_metres) || 0),
      weightType: row.weight_type || 'medium',
      mult: 1,
      /** Weight type Heavy in Items Library = charge specialist heavy fee. */
      heavyFee: String(row.weight_type || '').toLowerCase() === 'heavy',
      defaultQty,
    })
  }

  if (byKey.size === 0) return null

  const categoryOrder = []
  for (const key of CATEGORY_ORDER) {
    if (byKey.has(key)) categoryOrder.push(key)
  }
  const rest = [...byKey.keys()]
    .filter((k) => !categoryOrder.includes(k))
    .sort((a, b) => byKey.get(a).label.localeCompare(byKey.get(b).label))
  categoryOrder.push(...rest)

  const inventoryByCategory = Object.fromEntries(byKey.entries())
  mergeFallbackCatalogGaps(inventoryByCategory)
  const ordered = ensureCategoryOrder(categoryOrder, inventoryByCategory)

  return { categoryOrder: ordered, inventoryByCategory, source: 'library' }
}

export function getFallbackInventoryCatalog() {
  /** @type {Record<string, CatalogCategory>} */
  const inventoryByCategory = Object.fromEntries(
    Object.entries(INVENTORY_BY_CATEGORY).map(([key, cat]) => [
      key,
      { label: cat.label, items: cat.items.map((item) => ({ ...item })) },
    ]),
  )
  return {
    categoryOrder: ensureCategoryOrder([...CATEGORY_ORDER], inventoryByCategory),
    inventoryByCategory,
    source: 'fallback',
  }
}

/**
 * @param {{ categoryOrder: string[], inventoryByCategory: Record<string, CatalogCategory> }} catalog
 */
export function createInventoryCatalogHelpers(catalog) {
  const { categoryOrder, inventoryByCategory } = catalog

  return {
    categoryOrder,
    inventoryByCategory,
    getFlattenedCatalogEntries() {
      const out = []
      for (const key of categoryOrder) {
        const cat = inventoryByCategory[key]
        if (!cat) continue
        for (const item of cat.items) {
          out.push({ categoryKey: key, categoryLabel: cat.label, item })
        }
      }
      return out
    },
    getCatalogItem(itemId) {
      for (const key of categoryOrder) {
        const cat = inventoryByCategory[key]
        if (!cat) continue
        const found = cat.items.find((item) => String(item.id) === String(itemId))
        if (found) {
          return { categoryKey: key, categoryLabel: cat.label, item: found }
        }
      }
      return null
    },
  }
}
