-- World Moments: short photo/video posts tied to a real destination.
-- Ask a Local: questions tied to a destination, answered by anyone.
-- Blocks: user-controlled privacy. All reads/writes enforced by RLS.
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  kind text not null default 'photo' check (kind in ('photo','video')),
  media_url text not null check (media_url ~ '^https://'),
  caption text not null default '' check (char_length(caption) <= 600),
  created_at timestamptz not null default now()
);
create index if not exists moments_created_idx on public.moments (created_at desc);
create index if not exists moments_place_idx on public.moments (place_id, created_at desc);

create table if not exists public.moment_likes (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

create table if not exists public.moment_comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.local_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  question text not null check (char_length(question) between 5 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.local_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.local_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(answer) between 2 and 1000),
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.moments enable row level security;
alter table public.moment_likes enable row level security;
alter table public.moment_comments enable row level security;
alter table public.local_questions enable row level security;
alter table public.local_answers enable row level security;
alter table public.blocks enable row level security;

-- Hide moments from people you blocked and blocks from other users.
create or replace function public.is_blocked(p_user uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_user)
       or (blocker_id = p_user and blocked_id = auth.uid()));
$$;
revoke all on function public.is_blocked(uuid) from public;
grant execute on function public.is_blocked(uuid) to anon, authenticated;

drop policy if exists "moments read" on public.moments;
create policy "moments read" on public.moments for select using (
  auth.uid() is null or (user_id = auth.uid() or not public.is_blocked(user_id))
);
drop policy if exists "moments create" on public.moments;
create policy "moments create" on public.moments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "moments delete own" on public.moments;
create policy "moments delete own" on public.moments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "moment likes read" on public.moment_likes;
create policy "moment likes read" on public.moment_likes for select using (true);
drop policy if exists "moment likes write" on public.moment_likes;
create policy "moment likes write" on public.moment_likes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "moment comments read" on public.moment_comments;
create policy "moment comments read" on public.moment_comments for select using (true);
drop policy if exists "moment comments create" on public.moment_comments;
create policy "moment comments create" on public.moment_comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "moment comments delete" on public.moment_comments;
create policy "moment comments delete" on public.moment_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "questions read" on public.local_questions;
create policy "questions read" on public.local_questions for select using (true);
drop policy if exists "questions create" on public.local_questions;
create policy "questions create" on public.local_questions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "questions delete" on public.local_questions;
create policy "questions delete" on public.local_questions for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "answers read" on public.local_answers;
create policy "answers read" on public.local_answers for select using (true);
drop policy if exists "answers write" on public.local_answers;
create policy "answers write" on public.local_answers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "blocks own" on public.blocks;
create policy "blocks own" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
