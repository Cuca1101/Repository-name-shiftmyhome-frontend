-- Fix stale WhatsApp link in CMS footer (if migration 082 already ran without socialLinks).
update public.website_settings
set
  footer = footer
    || jsonb_build_object(
      'socialLinks',
      coalesce(footer->'socialLinks', '{}'::jsonb)
        || '{"whatsapp": "https://wa.me/447440365226"}'::jsonb
    ),
  updated_at = now()
where id = 'default';
