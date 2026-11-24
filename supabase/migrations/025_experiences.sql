-- TerraLens Experiences: real hosts, real listings, real booking requests.
-- Payments are NOT wired yet, so no booking can be marked paid or confirmed here.
create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  slug text unique not null,
  title text not null,
  summary text not null,
  description text not null default '',
  category text not null default 'culture',
  cover_url text,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 10080),
  capacity integer not null default 1 check (capacity between 1 and 500),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'XAF',
  is_virtual boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists experiences_status_idx on public.experiences (status, created_at desc);
create index if not exists experiences_host_idx on public.experiences (host_id);
create index if not exists experiences_place_idx on public.experiences (place_id);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  traveler_id uuid not null references public.profiles(id) on delete cascade,
  seats integer not null default 1 check (seats between 1 and 20),
  note text not null default '',
  status text not null default 'requested' check (status in ('requested','accepted','declined','cancelled','paid','completed')),
  created_at timestamptz not null default now(),
  unique (experience_id, traveler_id)
);
create index if not exists booking_requests_traveler_idx on public.booking_requests (traveler_id, created_at desc);
create index if not exists booking_requests_host_idx on public.booking_requests (experience_id, status);

alter table public.experiences enable row level security;
alter table public.booking_requests enable row level security;

drop policy if exists "experience public read" on public.experiences;
create policy "experience public read" on public.experiences for select to anon, authenticated
  using (status = 'published' or host_id = auth.uid());
create policy "experience admin read" on public.experiences for select to authenticated
  using (public.is_admin());

drop policy if exists "hosts create experiences" on public.experiences;
create policy "hosts create experiences" on public.experiences for insert to authenticated
  with check (host_id = auth.uid() and public.can_host());

drop policy if exists "hosts manage own experiences" on public.experiences;
create policy "hosts manage own experiences" on public.experiences for update to authenticated
  using (host_id = auth.uid() or public.is_admin()) with check (host_id = auth.uid() or public.is_admin());

drop policy if exists "travelers read own requests" on public.booking_requests;
create policy "travelers read own requests" on public.booking_requests for select to authenticated
  using (traveler_id = auth.uid() or public.is_admin() or
    exists (select 1 from public.experiences e where e.id = experience_id and e.host_id = auth.uid()));

drop policy if exists "travelers create requests" on public.booking_requests;
create policy "travelers create requests" on public.booking_requests for insert to authenticated
  with check (traveler_id = auth.uid() and status = 'requested' and
    exists (select 1 from public.experiences e where e.id = experience_id and e.status = 'published'));

drop policy if exists "travelers cancel own requests" on public.booking_requests;
create policy "travelers cancel own requests" on public.booking_requests for update to authenticated
  using (traveler_id = auth.uid() or
    exists (select 1 from public.experiences e where e.id = experience_id and e.host_id = auth.uid()))
  with check (traveler_id = auth.uid() or
    exists (select 1 from public.experiences e where e.id = experience_id and e.host_id = auth.uid()));
