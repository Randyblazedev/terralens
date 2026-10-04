-- 004_moderation.sql  (run AFTER 002 and 003)
-- IMPORTANT: in Supabase go to Authentication -> Sign In / Providers -> Email and turn ON
-- "Confirm email". If it is off, every new account counts as confirmed immediately.

-- ===== Moderation, verification, reports and abuse limits =====
alter table public.places drop constraint if exists places_status_check;
alter table public.places add constraint places_status_check check (status in ('draft','pending','published','hidden'));

alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz;

create or replace function public.is_confirmed() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)
$$;
revoke all on function public.is_confirmed() from public, anon;
grant execute on function public.is_confirmed() to authenticated;

create or replace function public.is_verified() returns boolean
language sql stable set search_path = public as $$
  select coalesce((select verified from public.profiles where id = auth.uid()), false)
$$;

-- Only admins can change who is verified.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.verified := false; new.verified_at := null;
  else new.verified := old.verified; new.verified_at := old.verified_at; end if;
  return new;
end $$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- New places from unverified users wait for review; verified users publish instantly.
-- Daily and pending limits stop floods. Revenue fields stay admin-only.
create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
declare v boolean; recent int; waiting int;
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  v := public.is_verified();
  if tg_op = 'INSERT' then
    select count(*) into recent from public.places where created_by = auth.uid() and created_at > now() - interval '24 hours';
    if recent >= (case when v then 20 else 5 end) then raise exception 'Daily upload limit reached. Please try again tomorrow.'; end if;
    select count(*) into waiting from public.places where created_by = auth.uid() and status = 'pending';
    if waiting >= 20 then raise exception 'You have too many places awaiting review.'; end if;
    new.featured := false; new.sponsored := false; new.sponsor_name := null;
    new.affiliate_url := null; new.view_count := 0;
    new.status := case when v then 'published' else 'pending' end;
  else
    new.featured := old.featured; new.sponsored := old.sponsored; new.sponsor_name := old.sponsor_name;
    new.affiliate_url := old.affiliate_url; new.view_count := old.view_count; new.created_by := old.created_by;
    if old.status = 'hidden' then new.status := 'hidden';
    elsif new.status = 'published' and old.status <> 'published' and not v then new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.limit_place_images() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if (select count(*) from public.place_images where place_id = new.place_id) >= 10 then
    raise exception 'A place can have at most 10 photos.';
  end if;
  return new;
end $$;
drop trigger if exists limit_place_images on public.place_images;
create trigger limit_place_images before insert on public.place_images
  for each row execute function public.limit_place_images();

-- Uploading requires a confirmed email.
drop policy if exists "signed users create places" on public.places;
create policy "signed users create places" on public.places for insert
  with check (auth.uid() = created_by and public.is_confirmed());

drop policy if exists "owners add images" on public.place_images;
create policy "owners add images" on public.place_images for insert with check (
  auth.uid() = created_by and public.is_confirmed()
  and exists (select 1 from public.places p where p.id = place_id and p.created_by = auth.uid())
);

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and public.is_confirmed() and (storage.foldername(name))[1] = auth.uid()::text);

-- Reports from visitors (signed in, confirmed, max 10 per day, one per target).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('place','comment')),
  target_id uuid not null,
  reason text not null check (reason in ('copyright','inappropriate','spam','wrong_info','other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
alter table public.reports enable row level security;

drop policy if exists "users file reports" on public.reports;
create policy "users file reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.is_confirmed());
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete reports" on public.reports;
create policy "admins delete reports" on public.reports for delete to authenticated using (public.is_admin());

create or replace function public.limit_reports() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if (select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Report limit reached for today.';
  end if;
  return new;
end $$;
drop trigger if exists limit_reports on public.reports;
create trigger limit_reports before insert on public.reports
  for each row execute function public.limit_reports();

-- Admin-only contributor stats used by the verification workflow.
create or replace function public.admin_contributors()
returns table (id uuid, display_name text, username text, verified boolean, places bigint,
               approved_places bigint, approved_photos bigint, actioned_reports_90d bigint, last_upload timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.verified,
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
revoke all on function public.admin_contributors() from public, anon;
grant execute on function public.admin_contributors() to authenticated;
