-- Website CMS tables (public read, authenticated write). Does not modify existing tables.

-- ---------------------------------------------------------------------------
-- website_settings (singleton JSON sections)
-- ---------------------------------------------------------------------------
create table if not exists public.website_settings (
  id text primary key default 'default',
  homepage jsonb not null default '{}'::jsonb,
  about jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  navbar jsonb not null default '{}'::jsonb,
  footer jsonb not null default '{}'::jsonb,
  announcement jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint website_settings_single_row check (id = 'default')
);

insert into public.website_settings (id) values ('default')
  on conflict (id) do nothing;

alter table public.website_settings enable row level security;

create policy "website_settings_select_public"
  on public.website_settings for select to anon, authenticated using (true);

create policy "website_settings_insert_authenticated"
  on public.website_settings for insert to authenticated with check (id = 'default');

create policy "website_settings_update_authenticated"
  on public.website_settings for update to authenticated
  using (id = 'default') with check (id = 'default');

-- ---------------------------------------------------------------------------
-- website_service_cards
-- ---------------------------------------------------------------------------
create table if not exists public.website_service_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  starting_price text,
  image_url text,
  route_path text not null,
  button_text text not null default 'Get a Quote',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_service_cards_sort_idx
  on public.website_service_cards (is_active, sort_order);

alter table public.website_service_cards enable row level security;

create policy "website_service_cards_select_public"
  on public.website_service_cards for select to anon, authenticated using (true);

create policy "website_service_cards_insert_authenticated"
  on public.website_service_cards for insert to authenticated with check (true);

create policy "website_service_cards_update_authenticated"
  on public.website_service_cards for update to authenticated using (true) with check (true);

create policy "website_service_cards_delete_authenticated"
  on public.website_service_cards for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- website_reviews (homepage CMS reviews — separate from legacy reviews table)
-- ---------------------------------------------------------------------------
create table if not exists public.website_reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  body text not null,
  stars int not null default 5,
  avatar_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_reviews_stars check (stars >= 1 and stars <= 5)
);

create index if not exists website_reviews_sort_idx
  on public.website_reviews (is_active, sort_order);

alter table public.website_reviews enable row level security;

create policy "website_reviews_select_public"
  on public.website_reviews for select to anon, authenticated using (true);

create policy "website_reviews_insert_authenticated"
  on public.website_reviews for insert to authenticated with check (true);

create policy "website_reviews_update_authenticated"
  on public.website_reviews for update to authenticated using (true) with check (true);

create policy "website_reviews_delete_authenticated"
  on public.website_reviews for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- website_media (library metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.website_media (
  id uuid primary key default gen_random_uuid(),
  folder text not null,
  storage_path text not null,
  public_url text not null,
  filename text not null,
  mime_type text,
  alt_text text,
  created_at timestamptz not null default now()
);

create index if not exists website_media_folder_idx on public.website_media (folder, created_at desc);

alter table public.website_media enable row level security;

create policy "website_media_select_public"
  on public.website_media for select to anon, authenticated using (true);

create policy "website_media_insert_authenticated"
  on public.website_media for insert to authenticated with check (true);

create policy "website_media_update_authenticated"
  on public.website_media for update to authenticated using (true) with check (true);

create policy "website_media_delete_authenticated"
  on public.website_media for delete to authenticated using (true);

-- Data API grants (Supabase May/Oct 2026 — explicit opt-in per role)
grant select on table public.website_settings to anon;
grant select, insert, update, delete on table public.website_settings to authenticated;

grant select on table public.website_service_cards to anon;
grant select, insert, update, delete on table public.website_service_cards to authenticated;

grant select on table public.website_reviews to anon;
grant select, insert, update, delete on table public.website_reviews to authenticated;

grant select on table public.website_media to anon;
grant select, insert, update, delete on table public.website_media to authenticated;
