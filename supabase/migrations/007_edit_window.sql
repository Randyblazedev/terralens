-- 007_edit_window.sql (only needed if you do NOT run the full schema.sql)

-- ===== One-hour edit window =====
-- Uploaders can edit their place (details and photos) for ONE HOUR after uploading it.
-- Admins are not limited. To change the window, change the interval below and re-run this file.
create or replace function public.edit_window() returns interval
language sql immutable as $$ select interval '1 hour' $$;

create or replace function public.protect_place_fields() returns trigger
language plpgsql set search_path = public as $$
declare v boolean; recent int; waiting int; changed boolean;
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  v := public.is_verified();
  if tg_op = 'INSERT' then
    select count(*) into recent from public.places where created_by = auth.uid() and created_at > now() - interval '24 hours';
    if recent >= (case when v then 20 else 5 end) then raise exception 'Daily upload limit reached. Please try again tomorrow.'; end if;
    select count(*) into waiting from public.places where created_by = auth.uid() and status = 'pending';
    if waiting >= 20 then raise exception 'You have too many places awaiting review.'; end if;
    new.featured := false; new.sponsored := false; new.sponsor_name := null;
    new.affiliate_url := null; new.view_count := 0;
    new.status := case when v then 'published' else 'pending' end;
  else
    if now() - old.created_at > public.edit_window() then
      raise exception 'The 1-hour edit window for this place has passed.';
    end if;
    new.featured := old.featured; new.sponsored := old.sponsored; new.sponsor_name := old.sponsor_name;
    new.affiliate_url := old.affiliate_url; new.view_count := old.view_count; new.created_by := old.created_by;
    changed := (to_jsonb(new) - array['updated_at','status','featured','sponsored','sponsor_name','affiliate_url','view_count','created_by'])
               is distinct from
               (to_jsonb(old) - array['updated_at','status','featured','sponsored','sponsor_name','affiliate_url','view_count','created_by']);
    if old.status = 'hidden' then
      new := old;
    elsif new.status = 'published' and old.status <> 'published' and not v then
      new.status := 'pending';
    elsif old.status = 'published' and not v and changed then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.limit_place_images() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if now() - (select p.created_at from public.places p where p.id = new.place_id) > public.edit_window() then
    raise exception 'The 1-hour edit window for this place has passed.';
  end if;
  new.like_count := 0;
  if (select count(*) from public.place_images where place_id = new.place_id) >= 10 then
    raise exception 'A place can have at most 10 photos.';
  end if;
  if not public.is_verified() then
    update public.places set status = 'pending' where id = new.place_id and status = 'published';
  end if;
  return new;
end $$;
