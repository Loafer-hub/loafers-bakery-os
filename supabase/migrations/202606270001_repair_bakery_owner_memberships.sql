insert into public.bakery_members (bakery_id, user_id, role)
select id, owner_id, 'owner'
from public.bakeries
on conflict (bakery_id, user_id)
do update set role = 'owner';
