-- Public quote calendar: how many confirmed jobs already sit on each move date.
-- Returns counts only (no customer data) so the Step 3 calendar can close a full day.

begin;

create or replace function public.public_quote_day_slot_counts(p_from date, p_to date)
returns table (
  move_date date,
  booked integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 120 then
    return;
  end if;

  return query
  select q.move_date, count(*)::integer
  from public.quotes q
  where q.move_date is not null
    and q.move_date >= p_from
    and q.move_date <= p_to
    and q.cancelled_at is null
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
  group by q.move_date;
end;
$$;

revoke all on function public.public_quote_day_slot_counts(date, date) from public;
grant execute on function public.public_quote_day_slot_counts(date, date) to anon, authenticated;

comment on function public.public_quote_day_slot_counts(date, date) is
  'Confirmed booking counts by move date for the public quote calendar slot limits.';

commit;
