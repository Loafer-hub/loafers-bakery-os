create table if not exists public.email_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  order_id uuid references public.customer_orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'test',
    'accepted',
    'bakeProgress',
    'comments',
    'ready',
    'rejected',
    'completed'
  )),
  event_key text not null,
  recipient text not null,
  subject text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists email_notification_delivery_dedupe_idx
on public.email_notification_deliveries(order_id, event_key, recipient)
where order_id is not null and status in ('pending', 'sent');

create index if not exists email_notification_delivery_bakery_created_idx
on public.email_notification_deliveries(bakery_id, created_at desc);

alter table public.email_notification_deliveries enable row level security;
revoke all on public.email_notification_deliveries from anon, authenticated;
grant select on public.email_notification_deliveries to authenticated;

create policy "email_delivery_member_read"
on public.email_notification_deliveries for select to authenticated
using (public.is_bakery_member(bakery_id));

update public.bakery_settings
set settings = settings
  || jsonb_build_object(
    'automaticEmailNotifications',
    coalesce((settings ->> 'automaticEmailNotifications')::boolean, true),
    'emailReplyTo',
    coalesce(settings ->> 'emailReplyTo', '')
  )
  || jsonb_build_object(
    'notificationEvents',
    coalesce(settings -> 'notificationEvents', '{}'::jsonb)
      || jsonb_build_object(
        'completed',
        coalesce((settings -> 'notificationEvents' ->> 'completed')::boolean, true)
      )
  );
