-- Driver app job list: one assignment row per quote (admin assigns driver → mobile sees job).

create table if not exists public.job_assignments (
  quote_id uuid primary key references public.quotes (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  status text not null default 'active',
  scheduled_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_assignments add column if not exists driver_id uuid;
alter table public.job_assignments add column if not exists status text;
alter table public.job_assignments add column if not exists scheduled_date timestamptz;
alter table public.job_assignments add column if not exists created_at timestamptz;
alter table public.job_assignments add column if not exists updated_at timestamptz;

alter table public.job_assignments alter column status set default 'active';

create index if not exists job_assignments_driver_id_idx on public.job_assignments (driver_id);
create index if not exists job_assignments_status_idx on public.job_assignments (status);
create index if not exists job_assignments_updated_at_idx on public.job_assignments (updated_at desc);

comment on table public.job_assignments is 'Links quotes to fleet drivers for the Driver Mobile App.';
comment on column public.job_assignments.status is 'active = visible in app; inactive/cancelled = unassigned; legacy Assigned/Completed/Cancelled also used.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_assignments_status_check'
      and conrelid = 'public.job_assignments'::regclass
  ) then
    alter table public.job_assignments
      add constraint job_assignments_status_check
      check (
        status in (
          'active',
          'inactive',
          'cancelled',
          'Assigned',
          'Accepted',
          'Completed',
          'Cancelled'
        )
      );
  end if;
end $$;

alter table public.job_assignments enable row level security;

-- RLS policies: apply 058_driver_app_rls_production.sql (replaces unsafe authenticated ALL).

drop policy if exists "Authenticated manage job assignments" on public.job_assignments;
drop policy if exists "Drivers read own job assignments" on public.job_assignments;
drop policy if exists "Drivers update own job assignments" on public.job_assignments;
drop policy if exists "Admin session manage job assignments" on public.job_assignments;
