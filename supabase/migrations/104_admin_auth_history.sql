-- Show earlier admin logins stored by Supabase Auth.
-- Those rows have a sign-in time and a last-active time. They do not store sign-out.

begin;

create or replace function public.list_admin_auth_history()
returns table (
  id uuid,
  email text,
  signed_in_at timestamptz,
  last_active_at timestamptz,
  user_agent text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.auth_is_admin_session() then
    raise exception 'admin only';
  end if;

  return query
  select
    s.id,
    u.email::text,
    s.created_at,
    s.updated_at,
    s.user_agent
  from auth.sessions s
  join auth.users u on u.id = s.user_id
  where coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
     or coalesce(u.raw_user_meta_data ->> 'role', '') = 'admin'
  order by s.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_admin_auth_history() from public;
revoke all on function public.list_admin_auth_history() from anon;
grant execute on function public.list_admin_auth_history() to authenticated;

comment on function public.list_admin_auth_history() is
  'Admin-only list of saved Auth sessions: sign-in time and last activity. No sign-out time is stored.';

commit;
