# Expected RLS after migration 058

Run `driver-app-rls-audit.sql` and confirm policies match below.

## Removed (must NOT appear)

| tablename | policyname |
|-----------|------------|
| drivers | Authenticated manage drivers admin |
| job_assignments | Authenticated manage job assignments |

## Safe policies (must appear)

### drivers

| policyname | cmd |
|------------|-----|
| Admin session manage drivers | ALL |
| Drivers read own profile | SELECT |

### job_assignments

| policyname | cmd |
|------------|-----|
| Admin session manage job assignments | ALL |
| Drivers read own job assignments | SELECT |
| Drivers update own job assignments | UPDATE |

### quotes (driver + admin; plus existing anon insert)

| policyname | cmd |
|------------|-----|
| Authenticated read all quotes | SELECT |
| Authenticated update quotes admin | UPDATE |
| Authenticated insert quotes admin | INSERT |
| Drivers read assigned quotes | SELECT |
| Drivers update assigned quote workflow | UPDATE |

### job_status_history

| policyname | cmd |
|------------|-----|
| Admin session manage job status history | ALL |
| Drivers insert own job status history | INSERT |
| Drivers read own job status history | SELECT |

## Manual test matrix

| Test | JWT | Action | Expected |
|------|-----|--------|----------|
| 1 | admin (`app_metadata.role=admin`) | SELECT from drivers | OK all rows |
| 2 | admin | SELECT from quotes | OK |
| 3 | admin | INSERT job_assignments | OK |
| 4 | driver (`role=driver`, has drivers row) | SELECT own drivers row | OK 1 row |
| 5 | driver | SELECT all drivers | Empty / denied |
| 6 | driver | SELECT assigned quote | OK |
| 7 | driver | SELECT unassigned quote | Denied |
| 8 | driver | UPDATE quote operational_status → in_progress | OK |
| 9 | driver | UPDATE quote estimated_total | Error (trigger) |
| 10 | driver | INSERT job_status_history for assigned quote | OK |
| 11 | driver | UPDATE job_assignments.status → completed | OK |

## Remaining risks

1. **Admin users without `app_metadata.role=admin`** — rely on legacy fallback (no driver row). Run `backfill-auth-admin-role.sql`.
2. **Partner Auth accounts** without driver row — may match admin fallback until given a distinct role.
3. **service_role** in Edge Functions — still bypasses RLS (intended for create-driver-account only).
