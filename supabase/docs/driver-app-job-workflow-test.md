# Driver app job workflow — test checklist (Supabase)

Applies after migration `062_driver_job_workflow_sync.sql`.

## Root cause fixed in 062

`driver_has_quote_assignment()` on production only allowed `job_assignments.status IN ('active','completed')`. After **Start Job** the app sets `on_way`, so RLS blocked:

- `INSERT job_status_history`
- `UPDATE quotes.status`
- further `UPDATE job_assignments`

Symptom in app: toast *"Status saved locally. Admin sync failed."*

## Prerequisites

1. Driver Auth user: `app_metadata.role = "driver"`, linked `drivers.user_id`, `active = true`.
2. Admin assigned quote: `quotes.assigned_driver_id` set **and** row in `job_assignments` (`status` `active` / `Accepted`).
3. Migration `062` applied (`npx supabase db push`).

## Manual test (one booking)

Replace `:quote_id` and `:quote_ref` with a real test booking.

### After admin assign

```sql
select q.quote_ref, q.assigned_driver_id, ja.status, ja.driver_id
from quotes q
left join job_assignments ja on ja.quote_id = q.id
where q.id = ':quote_id';
```

Expect: `ja.status` in `active`, `Accepted`, or `Assigned`.

### PICKUP — Start Job

App sets: `on_way` on history, quotes, assignments.

```sql
select status, created_at
from job_status_history
where quote_id = ':quote_id'
order by created_at desc
limit 3;

select status, operational_status from quotes where id = ':quote_id';
select status from job_assignments where quote_id = ':quote_id';

select workflow_status, workflow_at
from booking_workflow_status_v
where quote_id = ':quote_id';
```

Expect: latest history `on_way`; `operational_status` ≈ `On way` (trigger 062).

### PICKUP — Arrived

Expect: `arrived` everywhere; workflow view latest = `arrived`.

### PICKUP — Complete

App sets: history `pickup_completed`, quotes `in_transit`, assignments `in_progress`.

```sql
select status from job_assignments where quote_id = ':quote_id';
-- expect in_progress (booking still Active in app)
```

### DROPOFF — Complete (final)

Expect: history `completed`, quotes `completed`, assignments `completed` + `completed_at` set.

```sql
select completed_at from job_assignments where quote_id = ':quote_id';
```

## Admin Status Tracker

**Correct order:**

1. `booking_workflow_status_v.workflow_status` (latest `job_status_history`)
2. Fallback `quotes.status` / `operational_status`
3. Fallback `job_assignments.status` (often still `Accepted` — misleading alone)

Admin web in this repo still uses `operational_status` + assignment in `buildDispatchTimelineState` — after 062, `operational_status` mirrors driver `quotes.status` updates. For full accuracy, query `booking_workflow_status_v` in admin UI (future enhancement).

## Photo evidence

Driver `INSERT job_photos` requires `uploaded_by = 'driver'` and valid `quote_ref` with assignment (policy in 062).

## GPS

Table: `driver_locations` (not `driver_live_positions`). Grants on `authenticated` in 062.
