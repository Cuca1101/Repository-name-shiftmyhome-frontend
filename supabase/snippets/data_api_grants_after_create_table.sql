-- Copy/paste after CREATE TABLE + RLS in new migrations (Supabase Data API explicit grants).
-- See supabase/docs/data-api-grants.md

-- --- Example: public marketing table (anon read) ---
-- grant select on table public.your_public_table to anon;
-- grant select, insert, update, delete on table public.your_public_table to authenticated;
-- comment on table public.your_public_table is
--   'Short description. anon: SELECT (public site). authenticated: admin CRUD via RLS.';

-- --- Example: sensitive operational table (authenticated only) ---
-- grant select, insert, update, delete on table public.your_sensitive_table to authenticated;
-- comment on table public.your_sensitive_table is
--   'Short description. authenticated only (admin/driver RLS). No anon Data API access.';

-- --- Example: anon insert-only (e.g. public lead form) ---
-- grant insert on table public.quotes to anon;
-- grant select, insert, update, delete on table public.quotes to authenticated;
