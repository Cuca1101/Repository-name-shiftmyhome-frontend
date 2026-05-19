import { INVENTORY_BY_CATEGORY, CATEGORY_ORDER } from '../../components/quote-wizard/inventoryCatalog'
import {
  fetchItemsLibrary,
  getItemsLibraryStorageKind,
  insertLibraryItem,
  replaceLocalItemsLibrary,
} from './itemsLibraryRepository'
import { isSupabaseConfigured, supabase } from '../supabase'
import {
  isBrokenLibraryRow,
  isNumericOnlyCategory,
  isValidLibraryRow,
  toLibraryWeightType,
} from './itemsLibraryValidation'

export { isBrokenLibraryRow, isValidLibraryRow } from './itemsLibraryValidation'

/**
 * @param {string} name
 * @param {string} category
 */
export function normalizeItemsLibraryKey(name, category) {
  const n = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  const c = String(category ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `${n}|${c}`
}

/**
 * @param {unknown} item
 * @param {string} categoryLabel
 * @returns {Omit<import('./itemsLibraryRepository').LibraryItemRow, 'id' | 'created_at'> | null}
 */
export function mapCatalogItemToLibraryRow(item, categoryLabel) {
  if (!item || typeof item !== 'object') return null

  const name = String(item.name ?? '').trim()
  if (!name) return null

  const category = String(categoryLabel ?? '').trim()
  if (!category || isNumericOnlyCategory(category)) return null

  const cubic_metres = Number(item.m3)
  if (!Number.isFinite(cubic_metres) || cubic_metres <= 0) return null

  const multRaw = Number(item.mult ?? 1)
  const handling_multiplier =
    Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1

  return {
    name,
    category,
    cubic_metres,
    weight_type: toLibraryWeightType(item.weightType),
    handling_multiplier,
    default_quantity: 1,
  }
}

/**
 * @returns {Omit<import('./itemsLibraryRepository').LibraryItemRow, 'id' | 'created_at'>[]}
 */
export function catalogRowsForItemsLibrary() {
  /** @type {Omit<import('./itemsLibraryRepository').LibraryItemRow, 'id' | 'created_at'>[]} */
  const rows = []
  const seenKeys = new Set()

  const appendCategory = (categoryKey) => {
    const category = INVENTORY_BY_CATEGORY[categoryKey]
    if (!category || typeof category !== 'object') return

    const categoryLabel = String(category.label ?? '').trim()
    if (!categoryLabel || isNumericOnlyCategory(categoryLabel)) return

    const items = category.items
    if (!Array.isArray(items)) return

    for (const item of items) {
      const row = mapCatalogItemToLibraryRow(item, categoryLabel)
      if (row) rows.push(row)
    }
  }

  for (const categoryKey of CATEGORY_ORDER) {
    if (seenKeys.has(categoryKey)) continue
    seenKeys.add(categoryKey)
    appendCategory(categoryKey)
  }

  for (const [categoryKey, category] of Object.entries(INVENTORY_BY_CATEGORY)) {
    if (seenKeys.has(categoryKey)) continue
    seenKeys.add(categoryKey)
    const categoryLabel = String(category?.label ?? '').trim()
    if (!categoryLabel || isNumericOnlyCategory(categoryLabel)) continue
    const items = category?.items
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const row = mapCatalogItemToLibraryRow(item, categoryLabel)
      if (row) rows.push(row)
    }
  }

  return rows
}

/**
 * Purge invalid rows from the same storage backend fetchItemsLibrary uses.
 * @param {Array<{ id?: string, name?: string, category?: string, cubic_metres?: unknown, handling_multiplier?: unknown }>} allItems
 */
export async function purgeBrokenLibraryItems(allItems) {
  const list = Array.isArray(allItems) ? allItems : []
  const invalid = list.filter(isBrokenLibraryRow)
  const valid = list.filter(isValidLibraryRow)
  const storage = getItemsLibraryStorageKind()

  if (storage === 'supabase' && isSupabaseConfigured && supabase) {
    const ids = invalid.map((r) => r.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        throw new Error('Sign in to manage items.')
      }
      const { error } = await supabase.from('items_library').delete().in('id', ids)
      if (error) throw error
    }
    return { removed: invalid.length, storage, validCount: valid.length }
  }

  replaceLocalItemsLibrary(valid)
  return { removed: invalid.length, storage: 'localStorage', validCount: valid.length }
}

/**
 * @param {Array<{ name?: string, category?: string }>} existingItems
 */
export function planCatalogImport(existingItems) {
  const validExisting = (existingItems || []).filter(isValidLibraryRow)
  const existingKeys = new Set(
    validExisting.map((row) => normalizeItemsLibraryKey(row.name, row.category)),
  )
  const catalog = catalogRowsForItemsLibrary()
  /** @type {typeof catalog} */
  const toImport = []
  let skipped = 0
  for (const row of catalog) {
    const key = normalizeItemsLibraryKey(row.name, row.category)
    if (existingKeys.has(key)) {
      skipped += 1
      continue
    }
    existingKeys.add(key)
    toImport.push(row)
  }
  return { toImport, skipped, catalogTotal: catalog.length, validExistingCount: validExisting.length }
}

/**
 * @param {Array<{ id?: string, name?: string, category?: string }>} existingItems
 */
export async function importMissingCatalogToItemsLibrary(existingItems) {
  const purge = await purgeBrokenLibraryItems(existingItems)
  const afterClean = await fetchItemsLibrary()
  const validExisting = afterClean.filter(isValidLibraryRow)
  const { toImport, skipped, catalogTotal } = planCatalogImport(validExisting)

  for (const row of toImport) {
    await insertLibraryItem(row)
  }

  return {
    imported: toImport.length,
    skipped,
    cleaned: purge.removed,
    catalogTotal,
    storage: purge.storage,
    validDisplayed: validExisting.length + toImport.length,
  }
}
