-- 010_blog.sql (only needed if you do NOT run the full schema.sql)

-- ===== Blog (written by admins, public to read) =====
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90 and slug <> 'category'),
  title text not null check (char_length(title) between 3 and 120),
  excerpt text not null check (char_length(excerpt) between 20 and 300),
  content text not null check (char_length(content) >= 50),
  category text not null default 'travel-tips' check (category in ('travel-tips','destinations','photography','guides','news')),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_published_idx on public.posts (published_at desc) where status = 'published';
create index if not exists posts_category_idx on public.posts (category, published_at desc) where status = 'published';
alter table public.posts enable row level security;

drop policy if exists "published posts readable" on public.posts;
create policy "published posts readable" on public.posts for select using (status = 'published');
drop policy if exists "admins read posts" on public.posts;
create policy "admins read posts" on public.posts for select to authenticated using (public.is_admin());
drop policy if exists "admins write posts" on public.posts;
create policy "admins write posts" on public.posts for insert to authenticated with check (public.is_admin());
drop policy if exists "admins edit posts" on public.posts;
create policy "admins edit posts" on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete posts" on public.posts;
create policy "admins delete posts" on public.posts for delete to authenticated using (public.is_admin());

create or replace function public.touch_post() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
drop trigger if exists touch_post on public.posts;
create trigger touch_post before insert or update on public.posts for each row execute function public.touch_post();
