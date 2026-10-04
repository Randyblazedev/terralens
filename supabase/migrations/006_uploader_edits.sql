-- 006_uploader_edits.sql (only needed if you do NOT run the full schema.sql)

-- ===== Uploaders can edit their own places =====
-- Owners may edit their places at any time. For an UNVERIFIED owner, changing a live place
-- (its details, or adding a photo) sends it back to review, so nothing unreviewed goes public.
-- Verified contributors edit live. Places a moderator hid cannot be edited by the owner.
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
  new.like_count := 0;
  if (select count(*) from public.place_images where place_id = new.place_id) >= 10 then
    raise exception 'A place can have at most 10 photos.';
  end if;
  -- A new photo on a live place from an unverified owner goes back to review.
  if not public.is_verified() then
    update public.places set status = 'pending' where id = new.place_id and status = 'published';
  end if;
  return new;
end $$;
