-- Glasgow call number for tel: links. WhatsApp stays on its own line.

update public.website_settings
set
  navbar = navbar || '{"phoneDisplay": "0141 461 4813", "phoneTel": "+441414614813"}'::jsonb,
  footer = footer || '{"phoneDisplay": "0141 461 4813", "phoneTel": "+441414614813"}'::jsonb,
  updated_at = now()
where id = 'default';
