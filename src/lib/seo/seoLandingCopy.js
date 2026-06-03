/**
 * Context-aware headings and labels for SEO landing pages (city, intent, service×city).
 *
 * @param {import('../../data/seoPages').SeoPageConfig} page
 */
export function getIntroHeading(page) {
  const { cityName, kind, h1 } = page

  if (kind === 'intent') return h1

  if (cityName === 'Scotland') return 'Professional moves across Scotland'

  switch (kind) {
    case 'man-with-van':
      return `Man with van in ${cityName}`
    case 'office-removals':
      return `Office removals in ${cityName}`
    case 'student-moves':
      return `Student moves in ${cityName}`
    case 'furniture-delivery':
      return `Furniture delivery in ${cityName}`
    case 'removals':
    default:
      return `Local movers in ${cityName}`
  }
}

/** @param {import('../../data/seoPages').SeoPageConfig} page */
export function getQuoteSidebarTitle(page) {
  const { cityName, kind, serviceType } = page

  if (cityName === 'Scotland') return 'Get your quote'

  if (kind === 'intent') {
    return `Get your ${cityName} quote`
  }

  if (serviceType === 'Man with Van') return `Book man with van in ${cityName}`
  if (serviceType === 'Office Moves') return `Get your ${cityName} office quote`
  if (serviceType === 'Student Moves') return `Get your ${cityName} student quote`
  if (serviceType === 'Furniture Delivery') return `Get furniture delivery quote — ${cityName}`

  return `Get your ${cityName} quote`
}

/** @param {import('../../data/seoPages').SeoPageConfig} page */
export function getCityServicesHeading(page) {
  const { cityName, kind, serviceType } = page

  if (cityName === 'Scotland') return 'Removal services across Scotland'

  if (kind === 'intent') return `How ShiftMyHome helps in ${cityName}`

  switch (kind) {
    case 'man-with-van':
      return `Man with van services in ${cityName}`
    case 'office-removals':
      return `Office move services in ${cityName}`
    case 'student-moves':
      return `Student move services in ${cityName}`
    case 'furniture-delivery':
      return `Furniture delivery in ${cityName}`
    case 'removals':
    default:
      return `Removal services in ${cityName}`
  }
}

/** @param {import('../../data/seoPages').SeoPageConfig} page */
export function getCityServicesIntro(page) {
  const { cityName, kind } = page

  if (kind === 'intent') {
    return `Tap a card below to learn more — each one opens the quote wizard so you can price your ${cityName} job in minutes.`
  }

  if (kind === 'removals') {
    return `Choose the service you need — each card opens our instant quote wizard with the right defaults for your ${cityName} move.`
  }

  return `Choose the option that fits your job — each card scrolls to the quote wizard with ${cityName} pricing.`
}

/** @param {import('../../data/seoPages').SeoPageConfig} page */
export function getQuoteSectionTitle(page) {
  const { cityName, kind, h1 } = page

  if (kind === 'intent') {
    return `Get your price — ${h1.replace(/\s*\|\s*.+$/, '')}`
  }

  if (cityName === 'Scotland') return 'Get your instant Scotland quote'

  return `Get your instant ${cityName} quote`
}

/** @param {import('../../data/seoPages').SeoPageConfig} page */
export function usesServiceStyleBodyCards(page) {
  return page.kind === 'removals'
}
