# Driver App RLS audit (admin / Supabase project)

**Status:** Apply `058_driver_app_rls_production.sql` in Supabase SQL Editor, then run audit + manual tests below.

Run in Supabase SQL Editor:

```sql
\i supabase/scripts/driver-app-rls-audit.sql
```

(or paste the `SELECT` from that file)

---

## Current policy audit (from repo migrations 028–057)

Policies **in git** for the four tables:

### `drivers` (056)

| Policy | CMD | Roles | Qual / check | Risk |
|--------|-----|-------|----------------|------|
| Drivers read own profile | SELECT | authenticated | `user_id = auth.uid()` | OK for drivers |
| Authenticated manage drivers admin | **ALL** | authenticated | `true` / `true` | **CRITICAL** — any authenticated user (including drivers) can read/update **all** driver rows |

### `job_assignments` (057)

| Policy | CMD | Roles | Qual / check | Risk |
|--------|-----|-------|----------------|------|
| Authenticated manage job assignments | **ALL** | authenticated | `true` / `true` | **CRITICAL** — drivers can see/edit **all** assignments |
| Drivers read own job assignments | SELECT | authenticated | `driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())` | OK but **overridden** by ALL policy above |

### `quotes` (028, 047–049)

| Policy | CMD | Roles | Notes |
|--------|-----|-------|--------|
| Anon / home page insert | INSERT | anon | Public leads only |
| Authenticated insert public quote leads | INSERT | authenticated | Public leads |
| Authenticated delete public quote leads | DELETE | authenticated | Unpaid leads only |
| **No SELECT policy in repo** | — | — | Production may have manual policies or RLS off; admin web expects broad read |

### `job_status_history`

| Policy | Notes |
|--------|--------|
| **Table not in repo** | Mobile “Start / Arrived / GPS” likely fails or uses another table until created |

---

## How PostgreSQL RLS combines policies

For each command, **any** permissive policy that passes grants access. So:

`Drivers read own job assignments` **does not restrict** drivers if `Authenticated manage job assignments` also exists with `USING (true)`.

**Fix:** Remove broad `USING (true)` policies for `authenticated`; split **admin session** vs **driver session**.

---

## Missing policies for production Driver App

| Requirement | In repo today? | Proposal 058 |
|-------------|----------------|--------------|
| Driver SELECT own `drivers` row | Partial (broken by ALL) | Keep + fix admin policy |
| Driver SELECT own `job_assignments` | Partial (broken by ALL) | Admin ALL → admin-only; driver SELECT |
| Driver UPDATE own `job_assignments` | Missing | `Drivers update own job assignments` |
| Driver SELECT assigned `quotes` | Missing | `Drivers read assigned quotes` |
| Driver UPDATE quote status only | Missing | `Drivers update assigned quote workflow` + trigger guard |
| Driver INSERT `job_status_history` | Missing (no table) | Create table + INSERT policy |
| Driver cannot INSERT assignments | Not enforced | No driver INSERT policy |
| Admin retains full access | Broken model (same role) | `auth_is_admin_session()` policies |

---

## Helper functions (058)

| Function | Purpose |
|----------|---------|
| `auth_driver_id()` | `drivers.id` where `user_id = auth.uid()` and `active` |
| `auth_is_admin_session()` | Logged in, **no** driver row, JWT role ≠ `driver` |
| `driver_has_quote_assignment(uuid)` | Active `job_assignments` row for current driver |

**Admin vs driver:** Admin Auth users should **not** have a `drivers.user_id` link. Driver Auth users **must** have one (created via Create Driver account).

Recommended: set `app_metadata.role = 'admin'` on admin users and `role = 'driver'` on driver users (058 already blocks admin policy when role is `driver`).

---

## RLS risks found

1. **Broad `authenticated` ALL policies (056–057)** — drivers can access all fleet data until 058 is applied.
2. **`auth_is_admin_session()` heuristic** — any authenticated user **without** a `drivers` row is treated as admin (e.g. future partner Auth accounts). Mitigation: use `app_metadata.role` consistently.
3. **`quotes` SELECT in production unknown** — 058 adds explicit admin SELECT; verify no duplicate/conflicting policies after apply.
4. **Column-level UPDATE** — RLS cannot limit columns; 058 adds `quotes_guard_driver_column_updates` trigger for pricing/payment fields.
5. **`operational_status` vs `status`** — App uses `operational_status` heavily; 058 allows both in driver UPDATE check. Align mobile to set `operational_status` to `in_progress` / `arrived` / `completed`.
6. **Realtime** — Unassign sets `job_assignments.status = cancelled`; mobile should filter `status = 'active'` (and legacy `Assigned` if needed).

---

## Expected production behaviour (after 058)

| Action | Driver | Unrelated job |
|--------|--------|----------------|
| List assignments | OK (own rows) | Hidden |
| Read quote details | OK if assigned | 403 / empty |
| Update status / complete | OK | 403 |
| Insert status/GPS history | OK | 403 |
| Change `estimated_total` / Stripe fields | Blocked (trigger) | Blocked |
| Read all drivers | Denied | — |

---

## Apply checklist

1. Run audit SQL **before** apply; save output.
2. Review `058_driver_app_rls_production.sql` in SQL Editor (transaction recommended).
3. Apply migration.
4. Run audit SQL **after**; compare to “Expected policies after” in 058 footer.
5. Test: driver JWT → assigned quote only; admin JWT → full admin access.
6. Mobile: sign in as driver → assigned jobs only; complete job → `job_assignments` + `quotes` update + `job_status_history` insert.

---

## Files

| File | Purpose |
|------|---------|
| `supabase/scripts/driver-app-rls-audit.sql` | Audit query |
| `supabase/migrations/058_driver_app_rls_production.sql` | Proposed RLS (do not auto-deploy) |
| `supabase/docs/driver-app-rls-audit.md` | This document |
