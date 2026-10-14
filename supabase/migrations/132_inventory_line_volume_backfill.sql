-- Driver app job cards read quote_inventory_items.volume_m3.
-- Checkout used to store the line text without copying "~X m³ line vol" onto the row,
-- so the card had no cubes until the driver opened the item.

update public.quote_inventory_items qi
set volume_m3 = parsed.line_m3
from (
  select qi2.id, (m[3])::numeric as line_m3
  from public.quote_inventory_items qi2
  join public.quotes q on q.id = qi2.quote_id
  cross join lateral regexp_matches(
    coalesce(q.inventory_text, ''),
    '•\s*(.+?)\s*×\s*(\d+)\s*\(\s*~\s*([0-9]+(?:\.[0-9]+)?)\s*m³\s*line\s*vol',
    'gi'
  ) as m
  where qi2.volume_m3 is null
    and lower(btrim(qi2.item_name)) = lower(btrim(m[1]))
    and qi2.quantity = (m[2])::int
) parsed
where qi.id = parsed.id;

update public.quote_inventory_items qi
set volume_m3 = round((il.cubic_metres * qi.quantity)::numeric, 2)
from public.items_library il
where qi.volume_m3 is null
  and il.cubic_metres is not null
  and il.cubic_metres > 0
  and lower(btrim(il.name)) = lower(btrim(qi.item_name));

update public.jobs j
set total_cubic_metres = summed.vol
from (
  select job_id, round(sum(line_volume_m3)::numeric, 2) as vol
  from public.job_items
  where line_volume_m3 is not null
  group by job_id
) summed
where j.id = summed.job_id
  and summed.vol is not null
  and (
    j.total_cubic_metres is null
    or abs(j.total_cubic_metres - summed.vol) > 0.05
  );
