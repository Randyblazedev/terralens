-- Grant the TerraLens owner account admin + host access. Safe to re-run.
-- Run once in Supabase SQL Editor after 024/025/027/028 are in place.
insert into public.admins (email)
select lower(u.email)
from auth.users u
join public.profiles p on p.id = u.id
where p.username = 'randyblazedev'
on conflict do nothing;

update public.profiles
set role = 'verified_host', role_at = now()
where username = 'randyblazedev'
  and coalesce(role, 'user') = 'user';
