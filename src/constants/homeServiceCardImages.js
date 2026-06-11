import { SERVICE_PAGES } from './servicePages.js'

/**
 * Homepage + SEO service card images — synced with service page hero photos.
 */
export const HOME_SERVICE_CARD_IMAGES = Object.fromEntries(
  SERVICE_PAGES.map((page) => [page.slug, page.heroImage]),
)
