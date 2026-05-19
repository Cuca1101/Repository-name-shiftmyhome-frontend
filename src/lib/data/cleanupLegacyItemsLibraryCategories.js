import {
  deleteLibraryItem,
  getItemsLibraryStorageKind,
  replaceLocalItemsLibrary,
  updateLibraryItem,
} from './itemsLibraryRepository'
import { isValidLibraryRow } from './itemsLibraryValidation'

/** Old admin category labels → canonical catalogue labels */
export const LEGACY_ITEMS_LIBRARY_CATEGORIES = Object.freeze({
  Appliances: 'Kitchen & dining',
  Bedroom: 'Bedrooms',
  Boxes: 'Boxes & storage',
  Living: 'Living areas',
})

const LEGACY_SOURCE_LABELS = new Set(Object.keys(LEGACY_ITEMS_LIBRARY_CATEGORIES))

/**
 * @param {unknown} name
 */
export function normalizeLibraryItemName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {unknown} category
 */
export function isLegacyItemsLibraryCategory(category) {
  return LEGACY_SOURCE_LABELS.has(String(category ?? '').trim())
}

/**
 * Build normalized name sets for canonical (non-legacy) categories.
 * @param {Array<{ name?: string, category?: string }>} allItems
 */
function buildCanonicalNameIndex(allItems) {
  /** @type {Map<string, Set<string>>} */
  const byCategory = new Map()

  for (const row of allItems) {
    if (!isValidLibraryRow(row)) continue
    const category = String(row.category ?? '').trim()
    if (isLegacyItemsLibraryCategory(category)) continue

    const nameKey = normalizeLibraryItemName(row.name)
    if (!nameKey) continue
    if (!byCategory.has(category)) byCategory.set(category, new Set())
    byCategory.get(category).add(nameKey)
  }

  return byCategory
}

/**
 * @param {Array<{ id?: string, name?: string, category?: string }>} allItems
 */
export function planLegacyCategoryCleanup(allItems) {
  const list = Array.isArray(allItems) ? allItems : []
  const canonicalNames = buildCanonicalNameIndex(list)

  /** @type {{ id: string, name: string, category: string }[]} */
  const toDelete = []
  /** @type {{ id: string, name: string, category: string, targetCategory: string }[]} */
  const toMove = []

  for (const row of list) {
    if (!isValidLibraryRow(row) || !row.id) continue

    const category = String(row.category ?? '').trim()
    const targetCategory = LEGACY_ITEMS_LIBRARY_CATEGORIES[category]
    if (!targetCategory) continue

    const nameKey = normalizeLibraryItemName(row.name)
    let targetNames = canonicalNames.get(targetCategory)
    if (!targetNames) {
      targetNames = new Set()
      canonicalNames.set(targetCategory, targetNames)
    }

    if (targetNames.has(nameKey)) {
      toDelete.push({
        id: row.id,
        name: String(row.name ?? ''),
        category,
      })
      continue
    }

    toMove.push({
      id: row.id,
      name: String(row.name ?? ''),
      category,
      targetCategory,
    })
    targetNames.add(nameKey)
  }

  return {
    toDelete,
    toMove,
    legacyRowCount: toDelete.length + toMove.length,
    deletedCount: toDelete.length,
    movedCount: toMove.length,
  }
}

/**
 * Merge legacy admin categories into canonical labels (admin library only).
 * @param {Array<{ id?: string, name?: string, category?: string }>} allItems
 */
export async function cleanupLegacyItemsLibraryCategories(allItems) {
  const { toDelete, toMove, deletedCount, movedCount, legacyRowCount } =
    planLegacyCategoryCleanup(allItems)

  if (legacyRowCount === 0) {
    return {
      deleted: 0,
      moved: 0,
      legacyRowCount: 0,
      storage: getItemsLibraryStorageKind(),
    }
  }

  const storage = getItemsLibraryStorageKind()

  if (storage === 'localStorage') {
    const deleteIds = new Set(toDelete.map((r) => r.id))
    const moveById = new Map(toMove.map((r) => [r.id, r.targetCategory]))
    const next = (Array.isArray(allItems) ? allItems : [])
      .filter((row) => !deleteIds.has(row.id))
      .map((row) =>
        moveById.has(row.id) ? { ...row, category: moveById.get(row.id) } : row,
      )
    replaceLocalItemsLibrary(next)
    return { deleted: deletedCount, moved: movedCount, legacyRowCount, storage }
  }

  for (const row of toDelete) {
    await deleteLibraryItem(row.id)
  }
  for (const row of toMove) {
    await updateLibraryItem(row.id, { category: row.targetCategory })
  }

  return { deleted: deletedCount, moved: movedCount, legacyRowCount, storage }
}
