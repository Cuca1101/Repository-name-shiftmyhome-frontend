-- Verify migration 071: admin session + driver_locations policies

select proname, pg_get_functiondef(p.oid) like '%user_metadata%role%admin%' as has_user_metadata_admin
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'auth_is_admin_session';

select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'driver_locations'
order by policyname;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'job_assignments'
order by policyname;

select count(*) as driver_locations_rows from public.driver_locations;

select id, email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where raw_app_meta_data ->> 'role' = 'admin'
   or raw_user_meta_data ->> 'role' = 'admin'
order by email
limit 20;
