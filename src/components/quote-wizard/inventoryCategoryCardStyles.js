/** Shared Step 2 category + crew card surface colours. */
export const INVENTORY_CARD_BG = '#EFF6FF'
export const INVENTORY_CARD_BG_ACTIVE = '#BFDBFE'
export const INVENTORY_CARD_BORDER_ACTIVE = '#3B82F6'

export function categoryCardClassName(isOpen) {
  return [
    'quote-inventory-item-name flex h-full min-h-[56px] w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-base font-semibold shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
    isOpen
      ? 'border-blue-600 bg-white text-slate-900 ring-1 ring-blue-500/30'
      : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300',
  ].join(' ')
}

export function categoryCardClassNameMobile(isOpen) {
  return [
    'quote-inventory-item-name flex h-full min-h-[52px] w-full min-w-0 items-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-left text-sm font-semibold shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
    isOpen
      ? 'border-blue-600 bg-white text-slate-900 ring-1 ring-blue-500/30'
      : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300',
  ].join(' ')
}
