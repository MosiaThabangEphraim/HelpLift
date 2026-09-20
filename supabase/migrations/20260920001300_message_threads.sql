-- Migration: 20260920001300_message_threads.sql
-- Description: Conversation history. Every message belongs to a conversation
-- (thread_id); a reply joins the conversation of the message it answers. People
-- can also read the messages they SENT, not only the ones addressed to them, so
-- a conversation can be shown in full instead of one message at a time.
--
--   * notifications.thread_id: the id of the first message in the conversation.
--     Set automatically on insert; existing messages are back-filled below.
--   * "Senders can view messages they sent": a person can read their own sent
--     messages.
--   * "Team members can view messages their teammates sent": an organization's
--     team shares its conversations. Incoming messages are already copied to
--     every team member (20260920000300); this lets teammates also see the
--     replies their colleagues sent.
--
-- These policies widen what a plain select on public.notifications returns, so
-- the inbox list now filters explicitly by recipient in the application
-- (app/api/notifications/route.ts).

alter table public.notifications add column if not exists thread_id uuid;
create index if not exists notifications_thread_id_idx on public.notifications(thread_id);

-- Back-fill: follow reply_to_id links to the first message of each conversation,
-- then give every remaining message its own conversation.
with recursive chain as (
  select id, id as root from public.notifications where reply_to_id is null
  union all
  select n.id, c.root from public.notifications n join chain c on n.reply_to_id = c.id
)
update public.notifications n
   set thread_id = chain.root
  from chain
 where n.id = chain.id and n.thread_id is null;

update public.notifications set thread_id = id where thread_id is null;

-- New messages: a reply joins its parent's conversation; a copy made for a
-- teammate stays in its original's conversation; anything else starts a new one.
create or replace function public.set_notification_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fanned_from is not null then
    select thread_id into new.thread_id from public.notifications where id = new.fanned_from;
  elsif new.reply_to_id is not null then
    select coalesce(thread_id, id) into new.thread_id from public.notifications where id = new.reply_to_id;
  end if;
  new.thread_id := coalesce(new.thread_id, new.id);
  return new;
end;
$$;

drop trigger if exists notifications_set_thread on public.notifications;
create trigger notifications_set_thread
before insert on public.notifications
for each row execute function public.set_notification_thread();

-- Do the signed-in user and this profile belong to the same organization?
create or replace function public.shares_organization_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.profile_id = (select auth.uid())
      and theirs.profile_id = p_profile
  );
$$;
grant execute on function public.shares_organization_with(uuid) to authenticated;

drop policy if exists "Senders can view messages they sent" on public.notifications;
create policy "Senders can view messages they sent"
on public.notifications for select to authenticated
using (sender_id = (select auth.uid()));

drop policy if exists "Team members can view messages their teammates sent" on public.notifications;
create policy "Team members can view messages their teammates sent"
on public.notifications for select to authenticated
using (sender_id is not null and public.shares_organization_with(sender_id));
