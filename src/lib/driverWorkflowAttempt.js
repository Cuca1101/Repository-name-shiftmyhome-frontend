/**
 * Current driver attempt. Older history stays stored and is not the live stage.
 *
 * @param {number | string | null | undefined} value
 * @returns {number}
 */
export function workflowVersionNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {number | string | null | undefined} version
 */
export function currentAttemptRows(rows, version) {
  const current = workflowVersionNumber(version)
  return (rows || []).filter((row) => {
    if (row?.workflow_version == null || row.workflow_version === '') return current === 1
    return workflowVersionNumber(row.workflow_version) === current
  })
}

/**
 * Driver evidence belongs to the attempt that captured it.
 * Customer photos stay with the booking.
 *
 * @param {Record<string, unknown>} photo
 * @param {number | string | null | undefined} version
 */
export function evidenceCountsForCurrentAttempt(photo, version) {
  const by = String(photo?.uploaded_by || '').trim().toLowerCase()
  if (by && by !== 'driver') return true
  return currentAttemptRows([photo], version).length === 1
}

export function earlierAttemptRows(rows, version) {
  const current = workflowVersionNumber(version)
  return (rows || []).filter((row) => {
    if (row?.workflow_version == null || row.workflow_version === '') return current !== 1
    return workflowVersionNumber(row.workflow_version) !== current
  })
}

/**
 * Server rule for a delayed driver write. The claim is the attempt the phone
 * started, not whatever the booking says after a reset.
 *
 * @param {number | string | null | undefined} serverVersion
 * @param {number | string | null | undefined} claimedVersion
 */
export function progressClaimAccepted(serverVersion, claimedVersion) {
  if (claimedVersion == null || claimedVersion === '') return false
  return workflowVersionNumber(claimedVersion) === workflowVersionNumber(serverVersion)
}

/**
 * @param {number | null | undefined} storedVersion
 * @param {number | string | null | undefined} serverVersion
 * @returns {'keep' | 'reset'}
 */
export function attemptDecision(storedVersion, serverVersion) {
  const current = workflowVersionNumber(serverVersion)
  if (storedVersion == null) return current > 1 ? 'reset' : 'keep'
  return Number(storedVersion) === current ? 'keep' : 'reset'
}
