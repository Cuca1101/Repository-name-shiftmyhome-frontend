-- Admin read/write pricing_settings via SECURITY DEFINER RPC (works even if table RLS misconfigured).

begin;

create or replace function public.admin_get_pricing_settings()
returns table (
  data jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ps.data, ps.updated_at
  from public.pricing_settings ps
  where ps.id = 1;
$$;

create or replace function public.admin_upsert_pricing_settings(p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
begin
  if not public.auth_is_admin_session() then
    raise exception 'Admin session required to save pricing settings.';
  end if;

  insert into public.pricing_settings (id, data, updated_at)
  values (1, coalesce(p_data, '{}'::jsonb), ts)
  on conflict (id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;

  return ts;
end;
$$;

revoke all on function public.admin_get_pricing_settings() from public;
revoke all on function public.admin_upsert_pricing_settings(jsonb) from public;
grant execute on function public.admin_get_pricing_settings() to authenticated;
grant execute on function public.admin_upsert_pricing_settings(jsonb) to authenticated;

comment on function public.admin_get_pricing_settings() is
  'Admin Pricing Engine load (singleton row id=1).';
comment on function public.admin_upsert_pricing_settings(jsonb) is
  'Admin Pricing Engine save (singleton row id=1).';

commit;
