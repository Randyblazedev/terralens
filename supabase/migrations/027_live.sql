-- TerraLens Live on Cloudflare Stream. Publish credentials never leave the server.
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  live_input_uid text not null unique,
  playback_url text not null default '',
  title text not null,
  summary text not null default '',
  category text not null default 'culture',
  visibility text not null default 'public' check (visibility in ('public','restricted')),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  starts_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_status_idx on public.broadcasts (status, created_at desc);
create index if not exists broadcasts_host_idx on public.broadcasts (host_id);

create table if not exists public.broadcast_comments (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists broadcast_comments_idx on public.broadcast_comments (broadcast_id, created_at desc);

create table if not exists public.broadcast_reactions (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (broadcast_id, user_id, kind)
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  unique (broadcast_id, viewer_id)
);

alter table public.broadcasts enable row level security;
alter table public.broadcast_comments enable row level security;
alter table public.broadcast_reactions enable row level security;
alter table public.join_requests enable row level security;

-- Safe public projection: no publish tokens, no host-only fields.
create or replace function public.live_broadcast_list()
returns table (id uuid, title text, summary text, category text, playback_url text,
               status text, starts_at timestamptz, started_at timestamptz,
               host_id uuid, host_name text, place_id uuid, place_name text, place_country text)
language sql stable security definer set search_path = public as $$
  select b.id, b.title, b.summary, b.category, b.playback_url, b.status, b.starts_at, b.started_at,
    b.host_id, coalesce(p.display_name, p.username, 'Host') as host_name,
    b.place_id, pl.name as place_name, pl.country as place_country
  from public.broadcasts b
  join public.profiles p on p.id = b.host_id
  left join public.places pl on pl.id = b.place_id
  where (b.status in ('scheduled','live') or (b.status='ended' and b.ended_at > now() - interval '2 hours'))
    and b.visibility = 'public'
  order by (b.status='live') desc, b.created_at desc
  limit 100
$$;
revoke all on function public.live_broadcast_list() from public, anon;
grant execute on function public.live_broadcast_list() to anon, authenticated;

create or replace function public.live_broadcast_one(p_id uuid)
returns table (id uuid, title text, summary text, category text, playback_url text,
               status text, starts_at timestamptz, started_at timestamptz, ended_at timestamptz,
               host_id uuid, host_name text, place_id uuid, place_name text, place_country text)
language sql stable security definer set search_path = public as $$
  select b.id, b.title, b.summary, b.category, b.playback_url, b.status, b.starts_at, b.started_at, b.ended_at,
    b.host_id, coalesce(p.display_name, p.username, 'Host') as host_name,
    b.place_id, pl.name as place_name, pl.country as place_country
  from public.broadcasts b
  join public.profiles p on p.id = b.host_id
  left join public.places pl on pl.id = b.place_id
  where b.id = p_id and (b.visibility='public' or b.host_id = auth.uid() or public.is_admin())
  limit 1
$$;
revoke all on function public.live_broadcast_one(uuid) from public, anon;
grant execute on function public.live_broadcast_one(uuid) to anon, authenticated;

-- Hosts create broadcasts only after the server creates the Cloudflare live input.
drop policy if exists "hosts manage broadcasts" on public.broadcasts;
create policy "hosts manage broadcasts" on public.broadcasts for all to authenticated
  using (host_id = auth.uid() or public.is_admin()) with check (host_id = auth.uid() and public.can_host());

drop policy if exists "comments public read" on public.broadcast_comments;
create policy "comments public read" on public.broadcast_comments for select using (true);
drop policy if exists "users write own broadcast comments" on public.broadcast_comments;
create policy "users write own broadcast comments" on public.broadcast_comments for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "users delete own broadcast comments" on public.broadcast_comments;
create policy "users delete own broadcast comments" on public.broadcast_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "reactions public read" on public.broadcast_reactions;
create policy "reactions public read" on public.broadcast_reactions for select using (true);
drop policy if exists "users manage own reactions" on public.broadcast_reactions;
create policy "users manage own reactions" on public.broadcast_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "viewers read own join requests" on public.join_requests;
create policy "viewers read own join requests" on public.join_requests for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.broadcasts b where b.id=broadcast_id and b.host_id=auth.uid()) or public.is_admin());
drop policy if exists "viewers create join requests" on public.join_requests;
create policy "viewers create join requests" on public.join_requests for insert to authenticated
  with check (viewer_id = auth.uid() and status='pending');
drop policy if exists "hosts decide join requests" on public.join_requests;
create policy "hosts decide join requests" on public.join_requests for update to authenticated
  using (exists (select 1 from public.broadcasts b where b.id=broadcast_id and b.host_id=auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.broadcasts b where b.id=broadcast_id and b.host_id=auth.uid()) or public.is_admin());
