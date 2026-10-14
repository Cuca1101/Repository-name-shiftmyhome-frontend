-- Pickup Complete is shown to customers as "Items collected".

create or replace function public.quotes_sync_driver_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
begin
  if public.quote_row_is_completed(old.status, old.operational_status, old.completed_at)
     and not public.auth_is_admin_session() then
    return new;
  end if;

  if not public.auth_is_driver_session() then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));

  new.operational_status := case s
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'in_progress' then 'Left for collection'
    when 'arrived' then 'At collection'
    when 'arrived_pickup' then 'At collection'
    when 'loading' then 'Loading'
    when 'loading_started' then 'Loading'
    when 'pickup_completed' then 'Items collected'
    when 'loaded' then 'Items collected'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'unloading' then 'Unloading'
    when 'unloading_started' then 'Unloading'
    when 'completed' then 'Completed'
    when 'cancelled' then 'Cancelled'
    else new.operational_status
  end;

  if s = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

update public.quotes
set operational_status = 'Items collected'
where lower(trim(coalesce(operational_status, ''))) = 'collection finished';
