/** Format reservation / partial payment amount for quote wizard UI (amount comes from admin `depositAmount`). */
export function formatReservationFeeGbp(amountGbp) {
  const n = Number(amountGbp)
  if (!Number.isFinite(n) || n < 0) return '—'
  return `£${n.toFixed(2)}`
}
