-- Driver app: read inventory lines for assigned bookings (Job Details checklist).
-- Requires driver_has_quote_assignment() (062+ includes on_way / pickup workflow).

begin;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quote_inventory_items'
  ) then
    alter table public.quote_inventory_items enable row level security;

    drop policy if exists "drivers_select_assigned_quote_inventory" on public.quote_inventory_items;
    create policy "drivers_select_assigned_quote_inventory"
      on public.quote_inventory_items
      for select
      to authenticated
      using (public.driver_has_quote_assignment(quote_id));

    grant select on table public.quote_inventory_items to authenticated;
  end if;
end $$;

comment on table public.quote_inventory_items is
  'Per-quote inventory lines from checkout. authenticated: admin CRUD; drivers SELECT when assigned (065).';

commit;
