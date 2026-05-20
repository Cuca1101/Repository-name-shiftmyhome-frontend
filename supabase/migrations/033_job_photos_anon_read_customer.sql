-- Allow anon clients to read customer photo metadata for a quote ref (dedup on re-upload).
-- Does not grant storage listing; bucket remains private with authenticated signed URLs in admin.

drop policy if exists "Anon read customer job photos by quote ref" on public.job_photos;
create policy "Anon read customer job photos by quote ref"
  on public.job_photos
  for select
  to anon
  using (
    uploaded_by = 'customer'
    and quote_ref ~ '^SMH-[0-9]{4}-[0-9]{6}$'
  );
