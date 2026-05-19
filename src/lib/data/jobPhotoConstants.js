/** @typedef {'collection'|'delivery'|'damage'|'proof'|'general'} JobPhotoType */

export const JOB_PHOTO_BUCKET = 'quote-photos'

export const JOB_PHOTO_UPLOADED_BY = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  ADMIN: 'admin',
}

export const JOB_PHOTO_SOURCE_LABEL = {
  CUSTOMER: 'Added by customer',
  DRIVER: 'Added by driver',
}

/** @type {JobPhotoType[]} */
export const JOB_PHOTO_TYPES = ['collection', 'delivery', 'damage', 'proof', 'general']

/** @param {string} ref */
export function isValidQuoteRefForPhotos(ref) {
  return /^SMH-[0-9]{4}-[0-9]{6}$/.test(String(ref || '').trim())
}
