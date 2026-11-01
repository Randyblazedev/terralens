-- 018_blog_dm.sql — in-site DMs to admin for blog/guest-post ideas.
create table if not exists public.blog_dms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','read','closed')),
  created_at timestamptz not null default now()
);
create index if not exists blog_dms_user_idx on public.blog_dms (user_id, created_at desc);
create index if not exists blog_dms_status_idx on public.blog_dms (status, created_at desc);
alter table public.blog_dms enable row level security;
drop policy if exists "users send blog dms" on public.blog_dms;
create policy "users send blog dms" on public.blog_dms for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "users read own blog dms" on public.blog_dms;
create policy "users read own blog dms" on public.blog_dms for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "admins update blog dms" on public.blog_dms;
create policy "admins update blog dms" on public.blog_dms for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.blog_dms to authenticated;
