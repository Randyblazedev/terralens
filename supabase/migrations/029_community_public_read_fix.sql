-- Fix: anonymous visitors triggered is_blocked(), which is authenticated-only.
-- Public moments stay readable; blocking only filters signed-in users.
create or replace function public.is_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_user)
       or (blocker_id = p_user and blocked_id = auth.uid()));
$$;
revoke all on function public.is_blocked(uuid) from public;
grant execute on function public.is_blocked(uuid) to anon, authenticated;

drop policy if exists "moments read" on public.moments;
create policy "moments read" on public.moments for select using (
  auth.uid() is null or user_id = auth.uid() or not public.is_blocked(user_id)
);
