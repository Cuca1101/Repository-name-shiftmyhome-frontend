-- Customer tracking only listed job_photos rows. Several completed jobs have
-- the image files in quote-photos storage without a matching row, so the
-- portal showed no photos. Return those files for a valid tracking token.

begin;

create or replace function public.tracking_evidence_photos(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_tok public.job_tracking_tokens%rowtype;
  v_q public.quotes%rowtype;
begin
  if p_token is null then
    return '[]'::jsonb;
  end if;

  select * into v_tok from public.job_tracking_tokens where token = p_token limit 1;
  if v_tok.id is null or v_tok.revoked_at is not null or v_tok.expires_at < now() then
    return '[]'::jsonb;
  end if;

  select * into v_q from public.quotes where id = v_tok.quote_id limit 1;
  if v_q.id is null or lower(coalesce(v_q.payment_status, '')) not in ('paid', 'deposit_paid') then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(s) order by s.created_at nulls last)
    from (
      select
        p.id::text as id,
        p.photo_type,
        p.stop_type,
        p.storage_path,
        p.file_name,
        p.mime_type,
        p.uploaded_by,
        p.created_at,
        p.driver_id,
        p.metadata
      from public.job_photos p
      where p.quote_id = v_q.id
         or (nullif(v_q.quote_ref, '') is not null and p.quote_ref = v_q.quote_ref)

      union all

      select
        'storage:' || o.id::text as id,
        case
          when o.folder in ('pod_signature', 'waiver_signature') then o.folder
          when o.file_name like '%damage%' then 'damage'
          when o.file_name like '%delivery%' or o.file_name like '%dropoff%' then 'delivery'
          when o.file_name like '%pickup%' or o.file_name like '%collection%' then 'collection'
          when o.file_name like '%proof%' then 'proof'
          else 'general'
        end as photo_type,
        case
          when o.file_name like '%delivery%' or o.file_name like '%dropoff%' then 'DROPOFF'
          when o.file_name like '%pickup%' or o.file_name like '%collection%' then 'PICKUP'
          else null
        end as stop_type,
        o.name as storage_path,
        o.file_name,
        coalesce(o.metadata->>'mimetype', o.metadata->>'contentType') as mime_type,
        'driver' as uploaded_by,
        o.created_at,
        null::uuid as driver_id,
        null::jsonb as metadata
      from (
        select
          objects.id,
          objects.name,
          objects.created_at,
          objects.metadata,
          split_part(objects.name, '/', 3) as folder,
          lower(
            case
              when split_part(objects.name, '/', 4) <> '' then split_part(objects.name, '/', 4)
              else regexp_replace(objects.name, '^.*/', '')
            end
          ) as file_name
        from storage.objects
        where objects.bucket_id in ('quote-photos', 'job-evidence', 'job-photos')
          and objects.name ~* '\.(jpe?g|png|webp|gif|heic|heif)$'
          and (
            objects.name like v_q.id::text || '/%'
            or (nullif(v_q.quote_ref, '') is not null and objects.name ilike v_q.quote_ref || '/%')
          )
          and not exists (
            select 1
            from public.job_photos p
            where p.storage_path = objects.name
              and (
                p.quote_id = v_q.id
                or (nullif(v_q.quote_ref, '') is not null and p.quote_ref = v_q.quote_ref)
              )
          )
      ) o
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tracking_evidence_photos(uuid) from public, anon, authenticated;
grant execute on function public.tracking_evidence_photos(uuid) to service_role;

commit;
