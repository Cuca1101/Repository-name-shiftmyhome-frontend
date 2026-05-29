-- Driver evidence (POD, waiver, photos): columns + photo_type constraint + storage RLS.
-- Fixes: job_photos_photo_type_check violation on driver uploads.

begin;

-- Columns used by mobile evidenceService
alter table public.job_photos add column if not exists quote_id uuid references public.quotes (id) on delete set null;
alter table public.job_photos add column if not exists driver_id uuid references public.drivers (id) on delete set null;
alter table public.job_photos add column if not exists job_assignment_id uuid references public.job_assignments (id) on delete set null;
alter table public.job_photos add column if not exists stop_type text;
alter table public.job_photos add column if not exists metadata jsonb;

-- Allow all values the driver app maps to (legacy + evidence types).
alter table public.job_photos drop constraint if exists job_photos_photo_type_check;
alter table public.job_photos add constraint job_photos_photo_type_check
  check (
    photo_type in (
      'collection',
      'delivery',
      'damage',
      'proof',
      'general',
      'pickup',
      'pod_signature',
      'waiver_signature',
      'job_photo',
      'driver_notes'
    )
  );

-- Ensure driver uploaded_by is allowed
alter table public.job_photos drop constraint if exists job_photos_uploaded_by_check;
alter table public.job_photos add constraint job_photos_uploaded_by_check
  check (uploaded_by in ('customer', 'driver', 'admin'));

-- Storage buckets for driver evidence
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-evidence',
  'job-evidence',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'application/json'
]
where id = 'quote-photos';

-- Storage RLS: driver path {quote_id}/{driver_id}/{evidence_type}/file
do $$
declare
  bucket text;
  policy_suffix text;
begin
  foreach bucket in array array['job-photos', 'job-evidence', 'quote-photos'] loop
    policy_suffix := replace(bucket, '-', '_');
    execute format('drop policy if exists %I on storage.objects', 'driver_upload_' || policy_suffix);
    execute format('drop policy if exists %I on storage.objects', 'driver_update_' || policy_suffix);
    execute format('drop policy if exists %I on storage.objects', 'driver_read_own_' || policy_suffix);
    execute format('drop policy if exists %I on storage.objects', 'driver_read_assigned_' || policy_suffix);

    execute format($p$
      create policy driver_upload_%2$s
        on storage.objects for insert to authenticated
        with check (
          bucket_id = %1$L
          and (
            (
              (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and public.driver_has_quote_assignment(((storage.foldername(name))[1])::uuid)
              and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
            )
            or (
              %1$L = 'quote-photos'
              and (storage.foldername(name))[1] ~ '^SMH-[0-9]{4}-[0-9]{4,6}$'
            )
          )
        )
    $p$, bucket, policy_suffix);

    execute format($p$
      create policy driver_update_%2$s
        on storage.objects for update to authenticated
        using (
          bucket_id = %1$L
          and (
            (
              (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and public.driver_has_quote_assignment(((storage.foldername(name))[1])::uuid)
              and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
            )
            or (
              %1$L = 'quote-photos'
              and (storage.foldername(name))[1] ~ '^SMH-[0-9]{4}-[0-9]{4,6}$'
            )
          )
        )
        with check (bucket_id = %1$L)
    $p$, bucket, policy_suffix);

    execute format($p$
      create policy driver_read_own_%2$s
        on storage.objects for select to authenticated
        using (
          bucket_id = %1$L
          and (
            ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
            or bucket_id = 'quote-photos'
          )
        )
    $p$, bucket, policy_suffix);

    execute format($p$
      create policy driver_read_assigned_%2$s
        on storage.objects for select to authenticated
        using (
          bucket_id = %1$L
          and (
            (
              (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and public.driver_has_quote_assignment(((storage.foldername(name))[1])::uuid)
            )
            or (%1$L = 'quote-photos')
          )
        )
    $p$, bucket, policy_suffix);
  end loop;
end $$;

-- job_photos insert: driver + assignment (quote_id or quote_ref)
drop policy if exists "Drivers insert job photos for assignment" on public.job_photos;
drop policy if exists drivers_insert_own_job_photos on public.job_photos;

create policy drivers_insert_own_job_photos
  on public.job_photos
  for insert
  to authenticated
  with check (
    uploaded_by = 'driver'
    and (
      (
        driver_id is not null
        and driver_id = public.auth_driver_id()
        and quote_id is not null
        and public.driver_has_quote_assignment(quote_id)
      )
      or (
        quote_ref is not null
        and quote_ref ~ '^SMH-[0-9]{4}-[0-9]{4,6}$'
        and exists (
          select 1
          from public.quotes q
          where q.quote_ref = job_photos.quote_ref
            and public.driver_has_quote_assignment(q.id)
        )
      )
    )
  );

create policy "Drivers insert job photos for assignment"
  on public.job_photos
  for insert
  to authenticated
  with check (
    public.auth_is_driver_session()
    and uploaded_by = 'driver'
    and (
      (
        quote_id is not null
        and public.driver_has_quote_assignment(quote_id)
      )
      or (
        quote_ref ~ '^SMH-[0-9]{4}-[0-9]{4,6}$'
        and exists (
          select 1
          from public.quotes q
          where q.quote_ref = job_photos.quote_ref
            and public.driver_has_quote_assignment(q.id)
        )
      )
    )
  );

commit;
