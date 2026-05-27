-- ONE-TIME: Mark existing Supabase Auth admin users for RLS (058).
-- Run in SQL Editor after applying 058_driver_app_rls_production.sql.
-- Adjust the email list to your admin accounts.

-- Preview users without admin role:
select id, email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where coalesce(raw_app_meta_data ->> 'role', '') is distinct from 'admin'
order by email;

-- Set app_metadata.role = admin (merge, do not wipe other keys):
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email in (
  'andreiandrei626@gmail.com',
  'admin@shiftmyhome.co.uk'
  -- add more admin emails
);

-- Drivers created via create-driver-account should already have role = driver.
