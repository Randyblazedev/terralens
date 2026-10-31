-- 017_chat_reply_tag.sql
-- Community chat replies + @mentions. Idempotent: safe to run more than once.

alter table public.community_messages
  add column if not exists reply_to uuid references public.community_messages(id) on delete set null;

alter table public.community_messages
  add column if not exists mentions text[] not null default '{}';

create index if not exists community_messages_reply_to_idx
  on public.community_messages (reply_to);
