/**
 * Pure recovery cadence. No email send. Shared by the edge function and Node tests.
 */

export function nextRecoveryAtAfterSend(kind, lead, from = new Date()) {
  const anchorIso = lead.abandoned_at || lead.payment_failed_at || from.toISOString()
  const anchor = new Date(anchorIso).getTime()
  if (kind === 'abandoned') {
    return new Date(anchor + 24 * 60 * 60 * 1000).toISOString()
  }
  if (kind === 'abandoned_reminder') {
    return new Date(anchor + 72 * 60 * 60 * 1000).toISOString()
  }
  if (kind === 'payment_failed') {
    return null
  }
  return null
}

export function kindForAbandonedCount(sentCount) {
  if (sentCount <= 0) return 'abandoned'
  if (sentCount === 1) return 'abandoned_reminder'
  if (sentCount === 2) return 'abandoned_final'
  return null
}

export function alreadySentStage(lead, kind) {
  const count = Number(lead.recovery_emails_sent_count || 0)
  const lastKind = String(lead.last_recovery_email_kind || '')
  if (lastKind === kind) return true
  if (kind === 'abandoned' && count >= 1) return true
  if (kind === 'abandoned_reminder' && count >= 2) return true
  if (kind === 'abandoned_final' && count >= 3) return true
  if (kind === 'payment_failed' && lastKind === 'payment_failed') return true
  return false
}

/** Same selection as process-quote-recovery. Null means the cadence is finished, not a dropped send. */
export function recoveryKindForDueLead(lead) {
  const lastKind = String(lead?.last_recovery_email_kind || '')
  if (lead?.status === 'payment_failed' && lastKind !== 'payment_failed') return 'payment_failed'
  if (lead?.status === 'abandoned') return kindForAbandonedCount(Number(lead.recovery_emails_sent_count || 0))
  return null
}

export function leadIsDueForRecovery(lead, nowIso) {
  if (!lead) return false
  if (lead.recovery_stopped_at) return false
  const email = String(lead.customer_email || '').trim()
  if (!email) return false
  if (lead.status !== 'abandoned' && lead.status !== 'payment_failed') return false
  if (!lead.next_recovery_email_at) return false
  return String(lead.next_recovery_email_at) <= String(nowIso)
}
