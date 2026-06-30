-- product-type-settings-v1
-- Allow non-bake packages such as sauces, vinegars, and oils to reserve 0 bake slots.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb)'::regprocedure
  )
  into function_sql;

  function_sql := replace(
    function_sql,
    'item_capacity := greatest(1, least(6, coalesce((target_option ->> ''capacity_units'')::integer, 1)));',
    'item_capacity := greatest(0, least(6, coalesce((target_option ->> ''capacity_units'')::integer, 1)));'
  );

  execute function_sql;
end $$;

revoke all on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.submit_public_order(text, jsonb, jsonb, timestamptz, text, text, text, jsonb) to anon, authenticated;
