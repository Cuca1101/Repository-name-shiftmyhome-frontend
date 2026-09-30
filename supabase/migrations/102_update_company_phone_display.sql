-- Show the Amazon Connect number on the site. Leave the WhatsApp line unchanged.

update public.website_settings
set
  navbar = navbar || '{"phoneDisplay": "02046407048", "phoneTel": "02046407048"}'::jsonb,
  footer = footer || '{"phoneDisplay": "02046407048", "phoneTel": "02046407048"}'::jsonb,
  updated_at = now()
where id = 'default';
