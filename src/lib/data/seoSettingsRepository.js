import { supabase, isSupabaseConfigured } from '../supabaseClient'
import {
  SEO_DASHBOARD_ALL_PAGES,
  buildSeoSettingsFallback,
  mergeSeoSettingsWithFallback,
} from '../seoSettingsDefaults'

function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return (
    msg.includes('does not exist') ||
    msg.includes('42p01') ||
    msg.includes('pgrst205') ||
    msg.includes('get_public_seo_settings')
  )
}

/** @returns {Promise<Map<string, import('../seoSettingsDefaults').SeoSettingsRow>>} */
export async function fetchSeoSettingsPublicMap() {
  const map = new Map()
  if (!isSupabaseConfigured) return map
  try {
    const { data, error } = await supabase.rpc('get_public_seo_settings')
    if (error) {
      if (isMissingTableError(error)) return map
      throw error
    }
    for (const row of data || []) {
      if (row?.page_slug && row.page_slug !== '__sitemap__') map.set(row.page_slug, row)
    }
    return map
  } catch {
    return map
  }
}

/** @returns {Promise<Map<string, import('../seoSettingsDefaults').SeoSettingsRow>>} */
export async function fetchSeoSettingsAdminMap() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.')
  }
  const { data, error } = await supabase.from('seo_settings').select('*')
  if (error) {
    if (isMissingTableError(error)) {
      const map = new Map()
      for (const def of SEO_DASHBOARD_ALL_PAGES) {
        map.set(def.pageSlug, buildSeoSettingsFallback(def))
      }
      return map
    }
    throw error
  }
  const map = new Map()
  for (const row of data || []) {
    if (row?.page_slug === '__sitemap__') map.set('__sitemap__', row)
  }
  for (const def of SEO_DASHBOARD_ALL_PAGES) {
    const saved = (data || []).find((r) => r.page_slug === def.pageSlug)
    map.set(def.pageSlug, mergeSeoSettingsWithFallback(saved, def))
  }
  return map
}

/** @param {import('../seoSettingsDefaults').SeoSettingsRow} row */
export async function upsertSeoSettingsRow(row) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.')
  }
  const payload = {
    page_slug: row.page_slug,
    page_type: row.page_type,
    seo_title: row.seo_title || null,
    meta_description: row.meta_description || null,
    og_title: row.og_title || null,
    og_description: row.og_description || null,
    canonical_url: row.canonical_url || null,
    h1: row.h1 || null,
    intro_text: row.intro_text || null,
    cta_text: row.cta_text || null,
    faq_json: row.faq_json || [],
    extra_json: row.extra_json || {},
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: findErr } = await supabase
    .from('seo_settings')
    .select('id')
    .eq('page_slug', row.page_slug)
    .maybeSingle()

  if (findErr && !isMissingTableError(findErr)) throw findErr
  if (findErr && isMissingTableError(findErr)) {
    throw new Error('seo_settings table not found. Apply migration 051_seo_settings.sql in Supabase.')
  }

  if (existing?.id) {
    const { error } = await supabase.from('seo_settings').update(payload).eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('seo_settings').insert(payload)
  if (error) throw error
}

/** @param {string} iso */
export async function saveSitemapGeneratedAt(iso) {
  if (!isSupabaseConfigured) return
  try {
    const { data: existing } = await supabase
      .from('seo_settings')
      .select('id, extra_json')
      .eq('page_slug', '__sitemap__')
      .maybeSingle()
    const extra = { ...(existing?.extra_json || {}), lastGeneratedAt: iso }
    const payload = {
      page_slug: '__sitemap__',
      page_type: 'system',
      extra_json: extra,
      faq_json: [],
      updated_at: new Date().toISOString(),
    }
    if (existing?.id) {
      await supabase.from('seo_settings').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('seo_settings').insert(payload)
    }
  } catch {
    /* optional metadata */
  }
}

/** @param {Map<string, import('../seoSettingsDefaults').SeoSettingsRow>} map */
export function getSitemapLastGenerated(map) {
  const row = map.get('__sitemap__')
  const iso = row?.extra_json?.lastGeneratedAt
  return typeof iso === 'string' && iso ? iso : null
}
