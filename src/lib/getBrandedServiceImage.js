import { HOME_SERVICE_CARD_IMAGES } from '../constants/homeServiceCardImages.js'

/** Branded local service photo — never CMS/external overrides on SEO pages. */
export function getBrandedServiceImage(slug) {
  const key = String(slug || '').trim() || 'house-removals'
  return HOME_SERVICE_CARD_IMAGES[key] ?? HOME_SERVICE_CARD_IMAGES['house-removals']
}
