-- Admin session: explicit JWT role=admin only (no legacy “any non-driver” fallback).
-- Drivers must never pass auth_is_admin_session() even if JWT role is missing.

begin;

create or replace function public.auth_is_admin_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.auth_driver_id() is null
    and (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    );
$$;

comment on function public.auth_is_admin_session() is
  'Admin web only: JWT role admin and no linked active drivers row.';

commit;
