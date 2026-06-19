create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  account_type text not null default 'customer'
    check (account_type in ('baker', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bakeries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_ordering boolean not null default true,
  ordering_intro text not null default 'Fresh sourdough, made in small batches. Request a pickup below.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bakery_members (
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'baker'
    check (role in ('owner', 'admin', 'baker')),
  created_at timestamptz not null default now(),
  primary key (bakery_id, user_id)
);

create table if not exists public.bakery_snapshots (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  data jsonb not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  recipe_id text not null,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bakery_id, recipe_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  baker_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_user_id uuid references auth.users(id) on delete set null,
  request_code text not null unique,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'scheduled', 'ready', 'completed', 'declined', 'cancelled')),
  pickup_at timestamptz,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'deposit', 'paid', 'refunded')),
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  customer_notes text not null default '',
  baker_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 24),
  created_at timestamptz not null default now()
);

create index if not exists bakery_members_user_id_idx on public.bakery_members(user_id);
create index if not exists products_bakery_active_idx on public.products(bakery_id, active);
create index if not exists customers_bakery_id_idx on public.customers(bakery_id);
create index if not exists customers_user_id_idx on public.customers(user_id);
create index if not exists customer_orders_bakery_status_idx on public.customer_orders(bakery_id, status);
create index if not exists customer_orders_customer_user_idx on public.customer_orders(customer_user_id);
create index if not exists customer_orders_pickup_idx on public.customer_orders(pickup_at);
create index if not exists customer_order_items_order_id_idx on public.customer_order_items(order_id);

