alter table public.products
add column if not exists sales_options jsonb not null default '[]'::jsonb;

update public.products
set sales_options = jsonb_build_array(jsonb_build_object(
  'id', 'default',
  'label', 'Loaf',
  'units', 1,
  'price_cents', price_cents,
  'capacity_units', 1
))
where sales_options = '[]'::jsonb;

alter table public.customer_orders
add column if not exists notify_email boolean not null default false,
add column if not exists notify_sms boolean not null default false;

alter table public.customer_order_items
add column if not exists sale_option_id text not null default 'default',
add column if not exists sale_option_label text not null default 'Loaf',
add column if not exists units_per_pack numeric(8,2) not null default 1 check (units_per_pack > 0),
add column if not exists capacity_units integer not null default 1 check (capacity_units between 0 and 6);

update public.customer_order_items
set
  sale_option_label = case when item_source = 'shelf' then 'Ready now' else sale_option_label end,
  capacity_units = case when item_source = 'shelf' then 0 else least(6, quantity) end
where capacity_units = 1;

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
      sum(items.capacity_units)::bigint as loaves
    from public.customer_orders orders
    join public.customer_order_items items on items.order_id = orders.id
    join target on target.id = orders.bakery_id
    where orders.pickup_at is not null
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

create or replace function public.lookup_customer_order(
  p_slug text,
  p_request_code text,
  p_contact text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  normalized_contact text := lower(trim(coalesce(p_contact, '')));
  normalized_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
begin
  if length(trim(coalesce(p_request_code, ''))) < 4 or normalized_contact = '' then
    return null;
  end if;

  select jsonb_build_object(
    'request_code', orders.request_code,
    'status', orders.status,
    'pickup_at', orders.pickup_at,
    'subtotal_cents', orders.subtotal_cents,
    'customer_name', orders.customer_name,
    'payment_method', orders.payment_method,
    'pickup_location', orders.pickup_location,
    'baker_notes', orders.baker_notes,
    'bake_progress', orders.bake_progress,
    'updated_at', orders.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', items.product_name,
        'quantity', items.quantity,
        'sale_option_label', items.sale_option_label,
        'units_per_pack', items.units_per_pack
      ) order by items.created_at)
      from public.customer_order_items items
      where items.order_id = orders.id
    ), '[]'::jsonb)
  )
  into result
  from public.customer_orders orders
  join public.bakeries bakeries on bakeries.id = orders.bakery_id
  where bakeries.slug = lower(trim(p_slug))
    and upper(orders.request_code) = upper(trim(p_request_code))
    and (
      (orders.customer_email <> '' and lower(trim(orders.customer_email)) = normalized_contact)
      or
      (orders.customer_phone <> '' and regexp_replace(orders.customer_phone, '[^0-9]', '', 'g') = normalized_phone)
    )
  limit 1;

  return result;
end;
$$;

revoke all on function public.lookup_customer_order(text, text, text) from public;
grant execute on function public.lookup_customer_order(text, text, text) to anon, authenticated;

drop function if exists public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text);

