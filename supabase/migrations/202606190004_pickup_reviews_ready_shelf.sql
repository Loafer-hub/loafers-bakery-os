create table if not exists public.ready_shelf_items (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  baked_on date not null,
  quantity integer not null default 0 check (quantity between 0 and 24),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_order_items
add column if not exists shelf_item_id uuid references public.ready_shelf_items(id) on delete set null;

alter table public.customer_order_items
add column if not exists item_source text not null default 'catalog'
  check (item_source in ('catalog', 'shelf'));

create index if not exists ready_shelf_items_bakery_idx
on public.ready_shelf_items(bakery_id, baked_on desc);

create index if not exists ready_shelf_items_public_idx
on public.ready_shelf_items(bakery_id, baked_on desc)
where active and quantity > 0;

create index if not exists customer_order_items_shelf_item_idx
on public.customer_order_items(shelf_item_id)
where shelf_item_id is not null;

alter table public.ready_shelf_items enable row level security;

revoke all on public.ready_shelf_items from anon, authenticated;
grant select on public.ready_shelf_items to anon, authenticated;
grant insert, update, delete on public.ready_shelf_items to authenticated;

create policy "ready_shelf_public_or_member_read"
on public.ready_shelf_items for select to anon, authenticated
using (
  (
    active
    and quantity > 0
    and exists (
      select 1
      from public.bakeries
      where bakeries.id = ready_shelf_items.bakery_id
        and bakeries.public_ordering
    )
  )
  or public.is_bakery_member(bakery_id)
);

create policy "ready_shelf_manager_insert"
on public.ready_shelf_items for insert to authenticated
with check (public.can_manage_bakery(bakery_id));

create policy "ready_shelf_manager_update"
on public.ready_shelf_items for update to authenticated
using (public.can_manage_bakery(bakery_id))
with check (public.can_manage_bakery(bakery_id));

create policy "ready_shelf_manager_delete"
on public.ready_shelf_items for delete to authenticated
using (public.can_manage_bakery(bakery_id));

create or replace function public.get_public_reviews(
  p_slug text,
  p_limit integer default 12
)
returns table (
  id uuid,
  customer_name text,
  rating integer,
  message text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    feedback.id,
    split_part(trim(feedback.customer_name), ' ', 1)
      || case
        when position(' ' in trim(feedback.customer_name)) > 0
          then ' ' || upper(left(split_part(trim(feedback.customer_name), ' ', 2), 1)) || '.'
        else ''
      end,
    feedback.rating,
    feedback.message,
    feedback.created_at
  from public.customer_feedback feedback
  join public.bakeries bakeries on bakeries.id = feedback.bakery_id
  where bakeries.slug = lower(trim(p_slug))
    and bakeries.public_ordering = true
    and feedback.feedback_type = 'review'
    and feedback.rating is not null
  order by feedback.created_at desc
  limit greatest(1, least(24, coalesce(p_limit, 12)));
$$;

revoke all on function public.get_public_reviews(text, integer) from public;
grant execute on function public.get_public_reviews(text, integer) to anon, authenticated;

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
  is_feed_reserved boolean,
  is_unavailable boolean,
  unavailable_reason text
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
  limits as (
    select
      (now() at time zone 'America/Anchorage')::date as today,
      (now() at time zone 'America/Anchorage')::date + 30 as last_day
  ),
  requested_range as (
    select
      greatest(coalesce(p_from, limits.today), limits.today) as from_day,
      least(coalesce(p_to, limits.last_day), limits.last_day) as to_day
    from limits
  ),
  cloud_totals as (
    select
      (orders.pickup_at at time zone 'America/Anchorage')::date as day,
      sum(items.quantity)::bigint as loaves
    from public.customer_orders orders
    join public.customer_order_items items on items.order_id = orders.id
    join target on target.id = orders.bakery_id
    where orders.pickup_at is not null
      and items.item_source = 'catalog'
      and orders.status not in ('declined', 'cancelled', 'completed')
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
    where range.from_day <= range.to_day
  )
  select
    days.day,
    coalesce(totals.loaves, 0)::bigint,
    greatest(0, 6 - coalesce(totals.loaves, 0))::integer,
    coalesce(totals.loaves, 0) >= 6,
    coalesce(next_day.loaves, 0) >= 6,
    unavailable.id is not null,
    unavailable.reason
  from days
  left join totals on totals.day = days.day
  left join totals next_day on next_day.day = days.day + 1
  left join target on true
  left join public.bakery_unavailable_days unavailable
    on unavailable.bakery_id = target.id
   and unavailable.unavailable_date = days.day
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
  target_shelf public.ready_shelf_items%rowtype;
  order_uuid uuid;
  customer_uuid uuid;
  code text;
  subtotal integer := 0;
  item jsonb;
  item_quantity integer;
  requested_loaves integer := 0;
  requested_items integer := 0;
  booked_loaves integer := 0;
  next_day_loaves integer := 0;
  pickup_local timestamp;
  pickup_day date;
  pickup_time time;
  pickup_weekday integer;
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
    item_quantity := greatest(1, least(24, coalesce((item ->> 'quantity')::integer, 0)));
    requested_items := requested_items + item_quantity;
    if not (item ? 'shelf_item_id') then
      requested_loaves := requested_loaves + item_quantity;
    end if;
  end loop;

  if requested_items > 24 then
    raise exception 'A pickup request can include no more than 24 total items.';
  end if;
  if requested_loaves > 6 then
    raise exception 'A future bake request can include no more than six loaves.';
  end if;

  pickup_local := p_pickup_at at time zone 'America/Anchorage';
  pickup_day := pickup_local::date;
  pickup_time := pickup_local::time;
  pickup_weekday := extract(isodow from pickup_local)::integer;

  if pickup_day < (now() at time zone 'America/Anchorage')::date then
    raise exception 'Choose a future pickup date.';
  end if;
  if pickup_day > (now() at time zone 'America/Anchorage')::date + 30 then
    raise exception 'Orders can only be placed for the next 30 days.';
  end if;
  if (
    pickup_weekday between 1 and 5
    and not (
      pickup_time between time '07:00' and time '08:30'
      or pickup_time between time '17:00' and time '20:00'
    )
  ) then
    raise exception 'Weekday pickup is available 7:00–8:30 AM or 5:00–8:00 PM.';
  end if;
  if (
    pickup_weekday in (6, 7)
    and not (pickup_time between time '13:00' and time '16:30')
  ) then
    raise exception 'Weekend pickup is available 1:00–4:30 PM.';
  end if;
  if exists (
    select 1
    from public.bakery_unavailable_days
    where bakery_id = target_bakery.id
      and unavailable_date = pickup_day
  ) then
    raise exception 'The baker is unavailable on that date.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_bakery.id::text, 0));

  if requested_loaves > 0 then
    select coalesce(sum(loaves), 0)::integer
    into booked_loaves
    from (
      select items.quantity as loaves
      from public.customer_orders orders
      join public.customer_order_items items on items.order_id = orders.id
      where orders.bakery_id = target_bakery.id
        and orders.pickup_at is not null
        and items.item_source = 'catalog'
        and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day
        and orders.status not in ('declined', 'cancelled', 'completed')
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
        and items.item_source = 'catalog'
        and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day + 1
        and orders.status not in ('declined', 'cancelled', 'completed')
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
      raise exception 'Only % % remain for that pickup day.',
        greatest(0, 6 - booked_loaves),
        case when greatest(0, 6 - booked_loaves) = 1 then 'loaf' else 'loaves' end;
    end if;
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
    item_quantity := greatest(1, least(24, coalesce((item ->> 'quantity')::integer, 0)));

    if item ? 'shelf_item_id' then
      select *
      into target_shelf
      from public.ready_shelf_items
      where id = (item ->> 'shelf_item_id')::uuid
        and bakery_id = target_bakery.id
        and active = true
      for update;

      if target_shelf.id is null or target_shelf.quantity < item_quantity then
        raise exception 'One of those ready-shelf items just sold out or has fewer available.';
      end if;

      insert into public.customer_order_items (
        order_id,
        shelf_item_id,
        item_source,
        product_name,
        unit_price_cents,
        quantity
      )
      values (
        order_uuid,
        target_shelf.id,
        'shelf',
        target_shelf.name,
        target_shelf.price_cents,
        item_quantity
      );

      subtotal := subtotal + (target_shelf.price_cents * item_quantity);

      update public.ready_shelf_items
      set
        quantity = quantity - item_quantity,
        active = (quantity - item_quantity) > 0,
        updated_at = now()
      where id = target_shelf.id;
    else
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
    end if;
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
