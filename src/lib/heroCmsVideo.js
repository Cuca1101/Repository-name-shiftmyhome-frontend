/**
 * CMS hero video flags / URLs (homepage JSON may store loose types).
 */

/** @param {unknown} value */
export function coerceUseHeroVideo(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/**
 * @param {unknown} url
 * @returns {string}
 */
export function normalizeHeroVideoUrl(url) {
  return String(url ?? '').trim()
}

/**
 * Prefer stable public storage URLs (signed links expire; bucket is public).
 *
 * @param {unknown} url
 * @returns {string}
 */
export function resolveHeroVideoPlaybackUrl(url) {
  let u = normalizeHeroVideoUrl(url)
  if (!u) return ''

  if (u.includes('/storage/v1/object/sign/')) {
    u = u.replace('/storage/v1/object/sign/', '/storage/v1/object/public/')
    const q = u.indexOf('?')
    if (q !== -1) u = u.slice(0, q)
  } else if (u.includes('/storage/v1/object/authenticated/')) {
    u = u.replace('/storage/v1/object/authenticated/', '/storage/v1/object/public/')
    const q = u.indexOf('?')
    if (q !== -1) u = u.slice(0, q)
  }

  return u
}

/**
 * @param {unknown} url
 * @returns {string|null} MIME hint for <source type>, or null
 */
export function heroVideoMimeFromUrl(url) {
  const u = normalizeHeroVideoUrl(url).toLowerCase()
  if (!u) return null
  if (u.includes('.webm')) return 'video/webm'
  if (u.includes('.mov')) return 'video/quicktime'
  if (u.includes('.mp4') || u.includes('video/mp4')) return 'video/mp4'
  return 'video/mp4'
}