create function public.submit_public_order(
  p_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_pickup_at timestamptz default null,
  p_payment_method text default 'Cash',
  p_allergies text default '',
  p_notes text default '',
  p_notifications jsonb default '{}'::jsonb
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
  target_option jsonb;
  order_uuid uuid;
  customer_uuid uuid;
  code text;
  subtotal integer := 0;
  item jsonb;
  item_quantity integer;
  item_capacity integer;
  item_units numeric(8,2);
  item_price integer;
  requested_capacity integer := 0;
  requested_items integer := 0;
  booked_capacity integer := 0;
  next_day_capacity integer := 0;
  pickup_local timestamp;
  pickup_day date;
  pickup_time time;
  pickup_weekday integer;
  customer_name_value text;
  customer_email_value text;
  customer_phone_value text;
  notify_email_value boolean;
  notify_sms_value boolean;
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
  notify_email_value := coalesce((p_notifications ->> 'email')::boolean, false);
  notify_sms_value := coalesce((p_notifications ->> 'sms')::boolean, false);

  if length(customer_name_value) < 2 then
    raise exception 'Please enter a customer name.';
  end if;
  if customer_email_value = '' and customer_phone_value = '' then
    raise exception 'Please enter an email address or phone number.';
  end if;
  if notify_email_value and customer_email_value = '' then
    raise exception 'Enter an email address to receive email updates.';
  end if;
  if notify_sms_value and customer_phone_value = '' then
    raise exception 'Enter a phone number to receive text updates.';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one item.';
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
      select *
      into target_product
      from public.products
      where id = (item ->> 'product_id')::uuid
        and bakery_id = target_bakery.id
        and active = true;

      if target_product.id is null then
        raise exception 'One of those products is no longer available.';
      end if;

      select option.value
      into target_option
      from jsonb_array_elements(target_product.sales_options) option(value)
      where option.value ->> 'id' = coalesce(item ->> 'sale_option_id', 'default')
      limit 1;

      if target_option is null then
        select option.value
        into target_option
        from jsonb_array_elements(target_product.sales_options) option(value)
        limit 1;
      end if;

      if target_option is null then
        raise exception 'That package size is no longer available.';
      end if;

      item_capacity := greatest(1, least(6, coalesce((target_option ->> 'capacity_units')::integer, 1)));
      requested_capacity := requested_capacity + item_capacity * item_quantity;
    end if;
  end loop;

  if requested_items > 24 then
    raise exception 'A pickup request can include no more than 24 packages.';
  end if;
  if requested_capacity > 6 then
    raise exception 'That request exceeds the six-slot daily bake capacity.';
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

  if requested_capacity > 0 then
    select coalesce(sum(capacity), 0)::integer
    into booked_capacity
    from (
      select items.capacity_units as capacity
      from public.customer_orders orders
      join public.customer_order_items items on items.order_id = orders.id
      where orders.bakery_id = target_bakery.id
        and orders.pickup_at is not null
        and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day
        and orders.status not in ('declined', 'cancelled', 'completed')
      union all
      select reservations.loaf_count
      from public.bakery_capacity_reservations reservations
      where reservations.bakery_id = target_bakery.id
        and reservations.pickup_date = pickup_day
    ) booked;

    select coalesce(sum(capacity), 0)::integer
    into next_day_capacity
    from (
      select items.capacity_units as capacity
      from public.customer_orders orders
      join public.customer_order_items items on items.order_id = orders.id
      where orders.bakery_id = target_bakery.id
        and orders.pickup_at is not null
        and (orders.pickup_at at time zone 'America/Anchorage')::date = pickup_day + 1
        and orders.status not in ('declined', 'cancelled', 'completed')
      union all
      select reservations.loaf_count
      from public.bakery_capacity_reservations reservations
      where reservations.bakery_id = target_bakery.id
        and reservations.pickup_date = pickup_day + 1
    ) next_day;

    if next_day_capacity >= 6 then
      raise exception 'That day is reserved for feeding starter for the next full bake day.';
    end if;
    if booked_capacity + requested_capacity > 6 then
      raise exception 'Only % bake % remain for that pickup day.',
        greatest(0, 6 - booked_capacity),
        case when greatest(0, 6 - booked_capacity) = 1 then 'slot' else 'slots' end;
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
    notify_email,
    notify_sms,
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
    notify_email_value,
    notify_sms_value,
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
        quantity,
        sale_option_id,
        sale_option_label,
        units_per_pack,
        capacity_units
      )
      values (
        order_uuid,
        target_shelf.id,
        'shelf',
        target_shelf.name,
        target_shelf.price_cents,
        item_quantity,
        'ready-now',
        'Ready now',
        1,
        0
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

      select option.value
      into target_option
      from jsonb_array_elements(target_product.sales_options) option(value)
      where option.value ->> 'id' = coalesce(item ->> 'sale_option_id', 'default')
      limit 1;

      if target_option is null then
        select option.value
        into target_option
        from jsonb_array_elements(target_product.sales_options) option(value)
        limit 1;
      end if;

      if target_product.id is null or target_option is null then
        raise exception 'One of those products or package sizes is no longer available.';
      end if;

      item_price := greatest(0, coalesce((target_option ->> 'price_cents')::integer, target_product.price_cents));
      item_units := greatest(0.5, coalesce((target_option ->> 'units')::numeric, 1));
      item_capacity := greatest(1, least(6, coalesce((target_option ->> 'capacity_units')::integer, 1)));

      insert into public.customer_order_items (
        order_id,
        product_id,
        item_source,
        product_name,
        unit_price_cents,
        quantity,
        sale_option_id,
        sale_option_label,
        units_per_pack,
        capacity_units
      )
      values (
        order_uuid,
        target_product.id,
        'catalog',
        target_product.name,
        item_price,
        item_quantity,
        target_option ->> 'id',
        target_option ->> 'label',
        item_units,
        item_capacity * item_quantity
      );

      subtotal := subtotal + (item_price * item_quantity);
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

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) to anon, authenticated;
