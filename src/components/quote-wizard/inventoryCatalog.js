/**
 * Professional removals inventory — grouped by UI category/cards.
 *
 * Quote Wizard loads the Admin Items Library first (Supabase / localStorage);
 * this file is the offline fallback when the library is empty or unavailable.
 * See useQuoteInventoryCatalog.js and buildQuoteInventoryCatalog.js.
 *
 * IMPORTANT:
 * m3 is ALWAYS per unit, not total line volume.
 * Quantity is applied later by pricing:
 * quantity × m3 × handling multiplier.
 */

export const INVENTORY_BY_CATEGORY = {
  bedrooms: {
    label: 'Bedrooms',
    items: [
      { id: 'bed-single', name: 'Single bed & mattress', m3: 1.0, weightType: 'large', mult: 1 },
      { id: 'bed-double', name: 'Double bed & mattress', m3: 1.4, weightType: 'large', mult: 1 },
      { id: 'bed-king', name: 'King size bed & mattress', m3: 1.7, weightType: 'large', mult: 1 },
      { id: 'bed-bunk', name: 'Bunk bed', m3: 1.8, weightType: 'large', mult: 1.05 },
      { id: 'mattress-single', name: 'Single mattress', m3: 0.45, weightType: 'medium', mult: 1 },
      { id: 'mattress-double', name: 'Double mattress', m3: 0.65, weightType: 'medium', mult: 1 },
      { id: 'mattress-king', name: 'King size mattress', m3: 0.8, weightType: 'medium', mult: 1 },
      { id: 'wardrobe-single', name: 'Single wardrobe', m3: 1.4, weightType: 'heavy', mult: 1.05 },
      { id: 'wardrobe-double', name: 'Double wardrobe', m3: 2.2, weightType: 'heavy', mult: 1.1 },
      { id: 'wardrobe-triple', name: 'Triple wardrobe', m3: 3.0, weightType: 'heavy', mult: 1.1 },
      { id: 'chest-drawers-small', name: 'Small chest of drawers', m3: 0.45, weightType: 'medium', mult: 1 },
      { id: 'chest-drawers-large', name: 'Large chest of drawers', m3: 0.8, weightType: 'medium', mult: 1 },
      { id: 'bedside-table', name: 'Bedside table', m3: 0.12, weightType: 'small', mult: 1 },
      { id: 'dressing-table', name: 'Dressing table', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'blanket-box', name: 'Blanket box', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'clothes-rail', name: 'Clothes rail', m3: 0.25, weightType: 'medium', mult: 1 },
    ],
  },

  living: {
    label: 'Living areas',
    items: [
      { id: 'sofa-2', name: '2-seater sofa', m3: 1.2, weightType: 'large', mult: 1 },
      { id: 'sofa-3', name: '3-seater sofa', m3: 1.8, weightType: 'large', mult: 1 },
      { id: 'sofa-4', name: '4-seater sofa', m3: 2.4, weightType: 'large', mult: 1 },
      { id: 'corner-sofa', name: 'Corner sofa', m3: 3.0, weightType: 'large', mult: 1.05 },
      { id: 'sofa-bed', name: 'Sofa bed', m3: 1.8, weightType: 'heavy', mult: 1.1 },
      { id: 'armchair', name: 'Armchair', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'recliner-chair', name: 'Recliner chair', m3: 0.8, weightType: 'heavy', mult: 1.1 },
      { id: 'coffee-table', name: 'Coffee table', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'side-table', name: 'Side table', m3: 0.2, weightType: 'small', mult: 1 },
      { id: 'tv-unit', name: 'TV unit', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'bookcase-small', name: 'Small bookcase', m3: 0.45, weightType: 'medium', mult: 1 },
      { id: 'bookcase-large', name: 'Large bookcase', m3: 0.9, weightType: 'medium', mult: 1 },
      { id: 'display-cabinet', name: 'Display cabinet', m3: 0.9, weightType: 'heavy', mult: 1.05 },
      { id: 'sideboard', name: 'Sideboard', m3: 0.9, weightType: 'medium', mult: 1 },
      { id: 'rug', name: 'Rug', m3: 0.15, weightType: 'small', mult: 1 },
      { id: 'floor-lamp', name: 'Floor lamp', m3: 0.15, weightType: 'small', mult: 1 },
    ],
  },

  kitchen: {
    label: 'Kitchen & dining',
    items: [
      { id: 'fridge-freezer', name: 'Fridge freezer', m3: 0.95, weightType: 'heavy', mult: 1.15 },
      { id: 'american-fridge', name: 'American fridge freezer', m3: 1.6, weightType: 'heavy', mult: 1.2 },
      { id: 'washing-machine', name: 'Washing machine', m3: 0.6, weightType: 'heavy', mult: 1.15 },
      { id: 'tumble-dryer', name: 'Tumble dryer', m3: 0.55, weightType: 'heavy', mult: 1.1 },
      { id: 'dishwasher', name: 'Dishwasher', m3: 0.6, weightType: 'heavy', mult: 1.1 },
      { id: 'cooker', name: 'Cooker / oven', m3: 0.6, weightType: 'heavy', mult: 1.1 },
      { id: 'microwave', name: 'Microwave', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'dining-table-small', name: 'Small dining table', m3: 0.6, weightType: 'medium', mult: 1 },
      { id: 'dining-table-large', name: 'Large dining table', m3: 1.0, weightType: 'medium', mult: 1 },
      { id: 'dining-chair', name: 'Dining chair', m3: 0.1, weightType: 'small', mult: 1 },
      { id: 'bar-stool', name: 'Bar stool', m3: 0.12, weightType: 'small', mult: 1 },
      { id: 'kitchen-bin', name: 'Kitchen bin', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'kitchen-trolley', name: 'Kitchen trolley', m3: 0.3, weightType: 'medium', mult: 1 },
    ],
  },

  bathroom: {
    label: 'Bathroom',
    items: [
      { id: 'bathroom-cabinet', name: 'Bathroom cabinet', m3: 0.25, weightType: 'medium', mult: 1 },
      { id: 'mirror-cabinet', name: 'Mirror cabinet', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'towel-rail', name: 'Towel rail / radiator', m3: 0.1, weightType: 'medium', mult: 1 },
      { id: 'laundry-basket', name: 'Laundry basket', m3: 0.12, weightType: 'small', mult: 1 },
    ],
  },

  boxes: {
    label: 'Boxes & storage',
    items: [
      { id: 'box-small', name: 'Moving box (small)', m3: 0.05, weightType: 'small', mult: 1 },
      { id: 'box-medium', name: 'Moving box (medium)', m3: 0.1, weightType: 'small', mult: 1 },
      { id: 'box-large', name: 'Large box / crate', m3: 0.2, weightType: 'medium', mult: 1 },
      { id: 'plastic-box', name: 'Plastic storage box', m3: 0.12, weightType: 'small', mult: 1 },
      { id: 'suitcase', name: 'Suitcase / bag', m3: 0.15, weightType: 'small', mult: 1 },
      { id: 'wardrobe-box', name: 'Wardrobe box', m3: 0.25, weightType: 'medium', mult: 1 },
      { id: 'storage-bag', name: 'Storage bag', m3: 0.1, weightType: 'small', mult: 1 },
      { id: 'vacuum-bag', name: 'Vacuum bag', m3: 0.06, weightType: 'small', mult: 1 },
      { id: 'archive-box', name: 'Archive box', m3: 0.08, weightType: 'small', mult: 1 },
    ],
  },

  garden: {
    label: 'Garden & outdoor',
    items: [
      { id: 'garden-table', name: 'Garden table', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'garden-chair', name: 'Garden chair', m3: 0.15, weightType: 'small', mult: 1 },
      { id: 'garden-furniture-set', name: 'Garden furniture set', m3: 1.5, weightType: 'large', mult: 1 },
      { id: 'bbq', name: 'BBQ / grill', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'lawnmower', name: 'Lawnmower', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'plant-pot-small', name: 'Small plant pot', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'plant-pot-large', name: 'Large planter', m3: 0.3, weightType: 'medium', mult: 1 },
      { id: 'garden-bench', name: 'Garden bench', m3: 0.8, weightType: 'medium', mult: 1 },
      { id: 'patio-heater', name: 'Patio heater', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'parasols', name: 'Garden parasol', m3: 0.2, weightType: 'medium', mult: 1 },
    ],
  },

  office: {
    label: 'Office & study',
    items: [
      { id: 'office-desk-small', name: 'Small office desk', m3: 0.6, weightType: 'medium', mult: 1 },
      { id: 'office-desk-large', name: 'Large office desk', m3: 1.0, weightType: 'medium', mult: 1 },
      { id: 'office-chair', name: 'Office chair', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'filing-cabinet', name: 'Filing cabinet', m3: 0.45, weightType: 'heavy', mult: 1.05 },
      { id: 'printer', name: 'Printer', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'bookshelf', name: 'Bookshelf', m3: 0.8, weightType: 'medium', mult: 1 },
      { id: 'monitor', name: 'Monitor', m3: 0.08, weightType: 'small', mult: 1 },
    ],
  },

  electronics: {
    label: 'Electronics',
    items: [
      { id: 'tv-small', name: 'TV up to 43 inch', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'tv-large', name: 'Large TV', m3: 0.35, weightType: 'heavy', mult: 1.1 },
      { id: 'desktop-pc', name: 'Desktop PC', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'speaker', name: 'Speaker', m3: 0.12, weightType: 'medium', mult: 1 },
      { id: 'soundbar', name: 'Soundbar', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'games-console', name: 'Games console', m3: 0.05, weightType: 'small', mult: 1 },
    ],
  },

  garage: {
    label: 'Garage & DIY',
    items: [
      { id: 'tool-box', name: 'Tool box', m3: 0.15, weightType: 'heavy', mult: 1.1 },
      { id: 'tool-chest', name: 'Tool chest', m3: 0.5, weightType: 'heavy', mult: 1.1 },
      { id: 'ladder', name: 'Ladder', m3: 0.2, weightType: 'medium', mult: 1 },
      { id: 'workbench', name: 'Workbench', m3: 0.8, weightType: 'heavy', mult: 1 },
      { id: 'shelving-unit', name: 'Shelving unit', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'bike', name: 'Bicycle', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'exercise-bike', name: 'Exercise bike', m3: 0.8, weightType: 'heavy', mult: 1.1 },
      { id: 'treadmill', name: 'Treadmill', m3: 1.2, weightType: 'heavy', mult: 1.2 },
      { id: 'car-tyre', name: 'Car tyre', m3: 0.12, weightType: 'medium', mult: 1 },
    ],
  },

  children: {
    label: "Children's items",
    items: [
      { id: 'cot', name: 'Cot / crib', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'changing-table', name: 'Changing table', m3: 0.5, weightType: 'medium', mult: 1 },
      { id: 'kids-bed', name: "Child's bed", m3: 0.8, weightType: 'large', mult: 1 },
      { id: 'toy-box', name: 'Toy box', m3: 0.3, weightType: 'medium', mult: 1 },
      { id: 'pram', name: 'Pram / pushchair', m3: 0.35, weightType: 'medium', mult: 1 },
      { id: 'high-chair', name: 'High chair', m3: 0.2, weightType: 'small', mult: 1 },
      { id: 'kids-desk', name: "Children's desk", m3: 0.35, weightType: 'medium', mult: 1 },
    ],
  },

  sports: {
    label: 'Sports & hobbies',
    items: [
      { id: 'golf-clubs', name: 'Golf clubs', m3: 0.15, weightType: 'medium', mult: 1 },
      { id: 'fishing-rods', name: 'Fishing rods', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'keyboard-piano', name: 'Digital piano / keyboard', m3: 0.45, weightType: 'heavy', mult: 1.1 },
      { id: 'upright-piano', name: 'Upright piano', m3: 1.2, weightType: 'heavy', mult: 1.3 },
      { id: 'guitar', name: 'Guitar', m3: 0.08, weightType: 'small', mult: 1 },
      { id: 'drum-kit', name: 'Drum kit', m3: 0.7, weightType: 'medium', mult: 1 },
      { id: 'exercise-equipment', name: 'Exercise equipment', m3: 0.8, weightType: 'heavy', mult: 1.1 },
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

export function getFlattenedCatalogEntries() {
  const out = []
  for (const key of CATEGORY_ORDER) {
    const cat = INVENTORY_BY_CATEGORY[key]
    if (!cat) continue

    for (const item of cat.items) {
      out.push({
        categoryKey: key,
        categoryLabel: cat.label,
        item,
      })
    }
  }
  return out
}

export function getCatalogItem(itemId) {
  for (const key of CATEGORY_ORDER) {
    const cat = INVENTORY_BY_CATEGORY[key]
    if (!cat) continue

    const found = cat.items.find((item) => item.id === itemId)
    if (found) {
      return {
        categoryKey: key,
        categoryLabel: cat.label,
        item: found,
      }
    }
  }

  return null
}