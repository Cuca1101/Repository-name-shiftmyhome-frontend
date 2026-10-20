import { deleteLibraryItems, getItemsLibraryStorageKind, replaceLocalItemsLibrary } from "./itemsLibraryRepository"
import { isValidLibraryRow } from "./itemsLibraryValidation"
import {
  isLegacyItemsLibraryCategory,
  normalizeLibraryItemName,
} from "./cleanupLegacyItemsLibraryCategories"

/**
 * Extra copies of the same item name. The quote form shows one card per name,
 * so a second library row makes one tap look like two selected items.
 * @param {Array<{ id?: string, name?: string, category?: string, created_at?: string }>} allItems
 */
export function planDuplicateLibraryCleanup(allItems) {
  /** @type {Map<string, Array<{ id?: string, name?: string, category?: string, created_at?: string }>>} */
  const groups = new Map()
  for (const row of Array.isArray(allItems) ? allItems : []) {
    if (!isValidLibraryRow(row) || !row.id) continue
    const key = normalizeLibraryItemName(row.name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  /** @type {{ id: string, name: string, category: string }[]} */
  const toDelete = []
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    const ranked = [...rows].sort((a, b) => {
      const aLegacy = isLegacyItemsLibraryCategory(a.category) ? 1 : 0
      const bLegacy = isLegacyItemsLibraryCategory(b.category) ? 1 : 0
      if (aLegacy !== bLegacy) return aLegacy - bLegacy
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      if (aTime !== bTime) return aTime - bTime
      return String(a.id).localeCompare(String(b.id))
    })
    for (const extra of ranked.slice(1)) {
      toDelete.push({
        id: String(extra.id),
        name: String(extra.name ?? ""),
        category: String(extra.category ?? ""),
      })
    }
  }

  return { toDelete, deletedCount: toDelete.length }
}

/**
 * Delete duplicate item names from the admin library. Saved quotes are not changed.
 * @param {Array<{ id?: string, name?: string, category?: string, created_at?: string }>} allItems
 */
export async function cleanupDuplicateLibraryItems(allItems) {
  const { toDelete, deletedCount } = planDuplicateLibraryCleanup(allItems)
  const storage = getItemsLibraryStorageKind()
  if (deletedCount === 0) return { deleted: 0, storage }

  if (storage === "localStorage") {
    const drop = new Set(toDelete.map((row) => row.id))
    replaceLocalItemsLibrary((Array.isArray(allItems) ? allItems : []).filter((row) => !drop.has(row.id)))
    return { deleted: deletedCount, storage }
  }

  await deleteLibraryItems(toDelete.map((row) => row.id))
  return { deleted: deletedCount, storage }
}
