-- password-customer-accounts-v1
-- Re-enable optional customer accounts with email + password while keeping guest checkout available.

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

alter table public.customer_profiles enable row level security;

revoke all on public.customer_profiles from anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;

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

update public.bakery_settings
set settings = coalesce(settings, '{}'::jsonb)
  || '{
    "allowGuestCheckout": true,
    "requireSignInForOrders": false,
    "customerPasswordAccountsEnabled": true,
    "customerReorderEnabled": true,
    "customerProfileSavingEnabled": true
  }'::jsonb;
