-- Sync official phone + WhatsApp in CMS navbar/footer.
update public.website_settings
set
  navbar = navbar || '{"phoneDisplay": "07440365226", "phoneTel": "07440365226"}'::jsonb,
  footer = footer
    || '{"phoneDisplay": "07440365226", "phoneTel": "07440365226"}'::jsonb
    || jsonb_build_object(
      'socialLinks',
      coalesce(footer->'socialLinks', '{}'::jsonb)
        || '{"whatsapp": "https://wa.me/447440365226"}'::jsonb
    ),
  updated_at = now()
where id = 'default';
