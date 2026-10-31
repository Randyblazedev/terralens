-- 016_notifications_updates.sql
-- Update-style notification kinds (new places + new blog posts).
-- Idempotent: drops any kind check mentioning the old kinds, then ensures the
-- expanded check exists. Safe to run more than once.

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'notifications'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%follow%'
  loop
    execute 'alter table public.notifications drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_kind_check') then
    alter table public.notifications
      add constraint notifications_kind_check
      check (kind in ('follow','comment','like','place','verify','report','system','new_place','new_post','chat_reply','chat_mention'));
  end if;
end $$;
