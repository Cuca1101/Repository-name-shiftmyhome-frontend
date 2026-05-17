-- Website CMS storage bucket (separate from job/POD/invoice buckets).
-- Folders: hero, services, about, reviews, logos under bucket "website".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website',
  'website',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
create policy "website_storage_select_public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'website');

-- Authenticated upload/update/delete
create policy "website_storage_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'website');

create policy "website_storage_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'website')
  with check (bucket_id = 'website');

create policy "website_storage_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'website');
