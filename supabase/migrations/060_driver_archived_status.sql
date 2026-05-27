-- Fleet driver archived status (hidden from pickers; row + history retained).

comment on column public.drivers.fleet_status is
  'Active | Inactive | Suspended | Archived — Archived hides from assignment pickers; use instead of hard delete when history exists.';
