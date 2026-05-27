-- Run in Supabase SQL Editor: verify objects from migrations 053–060 exist.

select 'driver_payout_audit_log' as object, exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'driver_payout_audit_log'
) as present
union all
select 'journey_payout_audit_log', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'journey_payout_audit_log'
)
union all
select 'job_assignments', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'job_assignments'
)
union all
select 'job_status_history', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'job_status_history'
)
union all
select 'drivers.user_id', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'drivers' and column_name = 'user_id'
)
union all
select 'drivers.vehicle_registration', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'drivers' and column_name = 'vehicle_registration'
)
union all
select 'auth_driver_id()', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'auth_driver_id'
)
union all
select 'policy: Admin session manage drivers', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'drivers' and policyname = 'Admin session manage drivers'
)
union all
select 'policy: Authenticated manage drivers admin (UNSAFE)', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'drivers'
    and policyname = 'Authenticated manage drivers admin'
);

select version from supabase_migrations.schema_migrations
where version >= '053'
order by version;
