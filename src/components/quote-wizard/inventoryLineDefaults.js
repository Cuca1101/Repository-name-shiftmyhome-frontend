import { getCatalogItem as getStaticCatalogItem } from './inventoryCatalog'

const MIN = 0.01

/**
 * Resolved catalogue default m³ per unit for a wizard inventory line.
 * @param {{ m3: number, defaultM3?: number, isCustom?: boolean, catalogId?: string|null }} row
 * @param {(itemId: string) => { item?: { m3?: number } } | null} [getCatalogItemFn]
 */
export function resolveDefaultM3PerUnit(row, getCatalogItemFn) {
  if (row.defaultM3 != null && Number.isFinite(Number(row.defaultM3))) {
    return Math.max(MIN, Number(row.defaultM3))
  }
  if (!row.isCustom && row.catalogId) {
    const lookup = getCatalogItemFn ?? getStaticCatalogItem
    const f = lookup(row.catalogId)
    if (f?.item?.m3 != null) return Math.max(MIN, Number(f.item.m3))
  }
  return Math.max(MIN, Number(row.m3) || MIN)
}

/**
 * Quote form library line — default m³ from stored default or items_library row.
 * @param {{ volumePerUnitM3: number, defaultVolumePerUnitM3?: number, isCustom?: boolean, libraryItemId?: string|null }} row
 * @param {Array<{ id: string, cubic_metres?: number }>} library
 */
export function resolveDefaultVolumePerUnitQuote(row, library) {
  if (row.defaultVolumePerUnitM3 != null && Number.isFinite(Number(row.defaultVolumePerUnitM3))) {
    return Math.max(MIN, Number(row.defaultVolumePerUnitM3))
  }
  if (!row.isCustom && row.libraryItemId && Array.isArray(library)) {
    const item = library.find((i) => i.id === row.libraryItemId)
    if (item?.cubic_metres != null) return Math.max(MIN, Number(item.cubic_metres))
  }
  return Math.max(MIN, Number(row.volumePerUnitM3) || MIN)
}
