-- Lets the notification server read a recipient's push devices so it can deliver
-- out-of-app even though push_subscriptions is private to its owner. The caller
-- must be the authenticated actor on a notification just created for that user,
-- or an admin. No subscription keys are exposed to browsers.
create or replace function public.push_devices_for(p_user uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id = p_user
    and auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1 from public.notifications n
        where n.user_id = p_user
          and n.actor_id = auth.uid()
          and n.created_at > now() - interval '2 minutes'
      )
    );
$$;

revoke all on function public.push_devices_for(uuid) from public, anon;
grant execute on function public.push_devices_for(uuid) to authenticated;
