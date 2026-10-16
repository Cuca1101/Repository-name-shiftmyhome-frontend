import { isSupabaseConfigured, supabase } from './supabase'
import {
  assertFinanceUnlocked,
  safeReceiptName,
  validateReceiptFile,
} from './financeProfit'
import { enqueueFinanceSession, setFinanceToken } from './financeSession'

export const FINANCE_RECEIPTS_BUCKET = 'finance-receipts'

export class FinanceLockedError extends Error {
  constructor(message) {
    super(message || 'Finance module is locked. Enter the PIN again.')
    this.name = 'FinanceLockedError'
    this.code = 'FINANCE_LOCKED'
  }
}

function assertConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Finance storage is not configured.')
  }
}

function raiseRpc(error) {
  const message = String(error?.message || 'Request failed.')
  if (/schema cache|could not find the function|PGRST202|finance_unlock/i.test(message)) {
    throw new Error('Finance & Profit is not available yet. Apply the latest database migration, then try again.')
  }
  if (/not authorized/i.test(message)) {
    throw new Error('You need an administrator account to open Finance & Profit.')
  }
  if (/locked|enter the pin/i.test(message)) {
    throw new FinanceLockedError('Finance module is locked. Enter the PIN again.')
  }
  throw new Error(message.replace(/^Finance module is locked\.\s*/i, 'Finance module is locked. '))
}

async function rpc(name, args) {
  assertConfigured()
  const { data, error } = await supabase.rpc(name, args)
  if (error) raiseRpc(error)
  if (data && data.ok === false) {
    const failure = new Error(data.error || 'Request failed.')
    if (data.locked) failure.code = 'PIN_LOCKOUT'
    throw failure
  }
  return data
}

export async function unlockFinancePin(pin) {
  return enqueueFinanceSession(async () => {
    const data = await rpc('finance_unlock', { p_pin: String(pin) })
    const next = String(data?.token || '')
    if (next.length < 32) throw new Error('Unlock did not return a session.')
    setFinanceToken(next)
    return next
  })
}

export async function touchFinanceSession(token) {
  assertFinanceUnlocked(token)
  await rpc('finance_touch', { p_token: token })
}

export async function fetchFinance(token, from, to) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_list', { p_token: token, p_from: from, p_to: to })
  return {
    categories: data.categories || [],
    sources: data.sources || [],
    payees: data.payees || [],
    incomes: data.incomes || [],
    expenses: data.expenses || [],
    drivers: data.drivers || [],
    driverDays: data.driver_days || [],
    deductionPercent: data.deduction_percent ?? 25,
  }
}

export async function saveFinanceIncome(token, payload) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_save_income', { p_token: token, p_payload: payload })
  return data.income
}

export async function saveFinanceExpense(token, payload) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_save_expense', { p_token: token, p_payload: payload })
  return data.expense
}

export async function deleteFinanceIncome(token, id) {
  assertFinanceUnlocked(token)
  await rpc('finance_delete_income', { p_token: token, p_id: id })
}

export async function deleteFinanceExpense(token, id) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_delete_expense', { p_token: token, p_id: id })
  return data?.receipt_path || ''
}

export async function saveFinanceDriver(token, payload) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_save_driver', { p_token: token, p_payload: payload })
  return data.driver
}

export async function setFinanceDriverArchived(token, id, archived) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_set_driver_archived', {
    p_token: token,
    p_id: id,
    p_archived: Boolean(archived),
  })
  return data.driver
}

export async function saveFinanceDriverDay(token, payload) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_save_driver_day', { p_token: token, p_payload: payload })
  return data.driver_day
}

export async function deleteFinanceDriverDay(token, id) {
  assertFinanceUnlocked(token)
  await rpc('finance_delete_driver_day', { p_token: token, p_id: id })
}

export async function saveFinanceDeduction(token, percent) {
  assertFinanceUnlocked(token)
  const data = await rpc('finance_set_deduction', { p_token: token, p_percent: percent })
  return data.deduction_percent
}

export async function uploadFinanceReceipt(file) {
  assertConfigured()
  const check = validateReceiptFile(file)
  if (!check.ok) throw new Error(check.error)
  const path = `${crypto.randomUUID()}/${safeReceiptName(file.name)}`
  const { error } = await supabase.storage.from(FINANCE_RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message || 'Could not attach the receipt.')
  return { path, name: file.name }
}

export async function removeFinanceReceipt(path) {
  if (!path || !isSupabaseConfigured || !supabase) return
  await supabase.storage.from(FINANCE_RECEIPTS_BUCKET).remove([path])
}

export async function openFinanceReceipt(path) {
  assertConfigured()
  const { data, error } = await supabase.storage.from(FINANCE_RECEIPTS_BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    throw new Error('Could not open the receipt. Unlock Finance & Profit and try again.')
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
