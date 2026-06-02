-- Homepage coverage section: no city list (admin-controlled; empty by default).
update public.website_settings
set
  coverage = coalesce(coverage, '{}'::jsonb) || '{"cities": []}'::jsonb,
  updated_at = now()
where id = 'default';
