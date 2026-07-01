-- customer-accounts-access-dashboard-v1
-- Customer saved profiles + owner-only customer access signals.

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  allergies text not null default '',
  preferences text not null default '',
  address text not null default '',
  default_payment_method text not null default 'Venmo',
  favorite_product_id text not null default '',
  favorite_product_name text not null default '',
  favorite_option_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bakery_id, user_id)
);

create index if not exists customer_profiles_user_idx
on public.customer_profiles(user_id);

create index if not exists customer_profiles_bakery_updated_idx
on public.customer_profiles(bakery_id, updated_at desc);

create table if not exists public.customer_access_events (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'magic_link_requested',
    'guest_checkout_blocked',
    'order_submitted',
    'order_failed',
    'profile_saved'
  )),
  reason text not null default '',
  contact_hint text not null default '',
  request_code text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists customer_access_events_bakery_created_idx
on public.customer_access_events(bakery_id, created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.customer_access_events enable row level security;

revoke all on public.customer_profiles from anon, authenticated;
revoke all on public.customer_access_events from anon, authenticated;

grant select, insert, update on public.customer_profiles to authenticated;
grant select on public.customer_access_events to authenticated;

drop policy if exists "customer_profiles_customer_read" on public.customer_profiles;
create policy "customer_profiles_customer_read"
on public.customer_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "customer_profiles_member_read" on public.customer_profiles;
create policy "customer_profiles_member_read"
on public.customer_profiles for select to authenticated
using (public.is_bakery_member(bakery_id));

drop policy if exists "customer_profiles_customer_insert" on public.customer_profiles;
create policy "customer_profiles_customer_insert"
on public.customer_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "customer_profiles_customer_update" on public.customer_profiles;
create policy "customer_profiles_customer_update"
on public.customer_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "customer_access_events_member_read" on public.customer_access_events;
create policy "customer_access_events_member_read"
on public.customer_access_events for select to authenticated
using (public.is_bakery_member(bakery_id));

create or replace function public.record_customer_access_event(
  p_slug text,
  p_event_type text,
  p_reason text default '',
  p_contact text default '',
  p_request_code text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bakery_id uuid;
  allowed_events constant text[] := array[
    'magic_link_requested',
    'guest_checkout_blocked',
    'order_submitted',
    'order_failed',
    'profile_saved'
  ];
begin
  if not (p_event_type = any(allowed_events)) then
    return;
  end if;

  select id
  into target_bakery_id
  from public.bakeries
  where slug = lower(trim(coalesce(p_slug, '')))
  limit 1;

  if target_bakery_id is null then
    return;
  end if;

  insert into public.customer_access_events (
    bakery_id,
    user_id,
    event_type,
    reason,
    contact_hint,
    request_code
  )
  values (
    target_bakery_id,
    (select auth.uid()),
    p_event_type,
    left(trim(coalesce(p_reason, '')), 300),
    left(trim(coalesce(p_contact, '')), 120),
    upper(left(trim(coalesce(p_request_code, '')), 20))
  );
end;
$$;

revoke all on function public.record_customer_access_event(text, text, text, text, text) from public;
grant execute on function public.record_customer_access_event(text, text, text, text, text) to anon, authenticated;
