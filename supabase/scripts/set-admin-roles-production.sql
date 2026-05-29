-- Set admin role for primary admin accounts (run after 071).

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(trim(email)) in (
  lower(trim('admin@shiftmyhome.co.uk')),
  lower(trim('andreiandrei626@gmail.com')),
  lower(trim('samy.gligor@gmail.com'))
);

select id, email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where raw_app_meta_data ->> 'role' = 'admin'
order by email;
