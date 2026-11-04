-- Reproducible profile-photo storage. Drivers upload only into
-- drivers/{their driver id}/. The bucket is public so the saved URL loads.
-- Other drivers cannot list or replace someone else's object.

begin;

alter table public.drivers
  add column if not exists profile_photo_url text;

alter table public.drivers
  add column if not exists avatar_url text;

comment on column public.drivers.profile_photo_url is
  'Public URL for the driver profile photo in the driver-profile-photos bucket.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-profile-photos',
  'driver-profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists driver_profile_photos_insert_own on storage.objects;
drop policy if exists driver_profile_photos_update_own on storage.objects;
drop policy if exists driver_profile_photos_select_own on storage.objects;
drop policy if exists driver_profile_photos_select_authenticated on storage.objects;
drop policy if exists driver_profile_photos_select_admin on storage.objects;

create policy driver_profile_photos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-profile-photos'
    and (storage.foldername(name))[1] = 'drivers'
    and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
  );

create policy driver_profile_photos_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'driver-profile-photos'
    and (storage.foldername(name))[1] = 'drivers'
    and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
  )
  with check (
    bucket_id = 'driver-profile-photos'
    and (storage.foldername(name))[1] = 'drivers'
    and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
  );

create policy driver_profile_photos_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-profile-photos'
    and (
      public.auth_is_admin_session()
      or (
        (storage.foldername(name))[1] = 'drivers'
        and ((storage.foldername(name))[2])::uuid = public.auth_driver_id()
      )
    )
  );

commit;
