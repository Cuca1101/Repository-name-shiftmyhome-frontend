import { supabase, isSupabaseConfigured } from '../supabaseClient'

const BUCKET = 'website'

/** @param {'hero'|'services'|'about'|'reviews'|'logos'} folder */
export async function uploadWebsiteImage(file, folder) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file (JPEG, PNG, WebP).')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  const storagePath = `${folder}/${safeName}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl
  if (!publicUrl) throw new Error('Could not resolve public URL for upload.')

  const { data: row, error: dbError } = await supabase
    .from('website_media')
    .insert({
      folder,
      storage_path: storagePath,
      public_url: publicUrl,
      filename: file.name,
      mime_type: file.type,
    })
    .select()
    .single()

  if (dbError) throw dbError
  return { ...row, publicUrl }
}

/** @param {'hero'} folder */
export async function uploadWebsiteVideo(file, folder = 'hero') {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  const type = file?.type || ''
  const ok =
    type === 'video/mp4' ||
    type === 'video/webm' ||
    type === 'video/quicktime' ||
    /\.(mp4|webm|mov)$/i.test(file?.name || '')
  if (!ok) throw new Error('Please choose an MP4, WebM, or MOV file.')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  const storagePath = `${folder}/${safeName}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: type || 'video/mp4',
  })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl
  if (!publicUrl) throw new Error('Could not resolve public URL for upload.')

  const { data: row, error: dbError } = await supabase
    .from('website_media')
    .insert({
      folder,
      storage_path: storagePath,
      public_url: publicUrl,
      filename: file.name,
      mime_type: type || 'video/mp4',
    })
    .select()
    .single()

  if (dbError) throw dbError
  return { ...row, publicUrl }
}
