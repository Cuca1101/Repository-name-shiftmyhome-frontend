import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { fetchHomepageGalleryPublic, fetchHomepageGalleryAdmin } from './homepageGalleryRepository'
import {
  DEFAULT_HOMEPAGE,
  DEFAULT_ABOUT,
  DEFAULT_COVERAGE,
  DEFAULT_NAVBAR,
  DEFAULT_FOOTER,
  DEFAULT_ANNOUNCEMENT,
  mergeSection,
} from '../websiteCmsDefaults'

const SETTINGS_ID = 'default'

function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return msg.includes('does not exist') || msg.includes('42p01') || msg.includes('pgrst205')
}

/** @returns {Promise<import('../websiteCmsDefaults').WebsiteCmsBundle|null>} */
export async function fetchWebsiteCmsPublic() {
  if (!isSupabaseConfigured) return null
  try {
    const [settingsRes, cardsRes, reviewsRes, galleryItems] = await Promise.all([
      supabase.from('website_settings').select('*').eq('id', SETTINGS_ID).maybeSingle(),
      supabase
        .from('website_service_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('website_reviews')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      fetchHomepageGalleryPublic(),
    ])

    if (settingsRes.error && isMissingTableError(settingsRes.error)) return null
    if (cardsRes.error && isMissingTableError(cardsRes.error)) return null
    if (reviewsRes.error && isMissingTableError(reviewsRes.error)) return null

    if (settingsRes.error) throw settingsRes.error
    if (cardsRes.error) throw cardsRes.error
    if (reviewsRes.error) throw reviewsRes.error

    const row = settingsRes.data
    return {
      homepage: mergeSection(DEFAULT_HOMEPAGE, row?.homepage),
      about: mergeSection(DEFAULT_ABOUT, row?.about),
      coverage: mergeSection(DEFAULT_COVERAGE, row?.coverage),
      navbar: mergeSection(DEFAULT_NAVBAR, row?.navbar),
      footer: mergeSection(DEFAULT_FOOTER, row?.footer),
      announcement: mergeSection(DEFAULT_ANNOUNCEMENT, row?.announcement),
      serviceCards: cardsRes.data?.length ? cardsRes.data : null,
      reviews: reviewsRes.data?.length ? reviewsRes.data : null,
      galleryItems: galleryItems?.length ? galleryItems : null,
    }
  } catch {
    return null
  }
}

export async function fetchWebsiteCmsAdmin() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [settingsRes, cardsRes, reviewsRes, mediaRes, galleryItems] = await Promise.all([
    supabase.from('website_settings').select('*').eq('id', SETTINGS_ID).maybeSingle(),
    supabase.from('website_service_cards').select('*').order('sort_order', { ascending: true }),
    supabase.from('website_reviews').select('*').order('sort_order', { ascending: true }),
    supabase.from('website_media').select('*').order('created_at', { ascending: false }).limit(200),
    fetchHomepageGalleryAdmin().catch((err) => {
      if (isMissingTableError(err)) return []
      throw err
    }),
  ])

  for (const res of [settingsRes, cardsRes, reviewsRes, mediaRes]) {
    if (res.error) throw res.error
  }

  const row = settingsRes.data
  return {
    settings: {
      homepage: mergeSection(DEFAULT_HOMEPAGE, row?.homepage),
      about: mergeSection(DEFAULT_ABOUT, row?.about),
      coverage: mergeSection(DEFAULT_COVERAGE, row?.coverage),
      navbar: mergeSection(DEFAULT_NAVBAR, row?.navbar),
      footer: mergeSection(DEFAULT_FOOTER, row?.footer),
      announcement: mergeSection(DEFAULT_ANNOUNCEMENT, row?.announcement),
    },
    serviceCards: cardsRes.data ?? [],
    reviews: reviewsRes.data ?? [],
    media: mediaRes.data ?? [],
    galleryItems: galleryItems ?? [],
  }
}

export async function saveWebsiteSettingsSection(sectionKey, data) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

  const { data: existing } = await supabase
    .from('website_settings')
    .select('id')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  const payload = {
    id: SETTINGS_ID,
    [sectionKey]: data,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase.from('website_settings').update(payload).eq('id', SETTINGS_ID)
    if (error) throw error
  } else {
    const { error } = await supabase.from('website_settings').insert(payload)
    if (error) throw error
  }
}

export async function upsertWebsiteServiceCard(card) {
  const { error } = await supabase.from('website_service_cards').upsert({
    ...card,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteWebsiteServiceCard(id) {
  const { error } = await supabase.from('website_service_cards').delete().eq('id', id)
  if (error) throw error
}

export async function upsertWebsiteReview(review) {
  const { error } = await supabase.from('website_reviews').upsert({
    ...review,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteWebsiteReview(id) {
  const { error } = await supabase.from('website_reviews').delete().eq('id', id)
  if (error) throw error
}

export async function deleteWebsiteMedia(id) {
  const { data: row, error: fetchErr } = await supabase
    .from('website_media')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  if (row?.storage_path) {
    await supabase.storage.from('website').remove([row.storage_path])
  }

  const { error } = await supabase.from('website_media').delete().eq('id', id)
  if (error) throw error
}
