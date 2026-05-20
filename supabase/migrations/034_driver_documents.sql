-- Driver profile fields + private verification documents (admin-only, signed URLs).
-- Idempotent: safe to re-run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Extend drivers table (nullable — existing rows unchanged)
-- ---------------------------------------------------------------------------
alter table public.drivers add column if not exists address text;
alter table public.drivers add column if not exists date_of_birth date;
alter table public.drivers add column if not exists emergency_contact_name text;
alter table public.drivers add column if not exists emergency_contact_phone text;

-- ---------------------------------------------------------------------------
-- Storage bucket: driver-documents (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-documents',
  'driver-documents',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Table: driver_documents
-- ---------------------------------------------------------------------------
create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid()
);

alter table public.driver_documents add column if not exists driver_id uuid;
alter table public.driver_documents add column if not exists document_type text;
alter table public.driver_documents add column if not exists storage_path text;
alter table public.driver_documents add column if not exists file_name text;
alter table public.driver_documents add column if not exists mime_type text;
alter table public.driver_documents add column if not exists size_bytes bigint;
alter table public.driver_documents add column if not exists uploaded_at timestamptz;

alter table public.driver_documents alter column uploaded_at set default now();

do $$
begin
  if not exists (select 1 from public.driver_documents where driver_id is null limit 1) then
    alter table public.driver_documents alter column driver_id set not null;
  end if;
  if not exists (select 1 from public.driver_documents where document_type is null limit 1) then
    alter table public.driver_documents alter column document_type set not null;
  end if;
  if not exists (select 1 from public.driver_documents where storage_path is null limit 1) then
    alter table public.driver_documents alter column storage_path set not null;
  end if;
  if not exists (select 1 from public.driver_documents where file_name is null limit 1) then
    alter table public.driver_documents alter column file_name set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_documents_storage_path_unique'
      and conrelid = 'public.driver_documents'::regclass
  ) then
    alter table public.driver_documents
      add constraint driver_documents_storage_path_unique unique (storage_path);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_documents_type_check'
      and conrelid = 'public.driver_documents'::regclass
  ) then
    alter table public.driver_documents
      add constraint driver_documents_type_check
      check (
        document_type in (
          'licence_front',
          'licence_back',
          'passport_id',
          'proof_of_address'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_documents_driver_type_unique'
      and conrelid = 'public.driver_documents'::regclass
  ) then
    alter table public.driver_documents
      add constraint driver_documents_driver_type_unique unique (driver_id, document_type);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_documents_driver_id_fkey'
      and conrelid = 'public.driver_documents'::regclass
  ) then
    alter table public.driver_documents
      add constraint driver_documents_driver_id_fkey
      foreign key (driver_id) references public.drivers (id) on delete cascade;
  end if;
exception
  when undefined_table then
    null;
end $$;

create index if not exists driver_documents_driver_id_idx on public.driver_documents (driver_id);
create index if not exists driver_documents_uploaded_at_idx on public.driver_documents (uploaded_at desc);

alter table public.driver_documents enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: driver_documents — authenticated admin session only (no anon/public)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated read driver documents" on public.driver_documents;
create policy "Authenticated read driver documents"
  on public.driver_documents
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert driver documents" on public.driver_documents;
create policy "Authenticated insert driver documents"
  on public.driver_documents
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update driver documents" on public.driver_documents;
create policy "Authenticated update driver documents"
  on public.driver_documents
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete driver documents" on public.driver_documents;
create policy "Authenticated delete driver documents"
  on public.driver_documents
  for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage policies: driver-documents bucket
-- Path: {driver_uuid}/{document_type}/{filename}
-- ---------------------------------------------------------------------------
drop policy if exists "driver_docs_storage_insert_authenticated" on storage.objects;
create policy "driver_docs_storage_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] in (
      'licence_front',
      'licence_back',
      'passport_id',
      'proof_of_address'
    )
  );

drop policy if exists "driver_docs_storage_select_authenticated" on storage.objects;
create policy "driver_docs_storage_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'driver-documents');

drop policy if exists "driver_docs_storage_update_authenticated" on storage.objects;
create policy "driver_docs_storage_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'driver-documents')
  with check (bucket_id = 'driver-documents');

drop policy if exists "driver_docs_storage_delete_authenticated" on storage.objects;
create policy "driver_docs_storage_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'driver-documents');
