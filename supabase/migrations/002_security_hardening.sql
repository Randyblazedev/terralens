-- 002_security_hardening.sql
-- Run once in the Supabase SQL editor on a database created from the older schema.
-- Fresh installs already get all of this from supabase/schema.sql.

drop policy if exists "place images readable" on public.place_images;
create policy "place images readable" on public.place_images for select using (
  exists (select 1 from public.places p where p.id = place_id and (p.status = 'published' or p.created_by = auth.uid()))
);

drop policy if exists "signed users add images" on public.place_images;
drop policy if exists "owners add images" on public.place_images;
create policy "owners add images" on public.place_images for insert with check (
  auth.uid() = created_by
  and exists (select 1 from public.places p where p.id = place_id and p.created_by = auth.uid())
);

update storage.buckets
set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'place-images';

drop policy if exists "authenticated upload place images" on storage.objects;
drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners delete place images" on storage.objects;
create policy "owners delete place images" on storage.objects for delete to authenticated
  using (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);


-- Revenue and moderation fields can only be changed by admins (service role / SQL editor),
-- never by a signed-in user, even on their own rows. RLS limits rows; this limits columns.
create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.featured := false; new.sponsored := false; new.sponsor_name := null;
    new.affiliate_url := null; new.view_count := 0;
  else
    new.featured := old.featured; new.sponsored := old.sponsored; new.sponsor_name := old.sponsor_name;
    new.affiliate_url := old.affiliate_url; new.view_count := old.view_count; new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_place_fields on public.places;
create trigger protect_place_fields before insert or update on public.places
  for each row execute function public.protect_place_fields();
