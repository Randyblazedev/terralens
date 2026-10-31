-- 014_community_chat.sql — community chat messages.
create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists community_messages_created_idx on public.community_messages (created_at desc);
alter table public.community_messages enable row level security;
drop policy if exists "community messages readable" on public.community_messages;
create policy "community messages readable" on public.community_messages for select using (true);
drop policy if exists "users post messages" on public.community_messages;
create policy "users post messages" on public.community_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users delete own messages" on public.community_messages;
create policy "users delete own messages" on public.community_messages for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "admins delete messages" on public.community_messages;
create policy "admins delete messages" on public.community_messages for delete to authenticated using (public.is_admin());
grant select on public.community_messages to anon, authenticated;
grant insert, delete on public.community_messages to authenticated;
