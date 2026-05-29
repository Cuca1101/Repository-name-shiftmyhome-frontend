-- Customer / driver quote & job photos (private storage + metadata).
-- Customer uploads via anon after quote submit; admin reads via authenticated session.
-- Idempotent: safe to re-run in Supabase SQL Editor if a prior partial run created job_photos without quote_ref.

-- ---------------------------------------------------------------------------
-- Storage bucket: quote-photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-photos',
  'quote-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Table: job_photos (create shell, then add/align columns)
-- ---------------------------------------------------------------------------
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid()
);

alter table public.job_photos add column if not exists quote_ref text;
alter table public.job_photos add column if not exists job_id uuid;
alter table public.job_photos add column if not exists storage_path text;
alter table public.job_photos add column if not exists file_name text;
alter table public.job_photos add column if not exists mime_type text;
alter table public.job_photos add column if not exists size_bytes bigint;
alter table public.job_photos add column if not exists uploaded_by text;
alter table public.job_photos add column if not exists source_label text;
alter table public.job_photos add column if not exists photo_type text;
alter table public.job_photos add column if not exists created_at timestamptz;

alter table public.job_photos alter column uploaded_by set default 'customer';
alter table public.job_photos alter column source_label set default 'Added by customer';
alter table public.job_photos alter column photo_type set default 'general';
alter table public.job_photos alter column created_at set default now();

-- NOT NULL only when no violating rows (fresh or empty table)
do $$
begin
  if not exists (select 1 from public.job_photos where quote_ref is null limit 1) then
    alter table public.job_photos alter column quote_ref set not null;
  end if;
  if not exists (select 1 from public.job_photos where storage_path is null limit 1) then
    alter table public.job_photos alter column storage_path set not null;
  end if;
  if not exists (select 1 from public.job_photos where file_name is null limit 1) then
    alter table public.job_photos alter column file_name set not null;
  end if;
  if not exists (select 1 from public.job_photos where uploaded_by is null limit 1) then
    alter table public.job_photos alter column uploaded_by set not null;
  end if;
  if not exists (select 1 from public.job_photos where source_label is null limit 1) then
    alter table public.job_photos alter column source_label set not null;
  end if;
  if not exists (select 1 from public.job_photos where photo_type is null limit 1) then
    alter table public.job_photos alter column photo_type set not null;
  end if;
  if not exists (select 1 from public.job_photos where created_at is null limit 1) then
    alter table public.job_photos alter column created_at set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_photos_storage_path_unique'
      and conrelid = 'public.job_photos'::regclass
  ) then
    alter table public.job_photos
      add constraint job_photos_storage_path_unique unique (storage_path);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_photos_uploaded_by_check'
      and conrelid = 'public.job_photos'::regclass
  ) then
    alter table public.job_photos
      add constraint job_photos_uploaded_by_check
      check (uploaded_by in ('customer', 'driver', 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_photos_photo_type_check'
      and conrelid = 'public.job_photos'::regclass
  ) then
    alter table public.job_photos
      add constraint job_photos_photo_type_check
      check (photo_type in ('collection', 'delivery', 'damage', 'proof', 'general'));
  end if;
end $$;

-- Indexes (after quote_ref column is guaranteed to exist)
create index if not exists job_photos_quote_ref_idx on public.job_photos (quote_ref);
create index if not exists job_photos_job_id_idx on public.job_photos (job_id);
create index if not exists job_photos_created_at_idx on public.job_photos (created_at desc);

alter table public.job_photos enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: job_photos
-- ---------------------------------------------------------------------------
drop policy if exists "Anon insert customer job photos" on public.job_photos;
create policy "Anon insert customer job photos"
  on public.job_photos
  for insert
  to anon
  with check (
    uploaded_by = 'customer'
    and source_label = 'Added by customer'
    and photo_type = 'general'
    and quote_ref ~ '^SMH-[0-9]{4}-[0-9]{6}$'
    and length(trim(storage_path)) > 0
    and length(trim(file_name)) > 0
  );

drop policy if exists "Authenticated read job photos" on public.job_photos;
create policy "Authenticated read job photos"
  on public.job_photos
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert job photos" on public.job_photos;
create policy "Authenticated insert job photos"
  on public.job_photos
  for insert
  to authenticated
  with check (true);

-- Data API grants: customer anon upload/read (033); admin/driver via authenticated RLS.
grant select, insert on table public.job_photos to anon;
grant select, insert, update, delete on table public.job_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies: quote-photos bucket (path folder = quote ref, not a DB column)
-- ---------------------------------------------------------------------------
drop policy if exists "quote_photos_storage_insert_anon" on storage.objects;
create policy "quote_photos_storage_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'quote-photos'
    and (storage.foldername(name))[1] ~ '^SMH-[0-9]{4}-[0-9]{6}$'
  );

drop policy if exists "quote_photos_storage_insert_authenticated" on storage.objects;
create policy "quote_photos_storage_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'quote-photos');

drop policy if exists "quote_photos_storage_select_authenticated" on storage.objects;
create policy "quote_photos_storage_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'quote-photos');