create or replace function public.is_bakery_member(target_bakery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bakery_members
    where bakery_id = target_bakery_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_bakery(target_bakery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bakery_members
    where bakery_id = target_bakery_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_bakery_member(uuid) from public;
revoke all on function public.can_manage_bakery(uuid) from public;
grant execute on function public.is_bakery_member(uuid) to authenticated;
grant execute on function public.is_bakery_member(uuid) to anon;
grant execute on function public.can_manage_bakery(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.bakeries enable row level security;
alter table public.bakery_members enable row level security;
alter table public.bakery_snapshots enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.bakeries from anon, authenticated;
revoke all on public.bakery_members from anon, authenticated;
revoke all on public.bakery_snapshots from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.customers from anon, authenticated;
revoke all on public.customer_orders from anon, authenticated;
revoke all on public.customer_order_items from anon, authenticated;

grant select on public.bakeries, public.products to anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.bakeries to authenticated;
grant select on public.bakery_members to authenticated;
grant select, insert, update on public.bakery_snapshots to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.customers to authenticated;
grant select, update on public.customer_orders to authenticated;
grant select on public.customer_order_items to authenticated;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "bakeries_public_or_member_read"
on public.bakeries for select to anon, authenticated
using (public_ordering or public.is_bakery_member(id));

create policy "bakeries_manager_update"
on public.bakeries for update to authenticated
using (public.can_manage_bakery(id))
with check (public.can_manage_bakery(id));

create policy "members_read_own_membership"
on public.bakery_members for select to authenticated
using ((select auth.uid()) = user_id);

create policy "snapshots_member_read"
on public.bakery_snapshots for select to authenticated
using (public.is_bakery_member(bakery_id));

create policy "snapshots_member_insert"
on public.bakery_snapshots for insert to authenticated
with check (
  public.is_bakery_member(bakery_id)
  and updated_by = (select auth.uid())
);

create policy "snapshots_member_update"
on public.bakery_snapshots for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (
  public.is_bakery_member(bakery_id)
  and updated_by = (select auth.uid())
);

create policy "products_public_or_member_read"
on public.products for select to anon, authenticated
using (
  (active and exists (
    select 1 from public.bakeries
    where bakeries.id = products.bakery_id
      and bakeries.public_ordering
  ))
  or public.is_bakery_member(bakery_id)
);

create policy "products_manager_insert"
on public.products for insert to authenticated
with check (public.can_manage_bakery(bakery_id));

create policy "products_manager_update"
on public.products for update to authenticated
using (public.can_manage_bakery(bakery_id))
with check (public.can_manage_bakery(bakery_id));

create policy "products_manager_delete"
on public.products for delete to authenticated
using (public.can_manage_bakery(bakery_id));

create policy "customers_member_read"
on public.customers for select to authenticated
using (
  public.is_bakery_member(bakery_id)
  or user_id = (select auth.uid())
);

create policy "customers_member_update"
on public.customers for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (public.is_bakery_member(bakery_id));

create policy "customer_orders_member_or_customer_read"
on public.customer_orders for select to authenticated
using (
  public.is_bakery_member(bakery_id)
  or customer_user_id = (select auth.uid())
);

create policy "customer_orders_member_update"
on public.customer_orders for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (public.is_bakery_member(bakery_id));

create policy "customer_order_items_member_or_customer_read"
on public.customer_order_items for select to authenticated
using (
  exists (
    select 1
    from public.customer_orders
    where customer_orders.id = customer_order_items.order_id
      and (
        public.is_bakery_member(customer_orders.bakery_id)
        or customer_orders.customer_user_id = (select auth.uid())
      )
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_kind text;
  requested_slug text;
  safe_slug text;
  bakery_uuid uuid;
begin
  account_kind := coalesce(new.raw_user_meta_data ->> 'account_type', 'customer');

  insert into public.profiles (user_id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when account_kind = 'baker' then 'baker' else 'customer' end
  )
  on conflict (user_id) do nothing;

  if account_kind = 'baker' then
    requested_slug := lower(coalesce(
      nullif(new.raw_user_meta_data ->> 'bakery_slug', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'bakery'
    ));
    safe_slug := trim(both '-' from regexp_replace(requested_slug, '[^a-z0-9]+', '-', 'g'));
    if safe_slug = '' then safe_slug := 'bakery'; end if;
    if exists (select 1 from public.bakeries where slug = safe_slug) then
      safe_slug := safe_slug || '-' || substring(new.id::text from 1 for 6);
    end if;

    insert into public.bakeries (owner_id, name, slug)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'bakery_name', ''), 'My Bakery'),
      safe_slug
    )
    returning id into bakery_uuid;

    insert into public.bakery_members (bakery_id, user_id, role)
    values (bakery_uuid, new.id, 'owner');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.submit_public_order(
  p_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_pickup_at timestamptz default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bakery public.bakeries%rowtype;
  target_product public.products%rowtype;
  order_uuid uuid;
  customer_uuid uuid;
  code text;
  subtotal integer := 0;
  item jsonb;
  item_quantity integer;
  customer_name_value text;
  customer_email_value text;
  customer_phone_value text;
begin
  select *
  into target_bakery
  from public.bakeries
  where slug = lower(trim(p_slug))
    and public_ordering = true;

  if target_bakery.id is null then
    raise exception 'This bakery is not accepting online requests.';
  end if;

  customer_name_value := trim(coalesce(p_customer ->> 'name', ''));
  customer_email_value := lower(trim(coalesce(p_customer ->> 'email', '')));
  customer_phone_value := trim(coalesce(p_customer ->> 'phone', ''));

  if length(customer_name_value) < 2 then
    raise exception 'Please enter a customer name.';
  end if;
  if customer_email_value = '' and customer_phone_value = '' then
    raise exception 'Please enter an email address or phone number.';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one loaf.';
  end if;

  insert into public.customers (bakery_id, user_id, name, email, phone)
  values (
    target_bakery.id,
    (select auth.uid()),
    customer_name_value,
    customer_email_value,
    customer_phone_value
  )
  returning id into customer_uuid;

  code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  insert into public.customer_orders (
    bakery_id,
    customer_id,
    customer_user_id,
    request_code,
    pickup_at,
    customer_name,
    customer_email,
    customer_phone,
    customer_notes
  )
  values (
    target_bakery.id,
    customer_uuid,
    (select auth.uid()),
    code,
    p_pickup_at,
    customer_name_value,
    customer_email_value,
    customer_phone_value,
    left(coalesce(p_notes, ''), 1200)
  )
  returning id into order_uuid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := greatest(1, least(24, coalesce((item ->> 'quantity')::integer, 0)));
    select *
    into target_product
    from public.products
    where id = (item ->> 'product_id')::uuid
      and bakery_id = target_bakery.id
      and active = true;

    if target_product.id is null then
      raise exception 'One of those products is no longer available.';
    end if;

    insert into public.customer_order_items (
      order_id,
      product_id,
      product_name,
      unit_price_cents,
      quantity
    )
    values (
      order_uuid,
      target_product.id,
      target_product.name,
      target_product.price_cents,
      item_quantity
    );

    subtotal := subtotal + (target_product.price_cents * item_quantity);
  end loop;

  update public.customer_orders
  set subtotal_cents = subtotal
  where id = order_uuid;

  return jsonb_build_object(
    'order_id', order_uuid,
    'request_code', code,
    'subtotal_cents', subtotal
  );
end;
$$;

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text) to anon, authenticated;
