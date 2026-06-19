create table if not exists public.bakery_capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  source_key text not null,
  pickup_date date not null,
  loaf_count integer not null check (loaf_count between 1 and 6),
  updated_at timestamptz not null default now(),
  unique (bakery_id, source_key)
);

create index if not exists bakery_capacity_reservations_day_idx
on public.bakery_capacity_reservations(bakery_id, pickup_date);

alter table public.bakery_capacity_reservations enable row level security;
revoke all on public.bakery_capacity_reservations from anon, authenticated;

create or replace function public.sync_bakery_capacity_reservations(
  p_bakery_id uuid,
  p_reservations jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation jsonb;
  reservation_key text;
  reservation_date date;
  reservation_loaves integer;
begin
  if not public.is_bakery_member(p_bakery_id) then
    raise exception 'You do not have access to this bakery.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bakery_id::text, 0));

  delete from public.bakery_capacity_reservations
  where bakery_id = p_bakery_id;

  if p_reservations is null or jsonb_typeof(p_reservations) is distinct from 'array' then
    return;
  end if;

  for reservation in select value from jsonb_array_elements(p_reservations)
  loop
    reservation_key := left(trim(coalesce(reservation ->> 'source_key', '')), 180);
    reservation_date := nullif(reservation ->> 'pickup_date', '')::date;
    reservation_loaves := greatest(1, least(6, coalesce((reservation ->> 'loaf_count')::integer, 0)));

    if reservation_key <> '' and reservation_date is not null then
      insert into public.bakery_capacity_reservations (
        bakery_id,
        source_key,
        pickup_date,
        loaf_count
      )
      values (
        p_bakery_id,
        reservation_key,
        reservation_date,
        reservation_loaves
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.sync_bakery_capacity_reservations(uuid, jsonb) from public;
grant execute on function public.sync_bakery_capacity_reservations(uuid, jsonb) to authenticated;

create or replace function public.get_public_order_capacity(
  p_slug text,
  p_from date,
  p_to date
)
returns table (
  pickup_date date,
  loaf_count bigint,
  remaining integer,
  is_full boolean,
  is_feed_reserved boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select id
    from public.bakeries
    where slug = lower(trim(p_slug))
      and public_ordering = true
  ),
  requested_range as (
    select
      greatest(coalesce(p_from, (now() at time zone 'America/Anchorage')::date), (now() at time zone 'America/Anchorage')::date) as from_day,
      least(
        coalesce(p_to, (now() at time zone 'America/Anchorage')::date + 62),
        greatest(coalesce(p_from, (now() at time zone 'America/Anchorage')::date), (now() at time zone 'America/Anchorage')::date) + 120
      ) as to_day
  ),
  cloud_totals as (
    select
      (orders.pickup_at at time zone 'America/Anchorage')::date as day,
      sum(items.quantity)::bigint as loaves
    from public.customer_orders orders
    join public.customer_order_items items on items.order_id = orders.id
    join target on target.id = orders.bakery_id
    where orders.pickup_at is not null
      and orders.status not in ('declined', 'cancelled')
    group by 1
  ),
  manual_totals as (
    select reservations.pickup_date as day, sum(reservations.loaf_count)::bigint as loaves
    from public.bakery_capacity_reservations reservations
    join target on target.id = reservations.bakery_id
    group by 1
  ),
  totals as (
    select day, sum(loaves)::bigint as loaves
    from (
      select * from cloud_totals
      union all
      select * from manual_totals
    ) combined
    group by day
  ),
  days as (
    select generate_series(range.from_day, range.to_day, interval '1 day')::date as day
    from requested_range range
  )
  select
    days.day,
    coalesce(totals.loaves, 0)::bigint,
    greatest(0, 6 - coalesce(totals.loaves, 0))::integer,
    coalesce(totals.loaves, 0) >= 6,
    coalesce(next_day.loaves, 0) >= 6
  from days
  left join totals on totals.day = days.day
  left join totals next_day on next_day.day = days.day + 1
  order by days.day;
$$;

revoke all on function public.get_public_order_capacity(text, date, date) from public;
grant execute on function public.get_public_order_capacity(text, date, date) to anon, authenticated;

create or replace function public.submit_public_order(
  p_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_pickup_at timestamptz default null,
  p_payment_method text default 'Cash',
  p_allergies text default '',
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
  requested_loaves integer := 0;
  booked_loaves integer := 0;
  next_day_loaves integer := 0;
  pickup_day date;
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
  if p_pickup_at is null then
    raise exception 'Choose an available pickup date.';
  end if;
  if not (p_payment_method = any(target_bakery.payment_methods)) then
    raise exception 'That payment method is not available.';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := greatest(1, least(6, coalesce((item ->> 'quantity')::integer, 0)));
    requested_loaves := requested_loaves + item_quantity;
  end loop;

  if requested_loaves > 6 then
    raise exception 'A pickup request can include no more than six loaves.';
  end if;

  pickup_day := (p_pickup_at at time zone 'America/Anchorage')::date;
  if pickup_day < (now() at time zone 'America/Anchorage')::date then
    raise exception 'Choose a future pickup date.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_bakery.id::text, 0));

  select coalesce(sum(loaves), 0)::integer
  into booked_loaves
  from (
    select items.quantity as loaves
    from public.customer_orders orders
    join public.customer_order_items items on items.order_id = orders.id
    where orders.bakery_id = target_bakery.id
      and orders.pickup_at is not null
      and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day
      and orders.status not in ('declined', 'cancelled')
    union all
    select reservations.loaf_count
    from public.bakery_capacity_reservations reservations
    where reservations.bakery_id = target_bakery.id
      and reservations.pickup_date = pickup_day
  ) booked;

  select coalesce(sum(loaves), 0)::integer
  into next_day_loaves
  from (
    select items.quantity as loaves
    from public.customer_orders orders
    join public.customer_order_items items on items.order_id = orders.id
    where orders.bakery_id = target_bakery.id
      and orders.pickup_at is not null
      and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day + 1
      and orders.status not in ('declined', 'cancelled')
    union all
    select reservations.loaf_count
    from public.bakery_capacity_reservations reservations
    where reservations.bakery_id = target_bakery.id
      and reservations.pickup_date = pickup_day + 1
  ) next_day;

  if next_day_loaves >= 6 then
    raise exception 'That day is reserved for feeding starter for the next full bake day.';
  end if;
  if booked_loaves + requested_loaves > 6 then
    raise exception 'Only % loaf or loaves remain for that pickup day.', greatest(0, 6 - booked_loaves);
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
    payment_method,
    pickup_location,
    allergies,
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
    p_payment_method,
    target_bakery.pickup_location,
    left(coalesce(p_allergies, ''), 1200),
    left(coalesce(p_notes, ''), 1200)
  )
  returning id into order_uuid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := greatest(1, least(6, coalesce((item ->> 'quantity')::integer, 0)));
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

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text) to anon, authenticated;
