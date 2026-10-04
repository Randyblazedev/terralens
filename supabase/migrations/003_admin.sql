-- 003_admin.sql  (run AFTER 002_security_hardening.sql)
-- 1) Run this whole file once in the Supabase SQL editor.
-- 2) Sign up / sign in to TerraLens with your email and CONFIRM it.
-- 3) Then run the line below with YOUR email (lowercase), once:
--
--    insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;
--
-- To remove an admin:  delete from public.admins where email = 'your-email@example.com';

-- ===== Admin access =====
-- Admins are identified by a CONFIRMED account email listed in public.admins.
-- RLS is on with no policies, so the list cannot be read or edited through the API.
create table if not exists public.admins (email text primary key check (email = lower(email)));
-- Repair: older copies of this file stored a wrong check; make it "emails must be lowercase".
alter table public.admins drop constraint if exists admins_email_check;
alter table public.admins add constraint admins_email_check check (email = lower(email));
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.place_images add column if not exists credit_name text;
alter table public.place_images add column if not exists credit_url text;

drop policy if exists "admins read places" on public.places;
create policy "admins read places" on public.places for select to authenticated using (public.is_admin());
drop policy if exists "admins update places" on public.places;
create policy "admins update places" on public.places for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete places" on public.places;
create policy "admins delete places" on public.places for delete to authenticated using (public.is_admin());

drop policy if exists "admins read images" on public.place_images;
create policy "admins read images" on public.place_images for select to authenticated using (public.is_admin());
drop policy if exists "admins add images" on public.place_images;
create policy "admins add images" on public.place_images for insert to authenticated with check (public.is_admin());
drop policy if exists "admins delete images" on public.place_images;
create policy "admins delete images" on public.place_images for delete to authenticated using (public.is_admin());

drop policy if exists "admins delete comments" on public.comments;
create policy "admins delete comments" on public.comments for delete to authenticated using (public.is_admin());

-- Let admins bypass the protected-fields trigger.
create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.featured := false; new.sponsored := false; new.sponsor_name := null;
    new.affiliate_url := null; new.view_count := 0;
  else
    new.featured := old.featured; new.sponsored := old.sponsored; new.sponsor_name := old.sponsor_name;
    new.affiliate_url := old.affiliate_url; new.view_count := old.view_count; new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end $$;
