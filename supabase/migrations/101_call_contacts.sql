-- Shared admin address book for the Call Centre. Admin sessions only.

begin;

create table if not exists public.call_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_original text not null,
  phone_e164 text not null,
  company text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint call_contacts_phone_e164_unique unique (phone_e164),
  constraint call_contacts_phone_e164_format check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create index if not exists call_contacts_name_idx on public.call_contacts (lower(full_name));

create or replace function public.call_contacts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists call_contacts_set_updated_at on public.call_contacts;
create trigger call_contacts_set_updated_at
  before update on public.call_contacts
  for each row
  execute function public.call_contacts_set_updated_at();

alter table public.call_contacts enable row level security;

drop policy if exists "Admin session manage call contacts" on public.call_contacts;
create policy "Admin session manage call contacts"
  on public.call_contacts
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

revoke all on table public.call_contacts from public;
revoke all on table public.call_contacts from anon;
grant select, insert, update, delete on table public.call_contacts to authenticated;
revoke truncate, references, trigger on table public.call_contacts from authenticated;

comment on table public.call_contacts is
  'Admin-only Call Centre address book. Telephone numbers are unique in E.164 form.';

commit;
