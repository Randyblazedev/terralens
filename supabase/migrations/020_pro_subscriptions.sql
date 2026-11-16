-- Pro subscriptions for TerraLens
-- Tracks who has paid and what features they unlock

create table if not exists public.pro_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('pro_monthly', 'pro_lifetime', 'storyteller')),
  amount numeric(10,2) not null,
  currency text not null default 'XAF',
  payment_method text not null check (payment_method in ('mtn_momo', 'orange_money', 'flutterwave', 'lemon_squeezy')),
  transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'active', 'expired', 'refunded')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plan)
);

-- RLS policies
alter table public.pro_subscriptions enable row level security;

-- Anyone can read their own subscription
create policy "Users can read own subscription" on public.pro_subscriptions
  for select using (auth.uid() = user_id);

-- Only admins can insert/verify
create policy "Admins can insert subscriptions" on public.pro_subscriptions
  for insert with check (
    exists (select 1 from public.pro_subscriptions ps
      join auth.users u on u.id = ps.verified_by
      where ps.verified_by = auth.uid() and u.raw_app_meta_data->>'is_admin' = 'true')
    or exists (select 1 from auth.users where id = auth.uid() and raw_app_meta_data->>'is_admin' = 'true')
  );

create policy "Admins can update subscriptions" on public.pro_subscriptions
  for update using (
    exists (select 1 from auth.users where id = auth.uid() and raw_app_meta_data->>'is_admin' = 'true')
  );

-- Index for lookups
create index if not exists idx_pro_subscriptions_user on public.pro_subscriptions(user_id);
create index if not exists idx_pro_subscriptions_status on public.pro_subscriptions(status);

-- Function to check if user is pro
create or replace function public.is_pro_user(user_id uuid) returns boolean as $$
  select exists (
    select 1 from public.pro_subscriptions
    where user_id = $1
      and status in ('active', 'verified')
      and (plan = 'pro_lifetime' or expires_at > now())
  );
$$ language sql stable security definer;

-- Function to get pro status for current user
create or replace function public.get_pro_status() returns json as $$
  begin
    return row_to_json((
      select json_build_object(
        'is_pro', ps.id is not null,
        'plan', ps.plan,
        'verified_at', ps.verified_at,
        'transaction_id', ps.transaction_id
      )
      from public.pro_subscriptions ps
      where ps.user_id = auth.uid()
        and ps.status in ('active', 'verified')
      order by ps.created_at desc
      limit 1
    ));
  end;
$$ language plpgsql security definer;
