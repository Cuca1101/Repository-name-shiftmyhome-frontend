-- pricing_settings singleton: admin web session read/write (driver app reads via Edge Functions).

begin;

create table if not exists public.pricing_settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pricing_settings_singleton check (id = 1)
);

insert into public.pricing_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;

drop policy if exists "Authenticated manage pricing settings" on public.pricing_settings;
drop policy if exists "Admin session manage pricing settings" on public.pricing_settings;

create policy "Admin session manage pricing settings"
  on public.pricing_settings
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

grant select, insert, update, delete on table public.pricing_settings to authenticated;

comment on table public.pricing_settings is
  'Pricing engine singleton (id=1). Admin session CRUD; driver app uses Edge Functions (service role).';

commit;
