-- no-customer-accounts-v1
-- Customer accounts were removed from the storefront. Keep public ordering guest-only
-- and remove the earlier server-side sign-in requirement from submit_public_order.

do $$
declare
  function_oid regprocedure;
  function_sql text;
  patched_sql text;
begin
  function_oid := to_regprocedure('public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb)');

  if function_oid is not null then
    select pg_get_functiondef(function_oid)
    into function_sql;

    patched_sql := replace(
      function_sql,
$needle$  if (
    coalesce((settings ->> 'requireSignInForOrders')::boolean, false)
    or not coalesce((settings ->> 'allowGuestCheckout')::boolean, true)
  ) and (select auth.uid()) is null then
    raise exception 'Sign in before sending an order request.';
  end if;

$needle$,
      ''
    );

    if patched_sql <> function_sql then
      execute patched_sql;
    end if;
  end if;
end $$;

update public.bakery_settings
set settings = coalesce(settings, '{}'::jsonb)
  || '{
    "allowGuestCheckout": true,
    "requireSignInForOrders": false,
    "customerReorderEnabled": false,
    "customerProfileSavingEnabled": false
  }'::jsonb;

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) to anon, authenticated;
