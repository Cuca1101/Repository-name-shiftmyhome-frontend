-- Safe SEO/content overrides (admin-managed). No payment, auth, or pricing data.

create table if not exists public.seo_settings (
  id uuid primary key default gen_random_uuid(),
  page_slug text unique not null,
  page_type text not null,
  seo_title text,
  meta_description text,
  og_title text,
  og_description text,
  canonical_url text,
  h1 text,
  intro_text text,
  cta_text text,
  faq_json jsonb not null default '[]'::jsonb,
  extra_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists seo_settings_page_type_idx on public.seo_settings (page_type);

alter table public.seo_settings enable row level security;

drop policy if exists "seo_settings_select_authenticated" on public.seo_settings;
create policy "seo_settings_select_authenticated"
  on public.seo_settings for select to authenticated using (true);

drop policy if exists "seo_settings_insert_authenticated" on public.seo_settings;
create policy "seo_settings_insert_authenticated"
  on public.seo_settings for insert to authenticated with check (true);

drop policy if exists "seo_settings_update_authenticated" on public.seo_settings;
create policy "seo_settings_update_authenticated"
  on public.seo_settings for update to authenticated using (true) with check (true);

drop policy if exists "seo_settings_delete_authenticated" on public.seo_settings;
create policy "seo_settings_delete_authenticated"
  on public.seo_settings for delete to authenticated using (true);

-- Public site reads safe SEO copy via RPC (no direct table exposure to anon).
create or replace function public.get_public_seo_settings()
returns table (
  page_slug text,
  page_type text,
  seo_title text,
  meta_description text,
  og_title text,
  og_description text,
  canonical_url text,
  h1 text,
  intro_text text,
  cta_text text,
  faq_json jsonb,
  extra_json jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    page_slug,
    page_type,
    seo_title,
    meta_description,
    og_title,
    og_description,
    canonical_url,
    h1,
    intro_text,
    cta_text,
    faq_json,
    extra_json,
    updated_at
  from public.seo_settings;
$$;

revoke all on function public.get_public_seo_settings() from public;
grant execute on function public.get_public_seo_settings() to anon, authenticated;
