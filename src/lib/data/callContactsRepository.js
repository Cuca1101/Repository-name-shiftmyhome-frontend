import { supabase } from '../supabase'
import { normalisePhone } from '../ukPhone'

function requireClient() {
  if (!supabase) throw new Error('Contacts are not available. Admin sign-in is not configured.')
  return supabase
}

function mapRow(row) {
  return {
    id: row.id,
    fullName: row.full_name || '',
    phoneOriginal: row.phone_original || '',
    phoneE164: row.phone_e164 || '',
    company: row.company || '',
    email: row.email || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by || null,
  }
}

export async function listCallContacts() {
  const client = requireClient()
  const { data, error } = await client
    .from('call_contacts')
    .select('id, full_name, phone_original, phone_e164, company, email, notes, created_at, updated_at, created_by')
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message || 'Could not load contacts.')
  return (data || []).map(mapRow)
}

export async function findCallContactByPhone(phone) {
  const parsed = normalisePhone(phone)
  if (!parsed.ok) return null
  const client = requireClient()
  const { data, error } = await client
    .from('call_contacts')
    .select('id, full_name, phone_original, phone_e164, company, email, notes, created_at, updated_at, created_by')
    .eq('phone_e164', parsed.e164)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Could not look up that contact.')
  return data ? mapRow(data) : null
}

/**
 * @param {{ id?: string, fullName: string, phone: string, company?: string, email?: string, notes?: string, allowUpdate?: boolean }} input
 */
export async function saveCallContact(input) {
  const name = String(input.fullName || '').trim()
  if (!name) throw new Error('Enter the contact name.')
  const parsed = normalisePhone(input.phone)
  if (!parsed.ok) throw new Error(parsed.error)
  const client = requireClient()
  const existing = await findCallContactByPhone(parsed.e164)
  if (existing && existing.id !== input.id) {
    if (input.id || !input.allowUpdate) return { duplicate: existing }
  }
  const { data: userData } = await client.auth.getUser()
  const payload = {
    full_name: name,
    phone_original: String(input.phone || '').trim(),
    phone_e164: parsed.e164,
    company: String(input.company || '').trim() || null,
    email: String(input.email || '').trim() || null,
    notes: String(input.notes || '').trim() || null,
  }
  const targetId = input.id || (input.allowUpdate ? existing?.id : null)
  if (targetId) {
    const { data, error } = await client.from('call_contacts').update(payload).eq('id', targetId).select().single()
    if (error?.code === '23505') {
      const again = await findCallContactByPhone(parsed.e164)
      if (again) return { duplicate: again }
    }
    if (error) throw new Error(error.message || 'Could not update the contact.')
    return { contact: mapRow(data) }
  }
  const { data, error } = await client
    .from('call_contacts')
    .insert({ ...payload, created_by: userData?.user?.id || null })
    .select()
    .single()
  if (error?.code === '23505') {
    const again = await findCallContactByPhone(parsed.e164)
    if (again) return { duplicate: again }
  }
  if (error) throw new Error(error.message || 'Could not save the contact.')
  return { contact: mapRow(data) }
}

export async function deleteCallContact(id) {
  const client = requireClient()
  const { error } = await client.from('call_contacts').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete the contact.')
}
