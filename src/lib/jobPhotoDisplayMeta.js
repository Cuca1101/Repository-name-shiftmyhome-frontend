/**
 * Normalize job_photos.metadata for admin / customer display.
 * @param {unknown} metadata
 * @param {{ source_label?: unknown, photo_type?: unknown, created_at?: unknown } | null} [row]
 */
export function resolveJobPhotoDisplayMeta(metadata, row = null) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const sourceLabel = row?.source_label != null ? String(row.source_label).trim() : ''
  const displayLine =
    (typeof m.display_line === 'string' && m.display_line.trim()) ||
    sourceLabel ||
    ''
  const displayTitle =
    (typeof m.display_title === 'string' && m.display_title.trim()) ||
    (row?.photo_type ? String(row.photo_type).replace(/_/g, ' ') : '') ||
    'Photo'
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
