/**
 * Lucide icons for inventory categories and catalogue items (ShiftMyHome quote wizard).
 */
import {
  AlertTriangle,
  Armchair,
  Archive,
  Baby,
  Bath,
  BedDouble,
  BedSingle,
  Bike,
  BookOpen,
  Box,
  Briefcase,
  ChefHat,
  Dumbbell,
  Flower2,
  Flag,
  LampDesk,
  LayoutGrid,
  Layers,
  Microwave,
  Monitor,
  Package,
  Refrigerator,
  Shirt,
  Sofa,
  Sprout,
  Table,
  Trees,
  Tv,
  WashingMachine,
  Waves,
  Warehouse,
  Wrench,
} from 'lucide-react'

/** @type {Record<string, import('lucide-react').LucideIcon>} */
export const CATEGORY_LUCIDE_ICONS = {
  bedrooms: BedDouble,
  living: Sofa,
  kitchen: Refrigerator,
  bathroom: Bath,
  boxes: Package,
  garden: Trees,
  office: Briefcase,
  electronics: Tv,
  garage: Wrench,
  children: Baby,
  sports: Dumbbell,
}

/** @type {Record<string, import('lucide-react').LucideIcon>} */
export const CATALOG_ITEM_LUCIDE_ICONS = {
  // Bedrooms
  'bed-single': BedSingle,
  'bed-double': BedDouble,
  'bed-king': BedDouble,
  'wardrobe-1': Warehouse,
  'wardrobe-2': Warehouse,
  chest: LayoutGrid,
  bedside: LampDesk,
  // Living
  'sofa-2': Sofa,
  'sofa-3': Sofa,
  armchair: Armchair,
  coffee: Table,
  'tv-unit': Tv,
  bookcase: BookOpen,
  // Kitchen / appliances
  fridge: Refrigerator,
  washer: WashingMachine,
  dryer: WashingMachine,
  'dining-table': Table,
  'dining-chairs': Armchair,
  microwave: Microwave,
  // Bathroom
  cabinet: Archive,
  'dryer-towel': Waves,
  'mirror-cab': Monitor,
  // Boxes & storage
  'box-s': Package,
  'box-m': Box,
  'box-l': Package,
  suitcases: Briefcase,
  plastic: Package,
  // Garden / outdoor
  bbq: ChefHat,
  'garden-set': Flower2,
  lawnmower: Sprout,
  planters: Flower2,
  // Office
  desk: LampDesk,
  'chair-office': Armchair,
  filing: Archive,
  'bookshelf-o': BookOpen,
  // Electronics (large TV: fragile cue)
  'tv-sm': Tv,
  'tv-lg': AlertTriangle,
  pc: Monitor,
  hifi: Monitor,
  // Garage
  'tool-chest': Wrench,
  ladder: Layers,
  workbench: Table,
  // Children
  cot: Baby,
  'toys-box': Package,
  'desk-kids': LampDesk,
  // Sports
  bike: Bike,
  golf: Flag,
  exercise: Dumbbell,
}

/** @type {Record<string, string>} Optional keywords for subtle secondary labels */
export const ITEM_VOLUME_HINT = {
  'tv-lg': 'Fragile — careful handling',
}

export function CategoryLucideIcon({ categoryKey, className }) {
  const Icon = CATEGORY_LUCIDE_ICONS[categoryKey] ?? Package
  return <Icon className={className} aria-hidden />
}

export function CatalogItemLucideIcon({ itemId, className }) {
  const Icon = CATALOG_ITEM_LUCIDE_ICONS[itemId] ?? Package
  return <Icon className={className} aria-hidden />
}
