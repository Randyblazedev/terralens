-- 005_photo_likes.sql  (run AFTER 004)

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
