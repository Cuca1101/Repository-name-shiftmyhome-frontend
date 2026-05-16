/**
 * Professional removals inventory — grouped by UI category.
 * Each item: id (stable), name, m³ per unit, weight band, optional handling multiplier.
 */

/** @typedef {{ id: string, name: string, m3: number, weightType: string, mult?: number }} CatalogItem */

/** @type {Record<string, { label: string, items: CatalogItem[] }>} */
export const INVENTORY_BY_CATEGORY = {
  bedrooms: {
    label: 'Bedrooms',
    items: [
      { id: 'bed-single', name: 'Single bed & mattress', m3: 1.0, weightType: 'large', mult: 1 },
      { id: 'bed-double', name: 'Double bed & mattress', m3: 1.4, weightType: 'large', mult: 1 },
      { id: 'bed-king', name: 'Kingsize bed frame', m3: 1.6, weightType: 'large', mult: 1 },
      { id: 'wardrobe-1', name: 'Single wardrobe', m3: 1.5, weightType: 'heavy', mult: 1.05 },
      { id: 'wardrobe-2', name: 'Double wardrobe', m3: 2.2, weightType: 'heavy', mult: 1.1 },
      { id: 'chest', name: 'Chest of drawers', m3: 0.6, weightType: 'medium', mult: 1 },
      { id: 'bedside', name: 'Bedside tables (pair)', m3: 0.25, weightType: 'small', mult: 1 },
    ],
  },
  living: {
    label: 'Living areas',
    items: [
      { id: 'sofa-2', name: '2-seater sofa', m3: 1.2, weightType: 'large', mult: 1 },
      { id: 'sofa-3', name: '3-seater sofa', m3: 1.8, weightType: 'large', mult: 1 },
      { id: 'armchair', name: 'Armchair', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'coffee', name: 'Coffee table', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'tv-unit', name: 'TV unit', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'bookcase', name: 'Bookcase', m3: 0.8, weightType: 'medium', mult: 1 },
    ],
  },
  kitchen: {
    label: 'Kitchen',
    items: [
      { id: 'fridge', name: 'Fridge freezer', m3: 0.9, weightType: 'heavy', mult: 1.15 },
      { id: 'washer', name: 'Washing machine', m3: 0.6, weightType: 'heavy', mult: 1.15 },
      { id: 'dryer', name: 'Tumble dryer', m3: 0.5, weightType: 'heavy', mult: 1.1 },
      { id: 'dining-table', name: 'Dining table', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'dining-chairs', name: 'Dining chairs (set of 4)', m3: 0.4, weightType: 'medium', mult: 1 },
      { id: 'microwave', name: 'Microwave', m3: 0.08, weightType: 'small', mult: 1 },
    ],
  },
  bathroom: {
    label: 'Bathroom',
    items: [
      { id: 'cabinet', name: 'Bathroom cabinet', m3: 0.25, weightType: 'medium', mult: 1 },
      { id: 'dryer-towel', name: 'Towel rail / radiator', m3: 0.1, weightType: 'medium', mult: 1 },
      { id: 'mirror-cab', name: 'Mirror cabinet', m3: 0.15, weightType: 'medium', mult: 1 },
    ],
  },
  boxes: {
    label: 'Boxes & storage',
    items: [
      { id: 'box-s', name: 'Moving box (small)', m3: 0.05, weightType: 'small', mult: 1 },
      { id: 'box-m', name: 'Moving box (medium)', m3: 0.1, weightType: 'small', mult: 1 },
      { id: 'box-l', name: 'Large box / crate', m3: 0.2, weightType: 'medium', mult: 1 },
      { id: 'suitcases', name: 'Suitcases / bags', m3: 0.15, weightType: 'small', mult: 1 },
      { id: 'plastic', name: 'Plastic storage boxes', m3: 0.12, weightType: 'small', mult: 1 },
    ],
  },
  garden: {
    label: 'Garden & outdoor',
    items: [
      { id: 'bbq', name: 'BBQ / grill', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'garden-set', name: 'Garden furniture set', m3: 1.5, weightType: 'large', mult: 1 },
      { id: 'lawnmower', name: 'Lawnmower', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'planters', name: 'Large planters', m3: 0.3, weightType: 'medium', mult: 1 },
    ],
  },
  office: {
    label: 'Office & study',
    items: [
      { id: 'desk', name: 'Office desk', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'chair-office', name: 'Office chair', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'filing', name: 'Filing cabinet', m3: 0.45, weightType: 'heavy', mult: 1.05 },
      { id: 'bookshelf-o', name: 'Bookshelf (tall)', m3: 0.9, weightType: 'medium', mult: 1 },
    ],
  },
  electronics: {
    label: 'Electronics',
    items: [
      { id: 'tv-sm', name: 'TV (up to 43")', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'tv-lg', name: 'TV (large)', m3: 0.35, weightType: 'heavy', mult: 1.1 },
      { id: 'pc', name: 'Desktop PC / monitor setup', m3: 0.2, weightType: 'medium', mult: 1 },
      { id: 'hifi', name: 'Hi-fi / speakers', m3: 0.25, weightType: 'medium', mult: 1 },
    ],
  },
  garage: {
    label: 'Garage & DIY',
    items: [
      { id: 'tool-chest', name: 'Tool chest', m3: 0.5, weightType: 'heavy', mult: 1.1 },
      { id: 'ladder', name: 'Ladder', m3: 0.2, weightType: 'medium', mult: 1 },
      { id: 'workbench', name: 'Workbench', m3: 0.8, weightType: 'heavy', mult: 1 },
    ],
  },
  children: {
    label: "Children's items",
    items: [
      { id: 'cot', name: 'Cot / crib', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'toys-box', name: 'Toy storage / boxes', m3: 0.4, weightType: 'medium', mult: 1 },
      { id: 'desk-kids', name: "Children's desk", m3: 0.35, weightType: 'medium', mult: 1 },
    ],
  },
  sports: {
    label: 'Sports & hobbies',
    items: [
      { id: 'bike', name: 'Bicycle', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'golf', name: 'Golf clubs', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'exercise', name: 'Exercise equipment', m3: 0.8, weightType: 'heavy', mult: 1.1 },
    ],
  },
}

export const CATEGORY_ORDER = [
  'bedrooms',
  'living',
  'kitchen',
  'bathroom',
  'boxes',
  'garden',
  'office',
  'electronics',
  'garage',
  'children',
  'sports',
]

/**
 * Flat list for global search (all categories).
 * @returns {{ categoryKey: string, categoryLabel: string, item: CatalogItem }[]}
 */
export function getFlattenedCatalogEntries() {
  const out = []
  for (const key of CATEGORY_ORDER) {
    const cat = INVENTORY_BY_CATEGORY[key]
    for (const item of cat.items) {
      out.push({ categoryKey: key, categoryLabel: cat.label, item })
    }
  }
  return out
}

/** Find catalog item by id */
export function getCatalogItem(itemId) {
  for (const key of CATEGORY_ORDER) {
    const cat = INVENTORY_BY_CATEGORY[key]
    const found = cat.items.find((i) => i.id === itemId)
    if (found) return { categoryKey: key, item: found }
  }
  return null
}
