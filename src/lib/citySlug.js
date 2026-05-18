/** @param {string} cityName */
export function cityToSlug(cityName) {
  return cityName
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/\s+/g, '-')
}

/** @param {string} slug */
export function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
