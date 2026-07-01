-- customer-profile-delete-v1
-- Allow signed-in customers to delete their own saved profile details for a bakery.

grant delete on public.customer_profiles to authenticated;

drop policy if exists "customer_profiles_customer_delete" on public.customer_profiles;
create policy "customer_profiles_customer_delete"
on public.customer_profiles for delete to authenticated
using ((select auth.uid()) = user_id);
