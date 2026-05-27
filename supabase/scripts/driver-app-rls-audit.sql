-- Run in Supabase SQL Editor to audit Driver App RLS (copy results for review).
-- Expected tables: drivers, quotes, job_assignments, job_status_history

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'drivers',
    'quotes',
    'job_assignments',
    'job_status_history'
  )
order by tablename, policyname;

-- Helpers: confirm functions exist after migration 058
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('auth_driver_id', 'driver_has_quote_assignment', 'auth_is_admin_session')
order by p.proname;

-- Quick gap check: tables without RLS enabled
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('drivers', 'quotes', 'job_assignments', 'job_status_history')
  and c.relkind = 'r';
