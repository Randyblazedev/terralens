-- A bucket for World Moment photos and short videos. Anyone signed in may upload
-- into their own folder; everyone can view. No role gate — Pro comes later.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moment-media', 'moment-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "moment media public read" on storage.objects;
create policy "moment media public read" on storage.objects for select
  using (bucket_id = 'moment-media');

drop policy if exists "moment media upload own" on storage.objects;
create policy "moment media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'moment-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moment media delete own" on storage.objects;
create policy "moment media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'moment-media' and (storage.foldername(name))[1] = auth.uid()::text);
