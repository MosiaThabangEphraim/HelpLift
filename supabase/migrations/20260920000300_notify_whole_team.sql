-- Migration: 20260920000300_notify_whole_team.sql
-- Description: Every organization team member (owners, managers and viewers)
-- receives the organization's notifications, not just the original account
-- holder.
--
-- All existing code addresses organization notifications to
-- organizations.profile_id (interests, donations, fulfillments, gift claims,
-- admin messages, giver messages, announcements...). Rather than touch every
-- one of those code paths, a trigger copies each notification addressed to an
-- organization's account holder to the rest of that organization's team.
-- Copies are ordinary notifications, so the existing email webhook
-- (api/webhooks/notification-created) emails each member too, and each person
-- has their own read/unread state.
--
-- Only notifications created from now on are copied; nothing is back-filled.

alter table public.notifications
  add column if not exists fanned_from uuid references public.notifications(id) on delete cascade;
create index if not exists notifications_fanned_from_idx on public.notifications(fanned_from);

create or replace function public.fan_out_organization_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Copies are marked with fanned_from, so they never fan out again.
  if new.fanned_from is not null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, sender_id, sender_name, sender_role, type, title, message,
    attachment_storage_path, attachment_file_name, fanned_from
  )
  select
    m.profile_id, new.sender_id, new.sender_name, new.sender_role, new.type, new.title, new.message,
    new.attachment_storage_path, new.attachment_file_name, new.id
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  where o.profile_id = new.recipient_id
    and m.profile_id <> new.recipient_id
    and m.profile_id is distinct from new.sender_id;

  return new;
end;
$$;

drop trigger if exists notifications_fan_out_to_team on public.notifications;
create trigger notifications_fan_out_to_team
after insert on public.notifications
for each row execute function public.fan_out_organization_notification();

-- Files attached to a message are added AFTER the message row exists
-- (add_notification_attachment), so give each copy the same attachments.
create or replace function public.fan_out_notification_attachment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_attachments (notification_id, storage_path, file_name, uploaded_by)
  select c.id, new.storage_path, new.file_name, new.uploaded_by
  from public.notifications c
  where c.fanned_from = new.notification_id;
  return new;
end;
$$;

drop trigger if exists notification_attachments_fan_out_to_team on public.notification_attachments;
create trigger notification_attachments_fan_out_to_team
after insert on public.notification_attachments
for each row execute function public.fan_out_notification_attachment();
