const RECOVERY_STAGES = [
  ['abandoned', 'Customer: quote still reserved'],
  ['abandoned_reminder', 'Customer: quote reminder'],
  ['abandoned_final', 'Customer: final quote reminder'],
]

/**
 * Customer quote emails already recorded on the lead.
 * Earlier stages keep a blank time when only the latest send was stored.
 * @param {Record<string, unknown>|null|undefined} lead
 */
export function recoveryHistoryRowsFromLead(lead) {
  if (!lead || typeof lead !== 'object') return []
  const count = Number(lead.recovery_emails_sent_count || 0)
  const lastKind = String(lead.last_recovery_email_kind || '').trim()
  const lastAt = lead.last_recovery_email_at || null
  const email = String(lead.customer_email || '').trim()
  if (count <= 0 && !lastKind) return []

  if (lastKind === 'payment_failed') {
    return [historyRow('payment_failed', 'Customer: payment unsuccessful', lastAt, email)]
  }

  const knownIndex = RECOVERY_STAGES.findIndex(([kind]) => kind === lastKind)
  const stageCount = Math.max(Number.isFinite(count) ? count : 0, knownIndex >= 0 ? knownIndex + 1 : 0)
  const shown = Math.min(RECOVERY_STAGES.length, stageCount)
  if (shown <= 0) return []

  return RECOVERY_STAGES.slice(0, shown).map(([kind, label]) =>
    historyRow(kind, label, kind === lastKind ? lastAt : null, email),
  )
}

function historyRow(kind, label, sentAt, email) {
  return {
    id: `lead-recovery-${kind}`,
    event_key: `quote_recovery_${kind}`,
    event_label: label,
    recipient_email: email,
    sent_at: sentAt,
    delivery_status: 'sent',
  }
}

const RECOVERY_KIND_BY_EVENT = {
  quote_recovery_abandoned: 'abandoned',
  quote_recovery_abandoned_reminder: 'abandoned_reminder',
  quote_recovery_abandoned_final: 'abandoned_final',
  quote_recovery_payment_failed: 'payment_failed',
}

/** @param {unknown} eventKey */
export function recoveryKindFromEventKey(eventKey) {
  return RECOVERY_KIND_BY_EVENT[String(eventKey || '')] || null
}
