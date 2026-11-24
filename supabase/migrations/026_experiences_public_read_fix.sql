-- Fix: public experience reads called is_admin(), which anon cannot execute.
-- Split into a public policy (no admin call) and an admin policy for signed-in admins.
drop policy if exists "experience public read" on public.experiences;
create policy "experience public read" on public.experiences for select to anon, authenticated
  using (status = 'published' or host_id = auth.uid());

drop policy if exists "experience admin read" on public.experiences;
create policy "experience admin read" on public.experiences for select to authenticated
  using (public.is_admin());
