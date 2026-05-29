# Data API explicit grants (Supabase 2026)

From **May 30, 2026**, new Supabase projects no longer auto-grant `anon` / `authenticated` on new `public` tables. From **October 30, 2026**, existing projects follow the same rule.

References:

- [Changelog: Tables not exposed automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)

## Rules for this repo

1. Add `GRANT` statements in the **same migration** as `CREATE TABLE` (after RLS policies).
2. Bundle grants with RLS — grants expose the table to a role; policies limit rows.
3. **`authenticated`**: default for admin UI, driver app, and operational data.
4. **`anon`**: only when the marketing site or a dedicated anon client needs direct table access.
5. **Never grant `anon`** on: quotes (except `INSERT` for public leads), payments, drivers, `job_assignments`, invoices, admin tables, funnel PII (`website_leads`), audit logs, etc.
6. Prefer **SECURITY DEFINER RPCs** for anon writes that must bypass row rules safely (`upsert_website_lead`, `get_public_seo_settings`).
7. Do not use `service_role` in the frontend.

Snippet: [`supabase/snippets/data_api_grants_after_create_table.sql`](../snippets/data_api_grants_after_create_table.sql)

Production backfill: [`supabase/migrations/061_data_api_explicit_grants.sql`](../migrations/061_data_api_explicit_grants.sql)

## Migration audit (026–060)

| Migration | Table(s) | Risk after Oct 2026 | Grants in 061 |
|-----------|----------|---------------------|---------------|
| 026 | `website_*` (4) | No implicit grants on fresh env | anon SELECT + authenticated DML |
| 030–033 | `job_photos` | Breaks customer photo upload | anon SELECT, INSERT |
| 031 | `homepage_gallery_items` | Breaks gallery on homepage | anon SELECT |
| 032 | `website_events` | Breaks funnel tracking inserts | anon INSERT |
| 034 | `driver_documents` | Driver/admin docs API | authenticated only |
| 039 | `driver_charges` | Admin/driver charges | authenticated only |
| 040 | `admin_config_secrets` | Marketplace PIN RPC | authenticated only (reads via RPC) |
| 047 | `quotes` (anon insert) | Breaks homepage quote form | anon INSERT (preserved) |
| 051 | `seo_settings` | Admin SEO; public uses RPC | authenticated only |
| 052 | `extra_charge_requests` | Driver extra charges | authenticated only |
| 053 | `driver_payout_audit_log` | Admin audit | authenticated only |
| 055 | `journey_payout_audit_log` | Admin audit | authenticated only |
| 057–058 | `job_assignments`, `job_status_history` | Driver app | authenticated only |

Pre-026 tables (`quotes`, `jobs`, `drivers`, …) are covered by migration **061** (same grant matrix).

## Checklist for new tables

```sql
alter table public.my_table enable row level security;
-- ... policies ...

grant select, insert, update, delete on table public.my_table to authenticated;
-- Optional, only if anon RLS policies exist and the public site calls the table directly:
-- grant select on table public.my_table to anon;

comment on table public.my_table is
  'Why authenticated/anon have each privilege.';
```

After deploy, verify:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name = 'your_table'
order by table_name, grantee, privilege_type;
```
