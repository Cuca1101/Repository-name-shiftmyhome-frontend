-- Homepage gallery (recent moves photo grid) — public read, authenticated write.
-- Idempotent: safe to re-run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Table: homepage_gallery_items
-- ---------------------------------------------------------------------------
create table if not exists public.homepage_gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  city text not null default '',
  service_type text not null default '',
  description text not null default '',
  review_text text,
  move_date date,
  image_url text not null default '',
  image_path text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  source_job_photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists homepage_gallery_items_sort_idx
  on public.homepage_gallery_items (is_active, sort_order, created_at desc);

alter table public.homepage_gallery_items enable row level security;

drop policy if exists "homepage_gallery_items_select_public" on public.homepage_gallery_items;
create policy "homepage_gallery_items_select_public"
  on public.homepage_gallery_items for select to anon, authenticated using (true);

drop policy if exists "homepage_gallery_items_insert_authenticated" on public.homepage_gallery_items;
create policy "homepage_gallery_items_insert_authenticated"
  on public.homepage_gallery_items for insert to authenticated with check (true);

drop policy if exists "homepage_gallery_items_update_authenticated" on public.homepage_gallery_items;
create policy "homepage_gallery_items_update_authenticated"
  on public.homepage_gallery_items for update to authenticated using (true) with check (true);

drop policy if exists "homepage_gallery_items_delete_authenticated" on public.homepage_gallery_items;
create policy "homepage_gallery_items_delete_authenticated"
  on public.homepage_gallery_items for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket: homepage-gallery (public read for homepage images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-gallery',
  'homepage-gallery',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "homepage_gallery_storage_select_public" on storage.objects;
create policy "homepage_gallery_storage_select_public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'homepage-gallery');

drop policy if exists "homepage_gallery_storage_insert_authenticated" on storage.objects;
create policy "homepage_gallery_storage_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'homepage-gallery');

drop policy if exists "homepage_gallery_storage_update_authenticated" on storage.objects;
create policy "homepage_gallery_storage_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'homepage-gallery')
  with check (bucket_id = 'homepage-gallery');

drop policy if exists "homepage_gallery_storage_delete_authenticated" on storage.objects;
create policy "homepage_gallery_storage_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'homepage-gallery');
