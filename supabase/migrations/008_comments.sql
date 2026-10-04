-- 008_comments.sql (only needed if you do NOT run the full schema.sql)

-- ===== Comments on places =====
-- Only people who are signed in (confirmed email) can comment, only on live places.
-- Comments on hidden or pending places are not readable. Max 15 comments per hour per user.
drop policy if exists "comments readable" on public.comments;
drop policy if exists "users manage own comments" on public.comments;
drop policy if exists "comments on live places readable" on public.comments;
create policy "comments on live places readable" on public.comments for select using (
  exists (select 1 from public.places p where p.id = place_id and p.status = 'published')
);
drop policy if exists "admins read comments" on public.comments;
create policy "admins read comments" on public.comments for select to authenticated using (public.is_admin());
drop policy if exists "users post comments" on public.comments;
create policy "users post comments" on public.comments for insert to authenticated with check (
  auth.uid() = user_id and public.is_confirmed()
  and exists (select 1 from public.places p where p.id = place_id and p.status = 'published')
);
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

create or replace function public.limit_comments() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.body := btrim(new.body);
  if char_length(new.body) = 0 then raise exception 'Write something before posting.'; end if;
  if (select count(*) from public.comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'You are commenting too fast. Please wait a little.';
  end if;
  return new;
end $$;
drop trigger if exists limit_comments on public.comments;
create trigger limit_comments before insert on public.comments
  for each row execute function public.limit_comments();
