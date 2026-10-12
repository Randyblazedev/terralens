-- 011_views_and_guest_posts.sql (only needed if you do NOT run the full schema.sql; run after 010)

-- ===== Page views on place cards =====
create table if not exists public.place_views (
  place_id uuid not null references public.places(id) on delete cascade,
  viewer text not null check (char_length(viewer) between 8 and 64),
  day date not null default current_date,
  primary key (place_id, viewer, day)
);
alter table public.place_views enable row level security; -- no policies: only the function below can write

create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
declare v boolean; recent int; waiting int; changed boolean;
begin
  -- A page view only bumps the counter; it must not trip the edit rules or change updated_at.
  if current_setting('app.bumping_views', true) = '1' then
    new.updated_at := old.updated_at;
    return new;
  end if;
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
    if now() - old.created_at > public.edit_window() then
      raise exception 'The 1-hour edit window for this place has passed.';
    end if;
    new.featured := old.featured; new.sponsored := old.sponsored; new.sponsor_name := old.sponsor_name;
    new.affiliate_url := old.affiliate_url; new.view_count := old.view_count; new.created_by := old.created_by;
    changed := (to_jsonb(new) - array['updated_at','status','featured','sponsored','sponsor_name','affiliate_url','view_count','created_by'])
               is distinct from
               (to_jsonb(old) - array['updated_at','status','featured','sponsored','sponsor_name','affiliate_url','view_count','created_by']);
    if old.status = 'hidden' then
      new := old;
    elsif new.status = 'published' and old.status <> 'published' and not v then
      new.status := 'pending';
    elsif old.status = 'published' and not v and changed then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Counts one view per visitor per place per day. Anyone (even signed out) may call it; it cannot be used to
-- change anything else, and unpublished places are ignored.
create or replace function public.record_place_view(p_place uuid, p_viewer text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_viewer is null or char_length(p_viewer) < 8 or char_length(p_viewer) > 64 then return false; end if;
  insert into public.place_views (place_id, viewer)
  select p_place, p_viewer where exists (select 1 from public.places where id = p_place and status = 'published')
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  perform set_config('app.bumping_views', '1', true);
  update public.places set view_count = coalesce(view_count, 0) + 1 where id = p_place;
  perform set_config('app.bumping_views', '0', true);
  if random() < 0.02 then delete from public.place_views where day < current_date - 1; end if;
  return true;
end $$;
revoke all on function public.record_place_view(uuid, text) from public;
grant execute on function public.record_place_view(uuid, text) to anon, authenticated;

-- ===== Blog: guest posts (people who email the owner and pay) =====
alter table public.posts add column if not exists is_guest boolean not null default false;
alter table public.posts add column if not exists guest_name text check (guest_name is null or char_length(guest_name) <= 80);
alter table public.posts add column if not exists guest_link text check (guest_link is null or guest_link ~ '^https://');
