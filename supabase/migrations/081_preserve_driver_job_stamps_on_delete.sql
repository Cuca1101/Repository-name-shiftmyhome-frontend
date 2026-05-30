-- Keep job timeline stamps (who + when) when a fleet driver profile is deleted.
-- Only drivers.id / Auth login are removed; quotes and job_status_history keep names.

begin;

alter table public.job_status_history
  add column if not exists driver_name text;

comment on column public.job_status_history.driver_name is
  'Driver display name snapshot; preserved after drivers row is deleted.';

-- drivers.display name is full_name (there is no drivers.name column)
update public.job_status_history h
set driver_name = coalesce(nullif(trim(h.driver_name), ''), nullif(trim(d.full_name), ''), 'Former driver')
from public.drivers d
where h.driver_id = d.id
  and (h.driver_name is null or trim(h.driver_name) = '');

alter table public.job_status_history
  alter column driver_id drop not null;

alter table public.job_status_history
  drop constraint if exists job_status_history_driver_id_fkey;

alter table public.job_status_history
  add constraint job_status_history_driver_id_fkey
  foreign key (driver_id) references public.drivers (id) on delete set null;

drop view if exists public.booking_workflow_status_v;

create view public.booking_workflow_status_v as
select distinct on (h.quote_id)
  h.quote_id,
  h.status as workflow_status,
  h.created_at as workflow_at,
  h.driver_id,
  h.driver_name,
  h.job_assignment_id,
  h.latitude,
  h.longitude
from public.job_status_history h
where h.quote_id is not null
order by h.quote_id, h.created_at desc;

comment on view public.booking_workflow_status_v is
  'Latest job_status_history row per quote — primary source for admin Status Tracker when driver uses mobile.';

grant select on public.booking_workflow_status_v to authenticated;

commit;
