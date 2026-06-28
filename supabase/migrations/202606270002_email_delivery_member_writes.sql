grant insert, update on public.email_notification_deliveries to authenticated;

drop policy if exists "email_delivery_member_insert" on public.email_notification_deliveries;
create policy "email_delivery_member_insert"
on public.email_notification_deliveries for insert to authenticated
with check (public.is_bakery_member(bakery_id));

drop policy if exists "email_delivery_member_update" on public.email_notification_deliveries;
create policy "email_delivery_member_update"
on public.email_notification_deliveries for update to authenticated
using (public.is_bakery_member(bakery_id))
with check (public.is_bakery_member(bakery_id));
