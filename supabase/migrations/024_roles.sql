-- TerraLens role foundation. Admin remains authoritative via the admins table;
-- the profile role covers the other tiers. Every check runs on the server/DB.
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user','creator','verified_host','business'));
alter table public.profiles add column if not exists role_at timestamptz;

create or replace function public.current_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select case when public.is_admin() then 'admin'
    else coalesce((select role from public.profiles where id = auth.uid()), 'user') end
$$;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated;

create or replace function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = p_role
$$;
revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

-- Who may host a live or paid experience. Verified hosts, businesses and admins.
create or replace function public.can_host() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('verified_host','business','admin')
$$;
revoke all on function public.can_host() from public, anon;
grant execute on function public.can_host() to authenticated;

-- Keep profile protection but extend it to role fields: only admins may change them.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verified := false; new.verified_at := null;
    new.role := 'user'; new.role_at := null;
  else
    new.verified := old.verified; new.verified_at := old.verified_at;
    if new.role is distinct from old.role then new.role := old.role; new.role_at := old.role_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Admin-only role change, used by the admin panel.
create or replace function public.admin_set_role(p_user uuid, p_role text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return false; end if;
  if p_role not in ('user','creator','verified_host','business') then return false; end if;
  update public.profiles set role = p_role, role_at = now() where id = p_user;
  return found;
end $$;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- Expose role in the admin contributor list without a second query.
drop function if exists public.admin_contributors();
create or replace function public.admin_contributors()
returns table (id uuid, display_name text, username text, verified boolean, role text, places bigint,
               approved_places bigint, approved_photos bigint, actioned_reports_90d bigint, last_upload timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.verified, p.role,
    count(distinct pl.id) as places,
    count(distinct pl.id) filter (where pl.status = 'published') as approved_places,
    count(pi.id) filter (where pl.status = 'published') as approved_photos,
    (select count(*) from public.reports r where r.status = 'actioned' and r.created_at > now() - interval '90 days'
       and r.target_type = 'place' and r.target_id in (select x.id from public.places x where x.created_by = p.id)) as actioned_reports_90d,
    max(pl.created_at) as last_upload
  from public.profiles p
  join public.places pl on pl.created_by = p.id
  left join public.place_images pi on pi.place_id = pl.id and pi.created_by = p.id
  where public.is_admin()
  group by p.id
  order by approved_photos desc
  limit 200
$$;
