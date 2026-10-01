-- Public quote wizard must read the saved Pricing Engine.
-- The table stays admin-only. This RPC is read-only and does not allow anon writes.

begin;

create or replace function public.public_get_pricing_settings()
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

revoke all on function public.public_get_pricing_settings() from public;
grant execute on function public.public_get_pricing_settings() to anon, authenticated;

comment on function public.public_get_pricing_settings() is
  'Read-only Pricing Engine for the public quote wizard. Does not allow updates.';

commit;
