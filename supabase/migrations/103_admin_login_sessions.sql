-- Admin panel sign-in journal: who signed in, last activity, and sign-out time.

begin;

create table if not exists public.admin_login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  signed_out_at timestamptz,
  user_agent text,
  constraint admin_login_sessions_email_len check (char_length(email) between 1 and 320),
  constraint admin_login_sessions_ua_len check (user_agent is null or char_length(user_agent) <= 512),
  constraint admin_login_sessions_seen_after_in check (last_seen_at >= signed_in_at),
  constraint admin_login_sessions_out_after_in check (signed_out_at is null or signed_out_at >= signed_in_at)
);

create index if not exists admin_login_sessions_signed_in_idx
  on public.admin_login_sessions (signed_in_at desc);

create index if not exists admin_login_sessions_user_open_idx
  on public.admin_login_sessions (user_id)
  where signed_out_at is null;

create or replace function public.admin_login_sessions_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'admin login session requires an authenticated user';
    end if;
    new.user_id := auth.uid();
    new.email := coalesce(nullif(auth.jwt() ->> 'email', ''), nullif(new.email, ''), 'unknown');
    new.signed_in_at := now();
    new.last_seen_at := now();
    new.signed_out_at := null;
    new.user_agent := nullif(left(coalesce(new.user_agent, ''), 512), '');
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.email := old.email;
  new.signed_in_at := old.signed_in_at;
  new.user_agent := old.user_agent;

  if old.signed_out_at is not null then
    return old;
  end if;

  if new.signed_out_at is not null then
    -- Closing a stale visit keeps the last heartbeat. A real sign-out stamps now().
    if new.signed_out_at <= old.last_seen_at + interval '5 seconds' then
      new.signed_out_at := old.last_seen_at;
      new.last_seen_at := old.last_seen_at;
    else
      new.signed_out_at := now();
      new.last_seen_at := now();
    end if;
    return new;
  end if;

  new.last_seen_at := now();
  new.signed_out_at := null;
  return new;
end;
$$;

drop trigger if exists admin_login_sessions_stamp on public.admin_login_sessions;
create trigger admin_login_sessions_stamp
  before insert or update on public.admin_login_sessions
  for each row
  execute function public.admin_login_sessions_stamp();

alter table public.admin_login_sessions enable row level security;

drop policy if exists "Admins read login sessions" on public.admin_login_sessions;
create policy "Admins read login sessions"
  on public.admin_login_sessions
  for select
  to authenticated
  using (public.auth_is_admin_session());

drop policy if exists "Admins insert own login session" on public.admin_login_sessions;
create policy "Admins insert own login session"
  on public.admin_login_sessions
  for insert
  to authenticated
  with check (
    public.auth_is_admin_session()
    and user_id = auth.uid()
  );

drop policy if exists "Admins update own login session" on public.admin_login_sessions;
create policy "Admins update own login session"
  on public.admin_login_sessions
  for update
  to authenticated
  using (
    public.auth_is_admin_session()
    and user_id = auth.uid()
  )
  with check (
    public.auth_is_admin_session()
    and user_id = auth.uid()
  );

revoke all on table public.admin_login_sessions from public;
revoke all on table public.admin_login_sessions from anon;
grant select, insert, update on table public.admin_login_sessions to authenticated;
revoke delete, truncate, references, trigger on table public.admin_login_sessions from authenticated;

revoke all on function public.admin_login_sessions_stamp() from public;
revoke all on function public.admin_login_sessions_stamp() from anon;
grant execute on function public.admin_login_sessions_stamp() to authenticated;

comment on table public.admin_login_sessions is
  'Admin web sign-ins. signed_out_at is set on Sign out. If the browser is closed, last_seen_at is the last moment the panel was open.';

commit;
