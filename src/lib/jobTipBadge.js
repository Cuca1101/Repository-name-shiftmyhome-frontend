/**
 * @param {Record<string, unknown> | null | undefined} quote
 * @returns {{ amount: number, label: string } | null}
 */
export function tipBadgeForQuote(quote) {
  const amount = Number(quote?.tip_total_gbp)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return {
    amount,
    label: `Tip £${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`,
  }
}
