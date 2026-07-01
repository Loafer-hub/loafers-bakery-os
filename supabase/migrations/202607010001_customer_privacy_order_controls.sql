-- customer-privacy-controls-v1
-- Enforce owner guest-checkout/privacy order settings inside submit_public_order.

do $$
declare
  function_sql text;
  patched_sql text;
begin
  select pg_get_functiondef(
    'public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb)'::regprocedure
  )
  into function_sql;

  patched_sql := replace(
    function_sql,
    '  if not target_bakery.public_ordering
    or not coalesce((settings ->> ''onlineOrdering'')::boolean, true) then
    raise exception ''This bakery is not accepting online requests.'';
  end if;',
    '  if not target_bakery.public_ordering
    or not coalesce((settings ->> ''onlineOrdering'')::boolean, true) then
    raise exception ''This bakery is not accepting online requests.'';
  end if;

  if (
    coalesce((settings ->> ''requireSignInForOrders'')::boolean, false)
    or not coalesce((settings ->> ''allowGuestCheckout'')::boolean, true)
  ) and (select auth.uid()) is null then
    raise exception ''Sign in before sending an order request.'';
  end if;'
  );

  if patched_sql = function_sql then
    raise exception 'Could not patch submit_public_order with customer privacy controls.';
  end if;

  execute patched_sql;
end $$;

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) to anon, authenticated;
