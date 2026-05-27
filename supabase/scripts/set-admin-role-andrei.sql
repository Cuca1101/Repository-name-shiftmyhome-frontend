-- Set admin role for Add Driver / admin Edge Functions (run once in SQL Editor).

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(trim(email)) = lower(trim('andreiandrei626@gmail.com'));

select id, email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where lower(trim(email)) = lower(trim('andreiandrei626@gmail.com'));
