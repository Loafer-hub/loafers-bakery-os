alter table public.products
add column if not exists recipe_details jsonb not null default '{}'::jsonb;

update public.products products
set recipe_details = coalesce((
  select recipe
  from public.bakery_snapshots snapshots
  cross join lateral jsonb_array_elements(
    coalesce(snapshots.data #> '{data,recipes}', '[]'::jsonb)
  ) recipe
  where snapshots.bakery_id = products.bakery_id
    and recipe ->> 'id' = products.recipe_id
  order by snapshots.updated_at desc
  limit 1
), products.recipe_details)
where products.recipe_details = '{}'::jsonb;

revoke all on public.customer_feedback from anon, authenticated;
grant select, update, delete on public.customer_feedback to authenticated;

drop policy if exists "feedback_manager_delete" on public.customer_feedback;
create policy "feedback_manager_delete"
on public.customer_feedback for delete to authenticated
using (public.can_manage_bakery(bakery_id));
