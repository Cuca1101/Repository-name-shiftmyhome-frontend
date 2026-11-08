-- Per-item specialist handling override + special stair fee (catalogue-driven; no name-based rules).
-- Existing saved quote totals are unchanged; new quotes / explicit recalculations pick up these fields.

alter table public.items_library
  add column if not exists handling_fee_override numeric,
  add column if not exists special_stair_fee_per_floor numeric;

comment on column public.items_library.handling_fee_override is
  'Optional £ handling fee per unit. NULL = use Pricing Engine specialist heavy rate for Weight=Heavy. 0 = no handling fee.';

comment on column public.items_library.special_stair_fee_per_floor is
  'Optional £ special stair fee per floor per unit. NULL = standard floor/no-lift stairs. Set value activates special tariff and excludes item from standard stairs volume.';

-- Snapshot columns on booked inventory (preserve fees at quote time on recalculation).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'quote_inventory_items'
  ) then
    alter table public.quote_inventory_items
      add column if not exists handling_fee_override numeric,
      add column if not exists special_stair_fee_per_floor numeric;
  end if;
end $$;

-- Update existing Upright piano catalogue row (do not insert a duplicate).
update public.items_library
set
  cubic_metres = 1.5,
  weight_type = 'heavy',
  handling_multiplier = 1,
  handling_fee_override = 120,
  special_stair_fee_per_floor = 40
where lower(trim(name)) = 'upright piano';
