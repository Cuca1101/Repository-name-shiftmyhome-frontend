import { useState } from 'react'
import { depositBalanceDue, sendRemainingBalanceEmail } from '../../lib/balancePaymentEmail'

function money(n) {
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{ quote: Record<string, unknown>, className?: string, onSent?: (message: string) => void }} props
 */
export default function SendRemainingBalanceEmailButton({ quote, className = '', onSent }) {
  const due = depositBalanceDue(quote)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  if (!due.show || !quote?.id) return null

  async function send() {
    const paidNote =
      due.paid >= 0.3 ? ` The ${money(due.paid)} already paid stays as it is.` : ''
    const ok = window.confirm(
      `Email ${due.email} a link to pay the remaining balance of ${money(due.remaining)}?${paidNote}`,
    )
    if (!ok) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      const result = await sendRemainingBalanceEmail(String(quote.id))
      const message = `Remaining balance email sent to ${result.to || due.email}.`
      setNote(message)
      onSent?.(message)
    } catch (e) {
      setError(e?.message || 'The email could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={() => void send()} className={className}>
        {busy ? 'Sending…' : 'Request remaining balance'}
      </button>
      {note ? <span className="text-[11px] font-medium text-emerald-700">{note}</span> : null}
      {error ? <span className="text-[11px] font-medium text-red-700">{error}</span> : null}
    </span>
  )
}
