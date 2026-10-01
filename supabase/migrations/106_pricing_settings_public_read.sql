-- Pricing Engine must stay readable by the public quote wizard.
-- Writes stay admin-only.

begin;

grant select on table public.pricing_settings to anon;

drop policy if exists "Public read pricing settings" on public.pricing_settings;

create policy "Public read pricing settings"
  on public.pricing_settings
  for select
  to anon, authenticated
  using (true);

comment on table public.pricing_settings is
  'Pricing engine singleton (id=1). Public read for quotes. Admin session writes only.';

commit;
