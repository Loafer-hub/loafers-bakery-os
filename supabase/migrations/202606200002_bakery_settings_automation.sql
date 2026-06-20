create table if not exists public.bakery_settings (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.bakery_settings (bakery_id, settings)
select
  bakeries.id,
  jsonb_build_object(
    'onlineOrdering', bakeries.public_ordering,
    'reviewsVisible', true,
    'feedbackEnabled', true,
    'readyShelfEnabled', true,
    'emailNotifications', true,
    'smsNotifications', true,
    'dailyCapacity', 6,
    'orderWindowDays', 30,
    'leadTimeDays', 0,
    'pickupIntervalMinutes', 30,
    'pickupLocation', bakeries.pickup_location,
    'orderingIntro', bakeries.ordering_intro,
    'weekdayWindows', jsonb_build_array(
      jsonb_build_object('start', '07:00', 'end', '08:30'),
      jsonb_build_object('start', '17:00', 'end', '20:00')
    ),
    'weekendWindows', jsonb_build_array(
      jsonb_build_object('start', '13:00', 'end', '16:30')
    ),
    'notificationEvents', jsonb_build_object(
      'accepted', true,
      'bakeProgress', true,
      'comments', true,
      'ready', true,
      'rejected', true
    )
  )
from public.bakeries
on conflict (bakery_id) do nothing;

alter table public.bakery_settings enable row level security;
revoke all on public.bakery_settings from anon, authenticated;
grant select, insert, update on public.bakery_settings to authenticated;

create policy "bakery_settings_member_read"
on public.bakery_settings for select to authenticated
using (public.is_bakery_member(bakery_id));

create policy "bakery_settings_manager_insert"
on public.bakery_settings for insert to authenticated
with check (public.can_manage_bakery(bakery_id));

create policy "bakery_settings_manager_update"
on public.bakery_settings for update to authenticated
using (public.can_manage_bakery(bakery_id))
with check (public.can_manage_bakery(bakery_id));

create or replace function public.get_public_storefront_config(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with defaults as (
    select jsonb_build_object(
      'onlineOrdering', true,
      'reviewsVisible', true,
      'feedbackEnabled', true,
      'readyShelfEnabled', true,
      'emailNotifications', true,
      'smsNotifications', true,
      'dailyCapacity', 6,
      'orderWindowDays', 30,
      'leadTimeDays', 0,
      'pickupIntervalMinutes', 30,
      'pickupLocation', 'Three Bears, Delta Junction, AK',
      'orderingIntro', 'Fresh sourdough, made in small batches. Request a pickup below.',
      'weekdayWindows', jsonb_build_array(
        jsonb_build_object('start', '07:00', 'end', '08:30'),
        jsonb_build_object('start', '17:00', 'end', '20:00')
      ),
      'weekendWindows', jsonb_build_array(
        jsonb_build_object('start', '13:00', 'end', '16:30')
      ),
      'notificationEvents', jsonb_build_object(
        'accepted', true,
        'bakeProgress', true,
        'comments', true,
        'ready', true,
        'rejected', true
      )
    ) as settings
  )
  select jsonb_build_object(
    'bakery', jsonb_build_object(
      'id', bakeries.id,
      'name', bakeries.name,
      'slug', bakeries.slug,
      'ordering_intro', bakeries.ordering_intro,
      'pickup_location', bakeries.pickup_location,
      'payment_methods', bakeries.payment_methods
    ),
    'settings', defaults.settings || coalesce(bakery_settings.settings, '{}'::jsonb)
  )
  from public.bakeries bakeries
  cross join defaults
  left join public.bakery_settings on bakery_settings.bakery_id = bakeries.id
  where bakeries.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function public.get_public_storefront_config(text) from public;
grant execute on function public.get_public_storefront_config(text) to anon, authenticated;

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
  left join public.bakery_settings settings on settings.bakery_id = bakeries.id
  where bakeries.slug = lower(trim(p_slug))
    and coalesce((settings.settings ->> 'reviewsVisible')::boolean, true)
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
    select
      bakeries.id,
      greatest(1, least(24, coalesce((settings.settings ->> 'dailyCapacity')::integer, 6))) as daily_capacity,
      greatest(1, least(90, coalesce((settings.settings ->> 'orderWindowDays')::integer, 30))) as order_window,
      greatest(0, least(14, coalesce((settings.settings ->> 'leadTimeDays')::integer, 0))) as lead_time
    from public.bakeries bakeries
    left join public.bakery_settings settings on settings.bakery_id = bakeries.id
    where bakeries.slug = lower(trim(p_slug))
      and bakeries.public_ordering = true
      and coalesce((settings.settings ->> 'onlineOrdering')::boolean, true)
  ),
  limits as (
    select
      (now() at time zone 'America/Anchorage')::date + target.lead_time as first_day,
      (now() at time zone 'America/Anchorage')::date + target.order_window as last_day
    from target
  ),
  requested_range as (
    select
      greatest(coalesce(p_from, limits.first_day), limits.first_day) as from_day,
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
    greatest(0, target.daily_capacity - coalesce(totals.loaves, 0))::integer,
    coalesce(totals.loaves, 0) >= target.daily_capacity,
    coalesce(next_day.loaves, 0) >= target.daily_capacity,
    unavailable.id is not null,
    unavailable.reason
  from days
  join target on true
  left join totals on totals.day = days.day
  left join totals next_day on next_day.day = days.day + 1
  left join public.bakery_unavailable_days unavailable
    on unavailable.bakery_id = target.id
   and unavailable.unavailable_date = days.day
  order by days.day;
$$;

revoke all on function public.get_public_order_capacity(text, date, date) from public;
grant execute on function public.get_public_order_capacity(text, date, date) to anon, authenticated;

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
  feedback_enabled boolean := true;
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
  select coalesce((bakery_settings.settings ->> 'feedbackEnabled')::boolean, true)
  into feedback_enabled
  from public.bakery_settings
  where bakery_settings.bakery_id = target_order.bakery_id;
  feedback_enabled := coalesce(feedback_enabled, true);
  if not feedback_enabled then
    raise exception 'Customer feedback is currently turned off.';
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
  settings jsonb := '{}'::jsonb;
  pickup_windows jsonb;
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
  daily_capacity integer := 6;
  order_window integer := 30;
  lead_time integer := 0;
  pickup_local timestamp;
  pickup_day date;
  pickup_time time;
  pickup_weekday integer;
  customer_name_value text;
  customer_email_value text;
  customer_phone_value text;
  notify_email_value boolean;
  notify_sms_value boolean;
  ready_shelf_enabled boolean := true;
begin
  select bakeries.*
  into target_bakery
  from public.bakeries bakeries
  where bakeries.slug = lower(trim(p_slug));

  if target_bakery.id is null then
    raise exception 'This bakery is not accepting online requests.';
  end if;
  select coalesce(bakery_settings.settings, '{}'::jsonb)
  into settings
  from public.bakery_settings
  where bakery_settings.bakery_id = target_bakery.id;
  settings := coalesce(settings, '{}'::jsonb);

  if not target_bakery.public_ordering
    or not coalesce((settings ->> 'onlineOrdering')::boolean, true) then
    raise exception 'This bakery is not accepting online requests.';
  end if;

  daily_capacity := greatest(1, least(24, coalesce((settings ->> 'dailyCapacity')::integer, 6)));
  order_window := greatest(1, least(90, coalesce((settings ->> 'orderWindowDays')::integer, 30)));
  lead_time := greatest(0, least(14, coalesce((settings ->> 'leadTimeDays')::integer, 0)));
  ready_shelf_enabled := coalesce((settings ->> 'readyShelfEnabled')::boolean, true);

  customer_name_value := trim(coalesce(p_customer ->> 'name', ''));
  customer_email_value := lower(trim(coalesce(p_customer ->> 'email', '')));
  customer_phone_value := trim(coalesce(p_customer ->> 'phone', ''));
  notify_email_value := coalesce((settings ->> 'emailNotifications')::boolean, true)
    and coalesce((p_notifications ->> 'email')::boolean, false);
  notify_sms_value := coalesce((settings ->> 'smsNotifications')::boolean, true)
    and coalesce((p_notifications ->> 'sms')::boolean, false);

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
    if item ? 'shelf_item_id' then
      if not ready_shelf_enabled then
        raise exception 'The ready-to-go shelf is currently unavailable.';
      end if;
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
  if requested_capacity > daily_capacity then
    raise exception 'That request exceeds the % slot daily bake capacity.', daily_capacity;
  end if;

  pickup_local := p_pickup_at at time zone 'America/Anchorage';
  pickup_day := pickup_local::date;
  pickup_time := pickup_local::time;
  pickup_weekday := extract(isodow from pickup_local)::integer;

  if pickup_day < (now() at time zone 'America/Anchorage')::date + lead_time then
    raise exception 'This bakery requires % day notice before pickup.', lead_time;
  end if;
  if pickup_day > (now() at time zone 'America/Anchorage')::date + order_window then
    raise exception 'Orders can only be placed for the next % days.', order_window;
  end if;

  pickup_windows := case
    when pickup_weekday between 1 and 5 then coalesce(settings -> 'weekdayWindows', '[]'::jsonb)
    else coalesce(settings -> 'weekendWindows', '[]'::jsonb)
  end;
  if not exists (
    select 1
    from jsonb_array_elements(pickup_windows) pickup_window(value)
    where pickup_time between (pickup_window.value ->> 'start')::time and (pickup_window.value ->> 'end')::time
  ) then
    raise exception 'Choose a pickup time within the bakery pickup hours.';
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

    if next_day_capacity >= daily_capacity then
      raise exception 'That day is reserved for feeding starter for the next full bake day.';
    end if;
    if booked_capacity + requested_capacity > daily_capacity then
      raise exception 'Only % bake % remain for that pickup day.',
        greatest(0, daily_capacity - booked_capacity),
        case when greatest(0, daily_capacity - booked_capacity) = 1 then 'slot' else 'slots' end;
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
