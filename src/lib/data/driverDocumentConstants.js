/** Private bucket for driver identity verification documents (admin-only signed URLs). */
export const DRIVER_DOCUMENT_BUCKET = 'driver-documents'

/** @typedef {'licence_front'|'licence_back'|'passport_id'|'proof_of_address'} DriverDocumentType */

/** @type {{ id: DriverDocumentType, label: string, hint: string }[]} */
export const DRIVER_DOCUMENT_SLOTS = [
  {
    id: 'licence_front',
    label: 'Driving licence (front)',
    hint: 'Front of UK driving licence or equivalent.',
  },
  {
    id: 'licence_back',
    label: 'Driving licence (back)',
    hint: 'Back of licence showing categories and endorsements.',
  },
  {
    id: 'passport_id',
    label: 'Passport / ID',
    hint: 'Passport photo page or government-issued photo ID.',
  },
  {
    id: 'proof_of_address',
    label: 'Proof of address',
    hint: 'Recent utility bill, bank statement, or council tax letter.',
  },
]

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

/**
 * @param {string} type
 * @returns {type is DriverDocumentType}
 */
export function isDriverDocumentType(type) {
  return DRIVER_DOCUMENT_SLOTS.some((s) => s.id === type)
}

/**
 * @param {File} file
 */
export function assertDriverDocumentFile(file) {
  if (!file) throw new Error('No file selected.')
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Use JPEG, PNG, WebP, HEIC, or PDF.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File must be 10 MB or smaller.')
  }
}
