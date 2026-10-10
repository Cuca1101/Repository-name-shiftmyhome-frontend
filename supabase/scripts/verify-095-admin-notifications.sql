select 'quotes.booking_notification_sent_at' as check_item,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quotes' and column_name='booking_notification_sent_at'
  ) as ok
union all
select 'customer_leads.abandoned_notification_sent_at',
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='customer_leads' and column_name='abandoned_notification_sent_at'
  )
union all
select 'customer_lead_notifications',
  exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='customer_lead_notifications'
  );
