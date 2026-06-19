alter table public.customer_orders
add column if not exists bake_progress jsonb not null default
  '{"starter_feed":false,"mixing":false,"bulk_ferment":false,"shaped":false,"cold_proof":false,"baking":false,"cooling":false,"ready":false}'::jsonb;

create table if not exists public.bakery_unavailable_days (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  unavailable_date date not null,
  reason text not null default 'Baker unavailable',
  created_at timestamptz not null default now(),
  unique (bakery_id, unavailable_date)
);

create index if not exists bakery_unavailable_days_date_idx
on public.bakery_unavailable_days(bakery_id, unavailable_date);

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('suggestion', 'review')),
  rating integer check (rating between 1 and 5),
  message text not null check (length(message) between 2 and 2000),
  customer_name text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists customer_feedback_bakery_created_idx
on public.customer_feedback(bakery_id, created_at desc);

alter table public.bakery_unavailable_days enable row level security;
alter table public.customer_feedback enable row level security;

revoke all on public.bakery_unavailable_days from anon, authenticated;
revoke all on public.customer_feedback from anon, authenticated;

grant select, insert, update, delete on public.bakery_unavailable_days to authenticated;
grant select, update on public.customer_feedback to authenticated;

create policy "unavailable_days_member_read"
on public.bakery_unavailable_days for select to authenticated
using (public.is_bakery_member(bakery_id));

create policy "unavailable_days_member_insert"
on public.bakery_unavailable_days for insert to authenticated
with check (public.is_bakery_member(bakery_id));

create policy "unavailable_days_member_update"
on public.bakery_unavailable_days for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (public.is_bakery_member(bakery_id));

create policy "unavailable_days_member_delete"
on public.bakery_unavailable_days for delete to authenticated
using (public.is_bakery_member(bakery_id));

create policy "feedback_member_read"
on public.customer_feedback for select to authenticated
using (public.is_bakery_member(bakery_id));

create policy "feedback_member_update"
on public.customer_feedback for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (public.is_bakery_member(bakery_id));

drop function if exists public.get_public_order_capacity(text, date, date);

create function public.get_public_order_capacity(
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
        'quantity', items.quantity
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

create or replace function public.submit_customer_feedback(
  p_slug text,
  p_request_code text,
  p_contact text,
  p_feedback_type text,
  p_rating integer,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.customer_orders%rowtype;
  normalized_contact text := lower(trim(coalesce(p_contact, '')));
  normalized_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
  feedback_uuid uuid;
begin
  if p_feedback_type not in ('suggestion', 'review') then
    raise exception 'Choose suggestion or review.';
  end if;
  if length(trim(coalesce(p_message, ''))) < 2 then
    raise exception 'Please write a little more.';
  end if;

  select orders.*
  into target_order
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

  if target_order.id is null then
    raise exception 'Order not found. Check the request code and contact information.';
  end if;

  if (
    select count(*)
    from public.customer_feedback
    where order_id = target_order.id
  ) >= 5 then
    raise exception 'Feedback limit reached for this order.';
  end if;

  insert into public.customer_feedback (
    bakery_id,
    order_id,
    feedback_type,
    rating,
    message,
    customer_name
  )
  values (
    target_order.bakery_id,
    target_order.id,
    p_feedback_type,
    case when p_feedback_type = 'review' then greatest(1, least(5, coalesce(p_rating, 5))) else null end,
    left(trim(p_message), 2000),
    target_order.customer_name
  )
  returning id into feedback_uuid;

  return jsonb_build_object('feedback_id', feedback_uuid);
end;
$$;

revoke all on function public.submit_customer_feedback(text, text, text, text, integer, text) from public;
grant execute on function public.submit_customer_feedback(text, text, text, text, integer, text) to anon, authenticated;

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
  if pickup_day > (now() at time zone 'America/Anchorage')::date + 30 then
    raise exception 'Orders can only be placed for the next 30 days.';
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

  select coalesce(sum(loaves), 0)::integer
  into booked_loaves
  from (
    select items.quantity as loaves
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

  select coalesce(sum(loaves), 0)::integer
  into next_day_loaves
  from (
    select items.quantity as loaves
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

  if next_day_loaves >= 6 then
    raise exception 'That day is reserved for feeding starter for the next full bake day.';
  end if;
  if booked_loaves + requested_loaves > 6 then
    raise exception 'Only % % remain for that pickup day.',
      greatest(0, 6 - booked_loaves),
      case when greatest(0, 6 - booked_loaves) = 1 then 'loaf' else 'loaves' end;
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
