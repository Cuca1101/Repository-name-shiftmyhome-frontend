function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isCollectionStop(metadata, row) {
  const location = clean(metadata.location_type).toLowerCase()
  const stop = clean(metadata.stop_type || metadata.stopType || row?.stop_type).toLowerCase()
  const kind = clean(metadata.photo_kind).toLowerCase()
  return (
    location === 'collection'
    || stop === 'pickup'
    || stop === 'collection'
    || kind === 'pickup'
    || kind === 'collection'
  )
}

function isSignatureRow(metadata, row) {
  const evidence = clean(metadata.evidence_type).toLowerCase()
  const type = clean(row?.photo_type).toLowerCase()
  const file = clean(row?.file_name).toLowerCase()
  return (
    evidence === 'pod_signature'
    || evidence === 'waiver_signature'
    || type === 'pod_signature'
    || type === 'waiver_signature'
    || file.includes('signature')
  )
}

function signerNameFrom(metadata) {
  return clean(
    metadata.recipientName
    || metadata.recipient_name
    || metadata.waiverCustomerName
    || metadata.waiver_customer_name
    || metadata.signerName
    || metadata.signer_name,
  )
}

/**
 * A collection photo stored with the delivery category still belongs to the pickup stop.
 * @param {string} title
 * @param {Record<string, unknown>} metadata
 * @param {{ stop_type?: unknown, photo_type?: unknown, file_name?: unknown } | null} row
 */
function collectionAwareTitle(title, metadata, row) {
  if (!isCollectionStop(metadata, row)) return title
  if (/^delivery photo$/i.test(title)) return 'Pickup photo'
  return title
}

/**
 * Normalize job_photos.metadata for admin / customer display.
 * @param {unknown} metadata
 * @param {{ source_label?: unknown, photo_type?: unknown, file_name?: unknown, created_at?: unknown, stop_type?: unknown } | null} [row]
 */
export function resolveJobPhotoDisplayMeta(metadata, row = null) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const sourceLabel = row?.source_label != null ? String(row.source_label).trim() : ''
  let displayLine =
    (typeof m.display_line === 'string' && m.display_line.trim()) ||
    sourceLabel ||
    ''
  const signerName = signerNameFrom(m)
  const signature = isSignatureRow(m, row)
  const collection = isCollectionStop(m, row)
  let displayTitle =
    (typeof m.display_title === 'string' && m.display_title.trim()) ||
    (row?.photo_type ? String(row.photo_type).replace(/_/g, ' ') : '') ||
    'Photo'
  if (signature) {
    const waiver = clean(m.evidence_type).toLowerCase() === 'waiver_signature'
      || clean(row?.file_name).toLowerCase().includes('waiver')
    displayTitle = waiver ? 'Waiver' : 'Signature proof'
  } else {
    displayTitle = collectionAwareTitle(displayTitle, m, row)
  }
  if (collection && /^delivery photo\b/i.test(displayLine)) {
    displayLine = displayLine.replace(/^delivery photo/i, 'Pickup photo')
  }
  const capturedAtDisplay =
    (typeof m.captured_at_display === 'string' && m.captured_at_display.trim()) ||
    (typeof m.captured_at === 'string' && m.captured_at.trim()) ||
    (row?.created_at ? String(row.created_at) : '')
  const capturedAtAddress =
    (typeof m.captured_at_address === 'string' && m.captured_at_address.trim()) ||
    ''
  const jobStopAddress =
    (typeof m.job_stop_address === 'string' && m.job_stop_address.trim()) ||
    (typeof m.address_text === 'string' && m.address_text.trim() && !capturedAtAddress
      ? String(m.address_text).trim()
      : '') ||
    ''
  const addressText =
    (typeof m.address_text === 'string' && m.address_text.trim()) ||
    capturedAtAddress ||
    jobStopAddress ||
    ''
  const locationLabel =
    (typeof m.location_label === 'string' && m.location_label.trim()) ||
    (m.location_type === 'collection'
      ? 'Collection'
      : m.location_type === 'delivery'
        ? 'Delivery'
        : '')
  const lat = Number(m.gps_latitude)
  const lng = Number(m.gps_longitude)
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng)
  const mapUrl =
    (typeof m.map_url === 'string' && m.map_url.trim()) ||
    (hasGps ? `https://www.google.com/maps?q=${lat},${lng}` : '')

  return {
    displayLine,
    displayTitle,
    signerName,
    capturedAtDisplay,
    capturedAtAddress,
    jobStopAddress,
    addressText,
    locationLabel,
    mapUrl,
    hasGps,
    gpsLatitude: hasGps ? lat : null,
    gpsLongitude: hasGps ? lng : null,
  }
}
