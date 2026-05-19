import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { deleteHomepageGalleryStorageObject } from './homepageGalleryUpload'

const TABLE = 'homepage_gallery_items'

function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return msg.includes('does not exist') || msg.includes('42p01') || msg.includes('pgrst205')
}

/**
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchHomepageGalleryPublic() {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
    return data ?? []
  } catch {
    return []
  }
}

/**
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchHomepageGalleryAdmin() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * @param {Record<string, unknown>} item
 */
export async function upsertHomepageGalleryItem(item) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  const payload = {
    ...item,
    title: String(item.title || '').trim(),
    city: String(item.city || '').trim(),
    service_type: String(item.service_type || '').trim(),
    description: String(item.description || '').trim(),
    review_text: item.review_text != null ? String(item.review_text).trim() || null : null,
    move_date: item.move_date || null,
    image_url: String(item.image_url || '').trim(),
    image_path: item.image_path != null ? String(item.image_path).trim() || null : null,
    is_active: item.is_active !== false,
    sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
    source_job_photo_id: item.source_job_photo_id ?? null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(TABLE).upsert(payload)
  if (error) throw error
}

/**
 * @param {string} id
 * @param {string|null|undefined} imagePath
 */
export async function deleteHomepageGalleryItem(id, imagePath) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  await deleteHomepageGalleryStorageObject(imagePath)
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

/**
 * Swap sort_order between two items (reorder).
 * @param {string} id
 * @param {'up'|'down'} direction
 * @param {Record<string, unknown>[]} items sorted list
 */
export async function reorderHomepageGalleryItem(id, direction, items) {
  const idx = items.findIndex((r) => r.id === id)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= items.length) return
  const a = items[idx]
  const b = items[swapIdx]
  const orderA = Number(a.sort_order) || 0
  const orderB = Number(b.sort_order) || 0
  await Promise.all([
    upsertHomepageGalleryItem({ ...a, sort_order: orderB }),
    upsertHomepageGalleryItem({ ...b, sort_order: orderA }),
  ])
}
