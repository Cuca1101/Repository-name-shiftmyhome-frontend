let open = false

export function isPricingCatalogOpen() {
  return open
}

export function unlockPricingCatalog() {
  open = true
}

export function lockPricingCatalog() {
  open = false
}
