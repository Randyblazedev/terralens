create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  country text,
  region text,
  city text,
  category text not null default 'Other',
  latitude double precision,
  longitude double precision,
  best_season text,
  best_time text,
  entry_fee text,
  access_info text,
  duration text,
  difficulty text,
  website_url text,
  cover_url text,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  featured boolean not null default false,
  sponsored boolean not null default false,
  sponsor_name text,
  affiliate_url text,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_images (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  storage_path text,
  image_url text not null,
  alt_text text,
  width integer,
  height integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, place_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  start_date date,
  end_date date,
  budget text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_places (
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  day_number integer not null default 1,
  position integer not null default 0,
  notes text,
  primary key (trip_id, place_id)
);

create table if not exists public.creator_links (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists places_search_idx on public.places using gin (
  to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(country,'') || ' ' || coalesce(region,'') || ' ' || coalesce(category,''))
);

create index if not exists places_country_idx on public.places(country);
create index if not exists places_category_idx on public.places(category);
create index if not exists places_created_by_idx on public.places(created_by);

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.place_images enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.comments enable row level security;
alter table public.trips enable row level security;
alter table public.trip_places enable row level security;
alter table public.creator_links enable row level security;

drop policy if exists "public profiles are readable" on public.profiles;
create policy "public profiles are readable" on public.profiles for select using (true);
drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "published places are readable" on public.places;
create policy "published places are readable" on public.places for select using (status = 'published' or created_by = auth.uid());
drop policy if exists "signed users create places" on public.places;
create policy "signed users create places" on public.places for insert with check (auth.uid() = created_by);
drop policy if exists "owners update places" on public.places;
create policy "owners update places" on public.places for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "owners delete places" on public.places;
create policy "owners delete places" on public.places for delete using (auth.uid() = created_by);

drop policy if exists "place images readable" on public.place_images;
create policy "place images readable" on public.place_images for select using (
  exists (select 1 from public.places p where p.id = place_id and (p.status = 'published' or p.created_by = auth.uid()))
);
drop policy if exists "owners add images" on public.place_images;
create policy "owners add images" on public.place_images for insert with check (
  auth.uid() = created_by
  and exists (select 1 from public.places p where p.id = place_id and p.created_by = auth.uid())
);
drop policy if exists "owners delete images" on public.place_images;
create policy "owners delete images" on public.place_images for delete using (auth.uid() = created_by);

drop policy if exists "likes readable" on public.likes;
create policy "likes readable" on public.likes for select using (true);
drop policy if exists "users manage own likes" on public.likes;
create policy "users manage own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saves readable for owner" on public.saves;
create policy "saves readable for owner" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "users manage own saves" on public.saves;
create policy "users manage own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public collections readable" on public.collections;
create policy "public collections readable" on public.collections for select using (is_public or auth.uid() = user_id);
drop policy if exists "users manage own collections" on public.collections;
create policy "users manage own collections" on public.collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "collection items readable" on public.collection_items;
create policy "collection items readable" on public.collection_items for select using (
  exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.user_id = auth.uid()))
);
drop policy if exists "collection owners manage items" on public.collection_items;
create policy "collection owners manage items" on public.collection_items for all using (
  exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
);

drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments for select using (true);
drop policy if exists "users manage own comments" on public.comments;
create policy "users manage own comments" on public.comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own trips" on public.trips;
create policy "users manage own trips" on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trip places readable" on public.trip_places;
create policy "trip places readable" on public.trip_places for select using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);
drop policy if exists "trip owners manage places" on public.trip_places;
create policy "trip owners manage places" on public.trip_places for all using (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
) with check (
  exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
);

drop policy if exists "creator links readable" on public.creator_links;
create policy "creator links readable" on public.creator_links for select using (true);
drop policy if exists "creators manage links" on public.creator_links;
create policy "creators manage links" on public.creator_links for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public place images" on storage.objects;
create policy "public place images" on storage.objects for select using (bucket_id = 'place-images');
drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners delete place images" on storage.objects;
create policy "owners delete place images" on storage.objects for delete to authenticated
  using (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);


-- Revenue and moderation fields can only be changed by admins (service role / SQL editor),
-- never by a signed-in user, even on their own rows. RLS limits rows; this limits columns.
create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
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

drop trigger if exists protect_place_fields on public.places;
create trigger protect_place_fields before insert or update on public.places
  for each row execute function public.protect_place_fields();

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

-- ===== Photo likes: one like per user per photo =====
alter table public.place_images add column if not exists like_count integer not null default 0;

create table if not exists public.image_likes (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  image_id uuid not null references public.place_images(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, image_id)   -- the primary key is what guarantees ONE like per user per photo
);
create index if not exists image_likes_image_idx on public.image_likes (image_id);
alter table public.image_likes enable row level security;

-- Users can only see their own likes (nobody can list who liked what); public counts live on place_images.
drop policy if exists "users read own image likes" on public.image_likes;
create policy "users read own image likes" on public.image_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists "users like images" on public.image_likes;
create policy "users like images" on public.image_likes for insert to authenticated with check (
  user_id = auth.uid() and public.is_confirmed()
  and exists (select 1 from public.place_images i join public.places p on p.id = i.place_id where i.id = image_id and p.status = 'published')
);
drop policy if exists "users unlike images" on public.image_likes;
create policy "users unlike images" on public.image_likes for delete to authenticated using (user_id = auth.uid());

create or replace function public.bump_image_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.place_images set like_count = like_count + 1 where id = new.image_id;
  else
    update public.place_images set like_count = greatest(like_count - 1, 0) where id = old.image_id;
  end if;
  return null;
end $$;
drop trigger if exists image_like_count on public.image_likes;
create trigger image_like_count after insert or delete on public.image_likes
  for each row execute function public.bump_image_like_count();

create or replace function public.limit_image_likes() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.image_likes where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many likes. Please slow down.';
  end if;
  return new;
end $$;
drop trigger if exists limit_image_likes on public.image_likes;
create trigger limit_image_likes before insert on public.image_likes
  for each row execute function public.limit_image_likes();

-- Uploaders cannot start a photo with fake likes.
create or replace function public.limit_place_images() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.like_count := 0;
  if (select count(*) from public.place_images where place_id = new.place_id) >= 10 then
    raise exception 'A place can have at most 10 photos.';
  end if;
  return new;
end $$;
