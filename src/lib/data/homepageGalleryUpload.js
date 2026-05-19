import { supabase, isSupabaseConfigured } from '../supabaseClient'

export const HOMEPAGE_GALLERY_BUCKET = 'homepage-gallery'

/**
 * Upload an image for a homepage gallery item (public bucket).
 * @param {File} file
 * @returns {Promise<{ publicUrl: string, storagePath: string }>}
 */
export async function uploadHomepageGalleryImage(file) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file (JPEG, PNG, or WebP).')

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const safeBase = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 60)
  const storagePath = `items/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeBase || 'photo'}.${ext}`

  const { error: uploadError } = await supabase.storage.from(HOMEPAGE_GALLERY_BUCKET).upload(storagePath, file, {
    cacheControl: '86400',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(HOMEPAGE_GALLERY_BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl
  if (!publicUrl) throw new Error('Could not resolve public URL for upload.')

  return { publicUrl, storagePath }
}

/**
 * @param {string|null|undefined} storagePath
 */
export async function deleteHomepageGalleryStorageObject(storagePath) {
  if (!isSupabaseConfigured || !storagePath) return
  await supabase.storage.from(HOMEPAGE_GALLERY_BUCKET).remove([String(storagePath)]).catch(() => {})
}
