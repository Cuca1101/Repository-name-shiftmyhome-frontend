/** Shared Step 2 category + crew card surface colours. */
export const INVENTORY_CARD_BG = '#EFF6FF'
export const INVENTORY_CARD_BG_ACTIVE = '#BFDBFE'
export const INVENTORY_CARD_BORDER_ACTIVE = '#3B82F6'

export function categoryIconButtonClassName() {
  return 'group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
}

export function categoryIconCircleClassName(isOpen) {
  return [
    'flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition sm:h-16 sm:w-16',
    isOpen
      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
      : 'bg-blue-50 text-blue-800 group-hover:bg-blue-100',
  ].join(' ')
}

export function categoryIconLabelClassName(isOpen) {
  return [
    'quote-inventory-item-name line-clamp-2 min-h-[2.45em] w-full text-center text-xs font-medium leading-tight sm:text-[13px]',
    isOpen ? 'font-semibold text-blue-600' : 'text-slate-700',
  ].join(' ')
}
