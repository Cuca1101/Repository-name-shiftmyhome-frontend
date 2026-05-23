-- Starter SEO rows (only when table is empty). Safe content fields only.
INSERT INTO public.seo_settings (
  page_slug, page_type, seo_title, meta_description, og_title, og_description,
  canonical_url, h1, intro_text, cta_text, faq_json, extra_json
)
SELECT * FROM (VALUES
  (
    'home'::text, 'homepage'::text,
    'House Removals Scotland | ShiftMyHome'::text,
    'ShiftMyHome — Professional removals, house moves, office relocations, and man with van across the UK.'::text,
    'House Removals Scotland | ShiftMyHome'::text,
    'ShiftMyHome — Professional removals, house moves, office relocations, and man with van across the UK.'::text,
    'https://www.shiftmyhome.co.uk/'::text,
    NULL::text, NULL::text, NULL::text,
    '[]'::jsonb,
    '{"heroSubheadline":"Professional movers. Reliable service. Get your instant quote in minutes.","trustBadgesText":"Fully insured moves\nProfessional movers\nTransparent pricing","ctaButtonText":"Get an Instant Quote","serviceSectionHeading":"Our removal services"}'::jsonb
  ),
  (
    'house-removals'::text, 'service'::text,
    'House Removals | ShiftMyHome'::text,
    'Full and partial house moves — careful packing, loading, and delivery door to door. Tell us about your home and inventory for an accurate estimate.'::text,
    'House Removals | ShiftMyHome'::text,
    'Full and partial house moves — careful packing, loading, and delivery door to door. Tell us about your home and inventory for an accurate estimate.'::text,
    'https://www.shiftmyhome.co.uk/house-removals'::text,
    'House Removals'::text,
    'Full and partial house moves — careful packing, loading, and delivery door to door. Tell us about your home and inventory for an accurate estimate.'::text,
    'Get an Instant Quote'::text,
    '[]'::jsonb, '{}'::jsonb
  ),
  (
    'man-with-van'::text, 'service'::text,
    'Man and Van | ShiftMyHome'::text,
    'Flexible van and crew for smaller loads, single items, and quick local moves. Tell us what you need moved for a clear estimate.'::text,
    'Man and Van | ShiftMyHome'::text,
    'Flexible van and crew for smaller loads, single items, and quick local moves. Tell us what you need moved for a clear estimate.'::text,
    'https://www.shiftmyhome.co.uk/man-with-van'::text,
    'Man and Van'::text,
    'Flexible van and crew for smaller loads, single items, and quick local moves. Tell us what you need moved for a clear estimate.'::text,
    'Get an Instant Quote'::text,
    '[]'::jsonb, '{}'::jsonb
  ),
  (
    'glasgow'::text, 'city'::text,
    'Glasgow Removals | ShiftMyHome'::text,
    'Book removals in Glasgow (Greater Glasgow). Transparent pricing, Scotland-wide coverage, and professional movers. Get your quote in minutes.'::text,
    'Glasgow Removals | ShiftMyHome'::text,
    'Book removals in Glasgow (Greater Glasgow). Transparent pricing, Scotland-wide coverage, and professional movers. Get your quote in minutes.'::text,
    'https://www.shiftmyhome.co.uk/glasgow-removals'::text,
    'Removals in Glasgow'::text,
    'ShiftMyHome provides professional removals in Glasgow, with crews who know Glasgow and the surrounding towns.'::text,
    'Get an Instant Quote'::text,
    '[]'::jsonb, '{}'::jsonb
  ),
  (
    'edinburgh'::text, 'city'::text,
    'Edinburgh Removals | ShiftMyHome'::text,
    'Book removals in Edinburgh (Edinburgh & the Lothians). Transparent pricing, Scotland-wide coverage, and professional movers. Get your quote in minutes.'::text,
    'Edinburgh Removals | ShiftMyHome'::text,
    'Book removals in Edinburgh (Edinburgh & the Lothians). Transparent pricing, Scotland-wide coverage, and professional movers. Get your quote in minutes.'::text,
    'https://www.shiftmyhome.co.uk/edinburgh-removals'::text,
    'Removals in Edinburgh'::text,
    'Looking for dependable removals in Edinburgh? We support moves across Edinburgh & the Lothians, from compact flats to full-house relocations.'::text,
    'Get an Instant Quote'::text,
    '[]'::jsonb, '{}'::jsonb
  )
) AS seed(page_slug, page_type, seo_title, meta_description, og_title, og_description, canonical_url, h1, intro_text, cta_text, faq_json, extra_json)
WHERE NOT EXISTS (SELECT 1 FROM public.seo_settings LIMIT 1);
