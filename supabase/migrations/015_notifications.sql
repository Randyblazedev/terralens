-- 015_notifications.sql
-- In-app notifications (header bell + notifications page). Run once in the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow','comment','like','place','verify','report','system')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "recipients read own notifications" on public.notifications;
create policy "recipients read own notifications" on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recipients mark own read" on public.notifications;
create policy "recipients mark own read" on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "actors and admins create notifications" on public.notifications;
create policy "actors and admins create notifications" on public.notifications for insert to authenticated
  with check (auth.uid() = actor_id or public.is_admin());

drop policy if exists "recipients delete own notifications" on public.notifications;
create policy "recipients delete own notifications" on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.notifications to authenticated;
